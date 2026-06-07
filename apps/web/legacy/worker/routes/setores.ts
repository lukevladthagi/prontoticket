import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { Setor } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar todos os setores (apenas ativos para formulários)
router.get("/", authMiddleware, async (c) => {
  const setores = await c.env.DB.prepare(
    "SELECT * FROM setores WHERE ativo = TRUE ORDER BY nome"
  ).all<Setor>();

  return c.json(setores.results || []);
});

// Buscar setor específico pelo ID
router.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  
  const setor = await c.env.DB.prepare(
    "SELECT * FROM setores WHERE id = ?"
  ).bind(id).first<Setor>();

  if (!setor) {
    return c.json({ error: "Setor não encontrado" }, 404);
  }

  return c.json(setor);
});

// Criar setor
router.post("/", authMiddleware, async (c) => {
  const user = c.get("user")!;

  // Verificar se é admin
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil !== 'admin') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json<Partial<Setor>>();

  if (!body.nome) {
    return c.json({ error: "Nome é obrigatório" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO setores (nome, descricao, responsavel_id, email, ramal, ativo, atende_ticket)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.nome,
    body.descricao || null,
    body.responsavel_id || null,
    body.email || null,
    body.ramal || null,
    body.ativo !== false,
    body.atende_ticket || false
  ).run();

  const newSetor = await c.env.DB.prepare(
    "SELECT * FROM setores WHERE id = ?"
  ).bind(result.meta.last_row_id).first<Setor>();

  return c.json(newSetor, 201);
});

// Atualizar setor
router.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;

  // Verificar se é admin
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil !== 'admin') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const id = c.req.param("id");
  const body = await c.req.json<Partial<Setor>>();

  const setor = await c.env.DB.prepare(
    "SELECT * FROM setores WHERE id = ?"
  ).bind(id).first<Setor>();

  if (!setor) {
    return c.json({ error: "Setor não encontrado" }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE setores 
     SET nome = ?, descricao = ?, responsavel_id = ?, email = ?, ramal = ?, ativo = ?, atende_ticket = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    body.nome || setor.nome,
    body.descricao !== undefined ? body.descricao : setor.descricao,
    body.responsavel_id !== undefined ? body.responsavel_id : setor.responsavel_id,
    body.email !== undefined ? body.email : setor.email,
    body.ramal !== undefined ? body.ramal : setor.ramal,
    body.ativo !== undefined ? body.ativo : setor.ativo,
    body.atende_ticket !== undefined ? body.atende_ticket : setor.atende_ticket,
    id
  ).run();

  const updated = await c.env.DB.prepare(
    "SELECT * FROM setores WHERE id = ?"
  ).bind(id).first<Setor>();

  return c.json(updated);
});

// Deletar setor
router.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;

  // Verificar se é admin
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil !== 'admin') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const id = c.req.param("id");

  const setor = await c.env.DB.prepare(
    "SELECT * FROM setores WHERE id = ?"
  ).bind(id).first<Setor>();

  if (!setor) {
    return c.json({ error: "Setor não encontrado" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM setores WHERE id = ?").bind(id).run();

  return c.json({ message: "Setor deletado com sucesso" });
});

export default router;
