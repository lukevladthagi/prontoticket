import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { GrupoAtendimento } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM grupos_atendimento WHERE ativo = TRUE ORDER BY nome"
  ).all<GrupoAtendimento>();

  return c.json(results);
});

// Criar grupo de atendimento
router.post("/", authMiddleware, async (c) => {
  const data = await c.req.json();
  const { nome, descricao } = data;

  if (!nome) {
    return c.json({ error: "Nome é obrigatório" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO grupos_atendimento (nome, descricao, ativo, created_at, updated_at)
     VALUES (?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(nome, descricao || null).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

// Atualizar grupo de atendimento
router.put("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const { nome, descricao } = data;

  if (!nome) {
    return c.json({ error: "Nome é obrigatório" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE grupos_atendimento 
     SET nome = ?, descricao = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(nome, descricao || null, id).run();

  return c.json({ success: true });
});

// Desativar grupo de atendimento
router.delete("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");

  await c.env.DB.prepare(
    `UPDATE grupos_atendimento 
     SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(id).run();

  return c.json({ success: true });
});

export default router;
