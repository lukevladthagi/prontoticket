import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { Contrato, Fornecedor, UserProfile } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM contratos WHERE ativo = TRUE ORDER BY data_fim ASC"
  ).all<Contrato>();

  return c.json(results);
});

router.post("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor_ti', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  const result = await c.env.DB.prepare(
    `INSERT INTO contratos (
      fornecedor_id, numero_contrato, descricao, data_inicio, 
      data_fim, valor, sla_contratado, observacoes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.fornecedor_id,
    body.numero_contrato,
    body.descricao,
    body.data_inicio,
    body.data_fim,
    body.valor,
    body.sla_contratado,
    body.observacoes
  ).run();

  const contrato = await c.env.DB.prepare(
    "SELECT * FROM contratos WHERE id = ?"
  ).bind(result.meta.last_row_id).first<Contrato>();

  return c.json(contrato, 201);
});

router.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor_ti', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE contratos SET 
      fornecedor_id = ?, numero_contrato = ?, descricao = ?, 
      data_inicio = ?, data_fim = ?, valor = ?, 
      sla_contratado = ?, observacoes = ?, 
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    body.fornecedor_id,
    body.numero_contrato,
    body.descricao,
    body.data_inicio,
    body.data_fim,
    body.valor,
    body.sla_contratado,
    body.observacoes,
    id
  ).run();

  const contrato = await c.env.DB.prepare(
    "SELECT * FROM contratos WHERE id = ?"
  ).bind(id).first<Contrato>();

  return c.json(contrato);
});

router.get("/vencendo", authMiddleware, async (c) => {
  const diasAviso = 30;
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() + diasAviso);

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM contratos WHERE ativo = TRUE AND data_fim <= ? ORDER BY data_fim ASC"
  ).bind(dataLimite.toISOString().split('T')[0]).all<Contrato>();

  return c.json(results);
});

router.get("/fornecedores", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM fornecedores WHERE ativo = TRUE ORDER BY nome"
  ).all<Fornecedor>();

  return c.json(results);
});

router.post("/fornecedores", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor_ti', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  const result = await c.env.DB.prepare(
    `INSERT INTO fornecedores (nome, cnpj, contato_nome, contato_email, contato_telefone)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    body.nome,
    body.cnpj,
    body.contato,
    body.email,
    body.telefone
  ).run();

  const fornecedor = await c.env.DB.prepare(
    "SELECT * FROM fornecedores WHERE id = ?"
  ).bind(result.meta.last_row_id).first<Fornecedor>();

  return c.json(fornecedor, 201);
});

export default router;
