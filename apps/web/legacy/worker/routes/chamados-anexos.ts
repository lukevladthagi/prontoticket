import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Adicionar anexo a um chamado
router.post("/:chamado_id/anexos", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const chamadoId = c.req.param("chamado_id");
  const body = await c.req.json();

  // Verificar se o chamado existe
  const chamado = await c.env.DB.prepare(
    "SELECT id FROM chamados WHERE id = ?"
  ).bind(chamadoId).first();

  if (!chamado) {
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  // Inserir anexo
  await c.env.DB.prepare(
    `INSERT INTO anexos (chamado_id, nome_arquivo, url, tipo_arquivo, tamanho, autor_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    chamadoId,
    body.nome_arquivo,
    body.url,
    body.tipo_arquivo,
    body.tamanho,
    user.id
  ).run();

  return c.json({ success: true }, 201);
});

export default router;
