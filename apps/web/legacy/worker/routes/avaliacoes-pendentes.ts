import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { Chamado } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Buscar avaliações pendentes do usuário
router.get("/", authMiddleware, async (c) => {
  const user = c.get("user")!;

  try {
    // Buscar chamados do usuário que estão "Aguardando Avaliação" e ainda não foram avaliados
    const chamados = await c.env.DB.prepare(`
      SELECT 
        c.*,
        up.nome as tecnico_responsavel_nome
      FROM chamados c
      LEFT JOIN user_profiles up ON c.tecnico_responsavel_id = up.user_id
      WHERE c.solicitante_id = ?
        AND c.status = 'Aguardando Avaliação'
        AND c.avaliacao_nota IS NULL
      ORDER BY c.data_resolucao DESC
    `).bind(user.id).all<Chamado>();

    return c.json(chamados.results || []);
  } catch (error) {
    console.error("Erro ao buscar avaliações pendentes:", error);
    return c.json({ error: "Erro ao buscar avaliações pendentes" }, 500);
  }
});

export default router;
