import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";

const router = new Hono<{ Bindings: Env }>();

// Listar anexos de um chamado
router.get("/chamado/:chamado_id", authMiddleware, async (c) => {
  const chamadoId = c.req.param("chamado_id");

  const { results } = await c.env.DB.prepare(
    `SELECT a.*, c.numero as chamado_numero 
     FROM anexos a
     LEFT JOIN chamados c ON a.chamado_id = c.id
     WHERE a.chamado_id = ?
     ORDER BY a.created_at DESC`
  ).bind(chamadoId).all();

  return c.json(results);
});

export default router;
