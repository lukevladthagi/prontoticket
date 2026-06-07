import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { 
  Historico,
  CreateHistoricoDTO,
  UserProfile
} from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Criar entrada de histórico manual (para técnicos)
router.post("/:chamadoId", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const chamadoId = c.req.param("chamadoId");
  const body: CreateHistoricoDTO = await c.req.json();

  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || profile.perfil === 'solicitante') {
    return c.json({ error: "Apenas técnicos podem adicionar entradas de histórico" }, 403);
  }

  // Verificar se chamado existe
  const chamado = await c.env.DB.prepare(
    "SELECT id FROM chamados WHERE id = ?"
  ).bind(chamadoId).first();

  if (!chamado) {
    return c.json({ error: "Chamado não encontrado" }, 404);
  }

  const detalhesJson = body.detalhes ? JSON.stringify(body.detalhes) : null;

  const result = await c.env.DB.prepare(
    `INSERT INTO historico (
      chamado_id, user_id, user_nome, tipo, acao, 
      campo_alterado, valor_anterior, valor_novo, detalhes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    chamadoId,
    user.id,
    profile.nome,
    body.tipo,
    body.acao,
    body.campo_alterado || null,
    body.valor_anterior || null,
    body.valor_novo || null,
    detalhesJson
  ).run();

  const historico = await c.env.DB.prepare(
    "SELECT * FROM historico WHERE id = ?"
  ).bind(result.meta.last_row_id).first<Historico>();

  return c.json(historico, 201);
});

// Obter histórico de um chamado
router.get("/:chamadoId", authMiddleware, async (c) => {
  const chamadoId = c.req.param("chamadoId");

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM historico WHERE chamado_id = ? ORDER BY created_at DESC"
  ).bind(chamadoId).all<Historico>();

  return c.json(results);
});

export default router;
