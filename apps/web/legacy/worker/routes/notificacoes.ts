import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { Notificacao } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar notificações do usuário
router.get("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const lida = c.req.query("lida");
  const limit = c.req.query("limit") || "50";

  let query = "SELECT * FROM notificacoes WHERE destinatario_id = ?";
  const params: any[] = [user.id];

  if (lida !== undefined) {
    query += " AND lida = ?";
    params.push(lida === 'true');
  }

  query += " ORDER BY created_at DESC LIMIT " + parseInt(limit);

  const { results } = await c.env.DB.prepare(query).bind(...params).all<Notificacao>();

  return c.json(results);
});

// Marcar notificação como lida
router.put("/:id/lida", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  await c.env.DB.prepare(
    "UPDATE notificacoes SET lida = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND destinatario_id = ?"
  ).bind(id, user.id).run();

  return c.json({ success: true });
});

// Marcar todas como lidas
router.put("/marcar-todas-lidas", authMiddleware, async (c) => {
  const user = c.get("user")!;

  await c.env.DB.prepare(
    "UPDATE notificacoes SET lida = TRUE, updated_at = CURRENT_TIMESTAMP WHERE destinatario_id = ? AND lida = FALSE"
  ).bind(user.id).run();

  return c.json({ success: true });
});

// Contar notificações não lidas
router.get("/count/nao-lidas", authMiddleware, async (c) => {
  const user = c.get("user")!;

  const result = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM notificacoes WHERE destinatario_id = ? AND lida = FALSE"
  ).bind(user.id).first<{ count: number }>();

  return c.json({ count: result?.count || 0 });
});

export default router;
