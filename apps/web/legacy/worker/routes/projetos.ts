import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { Projeto, ProjetoTarefa, UserProfile, ProjetoAprovacao } from "../../shared/types";
import { calcularPontosProjeto } from "../services/gamificacao-projetos";
import { getDataHoraBrasil } from "../utils/timezone";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM projetos ORDER BY created_at DESC"
  ).all<Projeto>();

  return c.json(results);
});

router.post("/", authMiddleware, async (c) => {
  try {
    const user = c.get("user")!;
    console.log('[POST /projetos] User:', user.id);
    
    const profile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first<UserProfile>();

    console.log('[POST /projetos] Profile:', profile);

    if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
      console.log('[POST /projetos] Access denied - perfil:', profile?.perfil);
      return c.json({ error: "Acesso negado" }, 403);
    }

    const body = await c.req.json();
    console.log('[POST /projetos] Body:', JSON.stringify(body));

    const result = await c.env.DB.prepare(
      `INSERT INTO projetos (
        nome, descricao, escopo, status, sponsor, gerente_id, 
        data_inicio, data_fim_prevista, orcamento, justificativa, riscos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.nome,
      body.descricao,
      body.escopo,
      body.status || 'Planejamento',
      body.sponsor,
      body.gerente_id,
      body.data_inicio,
      body.data_fim_prevista,
      body.orcamento,
      body.justificativa,
      body.riscos
    ).run();

    console.log('[POST /projetos] Insert result:', result);

    const projeto = await c.env.DB.prepare(
      "SELECT * FROM projetos WHERE id = ?"
    ).bind(result.meta.last_row_id).first<Projeto>();

    console.log('[POST /projetos] Created projeto:', projeto);

    return c.json(projeto, 201);
  } catch (error) {
    console.error('[POST /projetos] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

router.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const projeto = await c.env.DB.prepare(
    "SELECT * FROM projetos WHERE id = ?"
  ).bind(id).first<Projeto>();

  if (!projeto) {
    return c.json({ error: "Projeto não encontrado" }, 404);
  }

  return c.json(projeto);
});

router.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();
  
  // Buscar projeto anterior para verificar mudança de status
  const projetoAnterior = await c.env.DB.prepare(
    "SELECT * FROM projetos WHERE id = ?"
  ).bind(id).first<Projeto>();

  // Atualizar data_fim_real se mudou para Concluído
  if (body.status === 'Concluído' && projetoAnterior && projetoAnterior.status !== 'Concluído') {
    body.data_fim_real = new Date().toISOString().split('T')[0];
  }

  await c.env.DB.prepare(
    `UPDATE projetos SET 
      nome = ?, descricao = ?, escopo = ?, status = ?, sponsor = ?, 
      gerente_id = ?, data_inicio = ?, data_fim_prevista = ?, data_fim_real = ?,
      orcamento = ?, justificativa = ?, riscos = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    body.nome,
    body.descricao,
    body.escopo,
    body.status,
    body.sponsor,
    body.gerente_id,
    body.data_inicio,
    body.data_fim_prevista,
    body.data_fim_real || null,
    body.orcamento,
    body.justificativa,
    body.riscos,
    getDataHoraBrasil(),
    id
  ).run();

  const projeto = await c.env.DB.prepare(
    "SELECT * FROM projetos WHERE id = ?"
  ).bind(id).first<Projeto>();

  // Se mudou para Concluído, calcular pontos de gamificação
  if (projeto && body.status === 'Concluído' && projetoAnterior && projetoAnterior.status !== 'Concluído') {
    await calcularPontosProjeto(c.env.DB, projeto);
  }

  return c.json(projeto);
});

router.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || profile.perfil !== 'admin') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM projetos WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

router.get("/:id/tarefas", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM projeto_tarefas WHERE projeto_id = ? ORDER BY created_at DESC"
  ).bind(id).all<ProjetoTarefa>();

  return c.json(results);
});

