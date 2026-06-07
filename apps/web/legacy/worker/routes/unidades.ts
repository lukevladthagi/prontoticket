import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { Unidade } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM unidades WHERE ativo = TRUE ORDER BY nome"
  ).all<Unidade>();

  return c.json(results);
});

export default router;
