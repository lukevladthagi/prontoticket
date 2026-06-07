import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { UserProfile } from "../../shared/types";
import { calcularPontosTreinamento, calcularPontosAplicacao } from "../services/gamificacao-treinamentos";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar treinamentos do usuário
router.get("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM treinamentos WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all();

  return c.json(results);
});

// Listar todos treinamentos (gestores/admins)
router.get("/todos", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM treinamentos ORDER BY created_at DESC"
  ).all();

  return c.json(results);
});

// Criar treinamento
router.post("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  const body = await c.req.json();

  const result = await c.env.DB.prepare(
    `INSERT INTO treinamentos (
      user_id, user_nome, titulo, descricao, tipo, instituicao,
      carga_horaria, data_inicio, data_conclusao, status, certificado_url, observacoes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    user.id,
    profile.nome,
    body.titulo,
    body.descricao,
    body.tipo,
    body.instituicao,
    body.carga_horaria,
    body.data_inicio,
    body.data_conclusao,
    body.status || 'Em andamento',
    body.certificado_url,
    body.observacoes
  ).run();

  const treinamento = await c.env.DB.prepare(
    "SELECT * FROM treinamentos WHERE id = ?"
  ).bind(result.meta.last_row_id).first();

  return c.json(treinamento, 201);
});

// Atualizar treinamento
router.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  
  const treinamentoAnterior = await c.env.DB.prepare(
    "SELECT * FROM treinamentos WHERE id = ? AND user_id = ?"
  ).bind(id, user.id).first<any>();

  if (!treinamentoAnterior) {
    return c.json({ error: "Treinamento não encontrado" }, 404);
  }

  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE treinamentos SET 
      titulo = ?, descricao = ?, tipo = ?, instituicao = ?,
      carga_horaria = ?, data_inicio = ?, data_conclusao = ?, 
      status = ?, certificado_url = ?, observacoes = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    body.titulo,
    body.descricao,
    body.tipo,
    body.instituicao,
    body.carga_horaria,
    body.data_inicio,
    body.data_conclusao,
    body.status,
    body.certificado_url,
    body.observacoes,
    id
  ).run();

  const treinamento = await c.env.DB.prepare(
    "SELECT * FROM treinamentos WHERE id = ?"
  ).bind(id).first();

  return c.json(treinamento);
});

// Deletar treinamento
router.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const treinamento = await c.env.DB.prepare(
    "SELECT * FROM treinamentos WHERE id = ? AND user_id = ?"
  ).bind(id, user.id).first();

  if (!treinamento) {
    return c.json({ error: "Treinamento não encontrado" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM treinamentos WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

// Listar aplicações de um treinamento
router.get("/:id/aplicacoes", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM treinamento_aplicacoes WHERE treinamento_id = ? ORDER BY created_at DESC"
  ).bind(id).all();

  return c.json(results);
});

// Criar aplicação
router.post("/:id/aplicacoes", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json();

  const result = await c.env.DB.prepare(
    `INSERT INTO treinamento_aplicacoes (
      treinamento_id, user_id, tipo_aplicacao, descricao, evidencia_url, data_aplicacao
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    user.id,
    body.tipo_aplicacao,
    body.descricao,
    body.evidencia_url,
    body.data_aplicacao || new Date().toISOString().split('T')[0]
  ).run();

  const aplicacao = await c.env.DB.prepare(
    "SELECT * FROM treinamento_aplicacoes WHERE id = ?"
  ).bind(result.meta.last_row_id).first();

  return c.json(aplicacao, 201);
});

// Aprovar aplicação (gestores/admins)
router.post("/aplicacoes/:aplicacaoId/aprovar", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const aplicacaoId = c.req.param("aplicacaoId");
  
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE treinamento_aplicacoes SET 
      aprovado = TRUE,
      aprovador_id = ?,
      data_aprovacao = CURRENT_TIMESTAMP,
      observacoes_aprovacao = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(user.id, body.observacoes || null, aplicacaoId).run();

  const aplicacao = await c.env.DB.prepare(
    "SELECT * FROM treinamento_aplicacoes WHERE id = ?"
  ).bind(aplicacaoId).first();

  // Calcular pontos
  if (aplicacao) {
    await calcularPontosAplicacao(c.env.DB, aplicacao as any);
  }

  return c.json(aplicacao);
});

// Rejeitar aplicação
router.post("/aplicacoes/:aplicacaoId/rejeitar", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const aplicacaoId = c.req.param("aplicacaoId");
  
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE treinamento_aplicacoes SET 
      aprovado = FALSE,
      aprovador_id = ?,
      data_aprovacao = CURRENT_TIMESTAMP,
      observacoes_aprovacao = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(user.id, body.observacoes || null, aplicacaoId).run();

  const aplicacao = await c.env.DB.prepare(
    "SELECT * FROM treinamento_aplicacoes WHERE id = ?"
  ).bind(aplicacaoId).first();

  return c.json(aplicacao);
});

// Listar aplicações pendentes (gestores/admins)
router.get("/aplicacoes/pendentes", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT ta.*, t.titulo as treinamento_titulo, up.nome as user_nome
     FROM treinamento_aplicacoes ta
     JOIN treinamentos t ON ta.treinamento_id = t.id
     JOIN user_profiles up ON ta.user_id = up.user_id
     WHERE ta.aprovado = FALSE AND ta.aprovador_id IS NULL
     ORDER BY ta.created_at DESC`
  ).all();

  return c.json(results);
});

// Listar treinamentos pendentes de validação (gestores/admins)
router.get("/pendentes-validacao", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT t.*, up.nome as user_nome
     FROM treinamentos t
     JOIN user_profiles up ON t.user_id = up.user_id
     WHERE t.status = 'Concluído' AND t.validado = FALSE
     ORDER BY t.data_conclusao DESC`
  ).all();

  return c.json(results);
});

// Validar treinamento (gestores/admins)
router.post("/:id/validar", authMiddleware, async (c) => {
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
    `UPDATE treinamentos SET 
      validado = TRUE,
      validador_id = ?,
      data_validacao = CURRENT_TIMESTAMP,
      observacoes_validacao = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(user.id, body.observacoes || null, id).run();

  const treinamento = await c.env.DB.prepare(
    "SELECT * FROM treinamentos WHERE id = ?"
  ).bind(id).first();

  // Calcular pontos após validação
  if (treinamento) {
    await calcularPontosTreinamento(c.env.DB, treinamento as any);
  }

  return c.json(treinamento);
});

// Rejeitar validação de treinamento
router.post("/:id/rejeitar-validacao", authMiddleware, async (c) => {
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
    `UPDATE treinamentos SET 
      validado = FALSE,
      validador_id = ?,
      data_validacao = CURRENT_TIMESTAMP,
      observacoes_validacao = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(user.id, body.observacoes || 'Informações insuficientes', id).run();

  const treinamento = await c.env.DB.prepare(
    "SELECT * FROM treinamentos WHERE id = ?"
  ).bind(id).first();

  return c.json(treinamento);
});

export default router;