router.post("/:id/tarefas", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const result = await c.env.DB.prepare(
    `INSERT INTO projeto_tarefas (
      projeto_id, titulo, descricao, status, prioridade, 
      responsavel_id, prazo, concluido, duracao_minutos
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.titulo,
    body.descricao,
    body.status || 'A fazer',
    body.prioridade,
    body.responsavel_id,
    body.prazo,
    body.concluido || false,
    body.duracao_minutos
  ).run();

  const tarefa = await c.env.DB.prepare(
    "SELECT * FROM projeto_tarefas WHERE id = ?"
  ).bind(result.meta.last_row_id).first<ProjetoTarefa>();

  return c.json(tarefa, 201);
});

router.put("/:id/tarefas/:tarefaId", authMiddleware, async (c) => {
  const tarefaId = c.req.param("tarefaId");
  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE projeto_tarefas SET 
      titulo = ?, descricao = ?, status = ?, prioridade = ?, 
      responsavel_id = ?, prazo = ?, concluido = ?, duracao_minutos = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    body.titulo,
    body.descricao,
    body.status,
    body.prioridade,
    body.responsavel_id,
    body.prazo,
    body.concluido,
    body.duracao_minutos,
    getDataHoraBrasil(),
    tarefaId
  ).run();

  const tarefa = await c.env.DB.prepare(
    "SELECT * FROM projeto_tarefas WHERE id = ?"
  ).bind(tarefaId).first<ProjetoTarefa>();

  return c.json(tarefa);
});

router.delete("/:id/tarefas/:tarefaId", authMiddleware, async (c) => {
  const tarefaId = c.req.param("tarefaId");

  await c.env.DB.prepare(
    "DELETE FROM projeto_tarefas WHERE id = ?"
  ).bind(tarefaId).run();

  return c.json({ success: true });
});

// Aprovar projeto
router.post("/:id/aprovar", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE projetos SET 
      status = 'Em andamento',
      aprovador_id = ?,
      data_aprovacao = ?,
      analise_viabilidade = ?,
      updated_at = ?
     WHERE id = ?`
  ).bind(user.id, getDataHoraBrasil(), body.analise_viabilidade, getDataHoraBrasil(), id).run();

  await c.env.DB.prepare(
    `INSERT INTO projeto_aprovacoes (
      projeto_id, aprovador_id, aprovador_nome, acao, comentario
    ) VALUES (?, ?, ?, 'Aprovado', ?)`
  ).bind(id, user.id, profile.nome, body.comentario).run();

  const projeto = await c.env.DB.prepare(
    "SELECT * FROM projetos WHERE id = ?"
  ).bind(id).first<Projeto>();

  return c.json(projeto);
});

// Rejeitar projeto
router.post("/:id/rejeitar", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE projetos SET 
      status = 'Cancelado',
      aprovador_id = ?,
      data_aprovacao = ?,
      analise_viabilidade = ?,
      motivo_rejeicao = ?,
      updated_at = ?
     WHERE id = ?`
  ).bind(user.id, getDataHoraBrasil(), body.analise_viabilidade, body.motivo_rejeicao, getDataHoraBrasil(), id).run();

  await c.env.DB.prepare(
    `INSERT INTO projeto_aprovacoes (
      projeto_id, aprovador_id, aprovador_nome, acao, comentario
    ) VALUES (?, ?, ?, 'Rejeitado', ?)`
  ).bind(id, user.id, profile.nome, body.comentario).run();

  const projeto = await c.env.DB.prepare(
    "SELECT * FROM projetos WHERE id = ?"
  ).bind(id).first<Projeto>();

  return c.json(projeto);
});

// Colocar projeto em espera
router.post("/:id/em-espera", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE projetos SET 
      status = 'Pausado',
      aprovador_id = ?,
      data_aprovacao = ?,
      analise_viabilidade = ?,
      motivo_rejeicao = ?,
      updated_at = ?
     WHERE id = ?`
  ).bind(user.id, getDataHoraBrasil(), body.analise_viabilidade, body.motivo_rejeicao, getDataHoraBrasil(), id).run();

  await c.env.DB.prepare(
    `INSERT INTO projeto_aprovacoes (
      projeto_id, aprovador_id, aprovador_nome, acao, comentario
    ) VALUES (?, ?, ?, 'Em espera', ?)`
  ).bind(id, user.id, profile.nome, body.comentario).run();

  const projeto = await c.env.DB.prepare(
    "SELECT * FROM projetos WHERE id = ?"
  ).bind(id).first<Projeto>();

  return c.json(projeto);
});

// Buscar histórico de aprovações
router.get("/:id/aprovacoes", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM projeto_aprovacoes WHERE projeto_id = ? ORDER BY created_at DESC"
  ).bind(id).all<ProjetoAprovacao>();

  return c.json(results);
});

export default router;
