import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { SLA } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, st.nome as setor_nome 
     FROM slas s
     LEFT JOIN setores st ON s.setor_id = st.id
     WHERE s.ativo = TRUE 
     ORDER BY st.nome, s.tipo_chamado, s.prioridade`
  ).all<SLA>();

  return c.json(results);
});

// Criar SLA
router.post("/", authMiddleware, async (c) => {
  const data = await c.req.json();
  const { nome, tipo_chamado, prioridade, tempo_resposta_minutos, tempo_solucao_minutos, horario_comercial, setor_id } = data;

  if (!nome || !tipo_chamado || !prioridade) {
    return c.json({ error: "Nome, tipo de chamado e prioridade são obrigatórios" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO slas (nome, tipo_chamado, prioridade, tempo_resposta_minutos, tempo_solucao_minutos, horario_comercial, setor_id, ativo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(
    nome, 
    tipo_chamado, 
    prioridade, 
    tempo_resposta_minutos || 0, 
    tempo_solucao_minutos || 0, 
    horario_comercial ? 1 : 0,
    setor_id || null
  ).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

// Atualizar SLA
router.put("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const { nome, tipo_chamado, prioridade, tempo_resposta_minutos, tempo_solucao_minutos, horario_comercial, setor_id } = data;

  if (!nome || !tipo_chamado || !prioridade) {
    return c.json({ error: "Nome, tipo de chamado e prioridade são obrigatórios" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE slas 
     SET nome = ?, tipo_chamado = ?, prioridade = ?, tempo_resposta_minutos = ?, tempo_solucao_minutos = ?, horario_comercial = ?, setor_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    nome, 
    tipo_chamado, 
    prioridade, 
    tempo_resposta_minutos || 0, 
    tempo_solucao_minutos || 0, 
    horario_comercial ? 1 : 0,
    setor_id || null,
    id
  ).run();

  return c.json({ success: true });
});

// Desativar SLA
router.delete("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");

  await c.env.DB.prepare(
    `UPDATE slas 
     SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(id).run();

  return c.json({ success: true });
});

export default router;
