import { Hono } from 'hono';
import { authMiddleware } from '@getmocha/users-service/backend';
import type { UserProfile, FilaAtendimento } from '../../shared/types';

const router = new Hono<{ Bindings: Env }>();

// Listar filas
router.get("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  // Apenas gestores e admins podem ver todas as filas
  if (!['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT f.*, u.nome as responsavel_nome
     FROM filas_atendimento f
     LEFT JOIN user_profiles u ON f.responsavel_id = u.user_id
     WHERE f.setor_id = ? AND f.ativo = TRUE
     ORDER BY f.tipo DESC, f.nome ASC`
  ).bind(profile.setor_id).all<FilaAtendimento & { responsavel_nome?: string }>();

  return c.json(results);
});

// Criar fila
router.post("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  if (!['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json<{
    nome: string;
    descricao?: string;
    setor_id: number;
    tipo: 'helpdesk' | 'tecnico';
    responsavel_id?: string;
  }>();

  // Verificar se já existe uma fila com o mesmo nome no setor
  const existente = await c.env.DB.prepare(
    `SELECT id FROM filas_atendimento 
     WHERE setor_id = ? AND nome = ? AND ativo = TRUE`
  ).bind(body.setor_id, body.nome).first();

  if (existente) {
    return c.json({ error: "Já existe uma fila com este nome" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO filas_atendimento (nome, descricao, setor_id, tipo, responsavel_id, ativo)
     VALUES (?, ?, ?, ?, ?, TRUE)`
  ).bind(
    body.nome,
    body.descricao || null,
    body.setor_id,
    body.tipo,
    body.responsavel_id || null
  ).run();

  const fila = await c.env.DB.prepare(
    "SELECT * FROM filas_atendimento WHERE id = ?"
  ).bind(result.meta.last_row_id).first<FilaAtendimento>();

  return c.json(fila, 201);
});

// Atualizar fila
router.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  if (!['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const id = c.req.param("id");
  const body = await c.req.json<{
    nome: string;
    descricao?: string;
    responsavel_id?: string;
  }>();

  const fila = await c.env.DB.prepare(
    "SELECT * FROM filas_atendimento WHERE id = ?"
  ).bind(id).first<FilaAtendimento>();

  if (!fila) {
    return c.json({ error: "Fila não encontrada" }, 404);
  }

  // Não permitir editar fila helpdesk
  if (fila.tipo === 'helpdesk') {
    return c.json({ error: "Fila Helpdesk não pode ser editada" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE filas_atendimento 
     SET nome = ?, descricao = ?, responsavel_id = ?
     WHERE id = ?`
  ).bind(
    body.nome,
    body.descricao || null,
    body.responsavel_id || null,
    id
  ).run();

  const updated = await c.env.DB.prepare(
    "SELECT * FROM filas_atendimento WHERE id = ?"
  ).bind(id).first<FilaAtendimento>();

  return c.json(updated);
});

// Desativar fila
router.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  if (!['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const id = c.req.param("id");

  const fila = await c.env.DB.prepare(
    "SELECT * FROM filas_atendimento WHERE id = ?"
  ).bind(id).first<FilaAtendimento>();

  if (!fila) {
    return c.json({ error: "Fila não encontrada" }, 404);
  }

  // Não permitir desativar fila helpdesk
  if (fila.tipo === 'helpdesk') {
    return c.json({ error: "Fila Helpdesk não pode ser desativada" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE filas_atendimento SET ativo = FALSE WHERE id = ?`
  ).bind(id).run();

  return c.json({ success: true });
});

export default router;
