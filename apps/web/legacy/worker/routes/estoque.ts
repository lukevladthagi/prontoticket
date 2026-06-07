import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { ItemEstoque, EstoqueMovimentacao, UserProfile } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// List all inventory items
router.get("/", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM estoque WHERE ativo = TRUE ORDER BY nome"
  ).all<ItemEstoque>();
  
  return c.json(results);
});

// Get single inventory item
router.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  
  const item = await c.env.DB.prepare(
    "SELECT * FROM estoque WHERE id = ?"
  ).bind(id).first<ItemEstoque>();
  
  if (!item) {
    return c.json({ error: "Item não encontrado" }, 404);
  }
  
  return c.json(item);
});

// Create new inventory item
router.post("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();
  
  if (!profile || !['tecnico', 'gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }
  
  const body = await c.req.json();
  
  const result = await c.env.DB.prepare(
    `INSERT INTO estoque (
      nome, descricao, codigo, quantidade_atual, quantidade_minima,
      unidade_medida, valor_unitario, setor_id, localizacao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.nome,
    body.descricao || null,
    body.codigo || null,
    body.quantidade_atual || 0,
    body.quantidade_minima || 0,
    body.unidade_medida || 'un',
    body.valor_unitario || null,
    body.setor_id || null,
    body.localizacao || null
  ).run();
  
  const itemId = result.meta.last_row_id as number;
  
  // Register initial entry if quantity > 0
  if (body.quantidade_atual > 0) {
    await c.env.DB.prepare(
      `INSERT INTO estoque_movimentacoes (
        estoque_id, tipo, quantidade, quantidade_anterior, quantidade_nova,
        motivo, responsavel_id, responsavel_nome
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      itemId,
      'Entrada',
      body.quantidade_atual,
      0,
      body.quantidade_atual,
      'Cadastro inicial',
      user.id,
      profile.nome
    ).run();
  }
  
  const item = await c.env.DB.prepare(
    "SELECT * FROM estoque WHERE id = ?"
  ).bind(itemId).first<ItemEstoque>();
  
  return c.json(item, 201);
});

// Update inventory item
router.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();
  
  if (!profile || !['tecnico', 'gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }
  
  const body = await c.req.json();
  
  await c.env.DB.prepare(
    `UPDATE estoque SET
      nome = ?, descricao = ?, codigo = ?, quantidade_minima = ?,
      unidade_medida = ?, valor_unitario = ?, setor_id = ?, localizacao = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).bind(
    body.nome,
    body.descricao || null,
    body.codigo || null,
    body.quantidade_minima || 0,
    body.unidade_medida || 'un',
    body.valor_unitario || null,
    body.setor_id || null,
    body.localizacao || null,
    id
  ).run();
  
  const item = await c.env.DB.prepare(
    "SELECT * FROM estoque WHERE id = ?"
  ).bind(id).first<ItemEstoque>();
  
  return c.json(item);
});

// Add inventory movement (entrada, ajuste)
router.post("/:id/movimentacao", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();
  
  if (!profile || !['tecnico', 'gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }
  
  const body = await c.req.json();
  
  const item = await c.env.DB.prepare(
    "SELECT * FROM estoque WHERE id = ?"
  ).bind(id).first<ItemEstoque>();
  
  if (!item) {
    return c.json({ error: "Item não encontrado" }, 404);
  }
  
  const quantidadeAnterior = item.quantidade_atual;
  let quantidadeNova = quantidadeAnterior;
  
  if (body.tipo === 'Entrada') {
    quantidadeNova = quantidadeAnterior + body.quantidade;
  } else if (body.tipo === 'Ajuste') {
    quantidadeNova = body.quantidade;
  }
  
  // Update inventory quantity
  await c.env.DB.prepare(
    "UPDATE estoque SET quantidade_atual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(quantidadeNova, id).run();
  
  // Register movement
  await c.env.DB.prepare(
    `INSERT INTO estoque_movimentacoes (
      estoque_id, tipo, quantidade, quantidade_anterior, quantidade_nova,
      motivo, responsavel_id, responsavel_nome
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.tipo,
    body.quantidade,
    quantidadeAnterior,
    quantidadeNova,
    body.motivo || null,
    user.id,
    profile.nome
  ).run();
  
  return c.json({ success: true });
});

// Get inventory movements
router.get("/:id/movimentacoes", authMiddleware, async (c) => {
  const id = c.req.param("id");
  
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM estoque_movimentacoes WHERE estoque_id = ? ORDER BY created_at DESC LIMIT 50"
  ).bind(id).all<EstoqueMovimentacao>();
  
  return c.json(results);
});

// Get low stock items
router.get("/alerts/low-stock", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM estoque WHERE quantidade_atual <= quantidade_minima AND ativo = TRUE ORDER BY nome"
  ).all<ItemEstoque>();
  
  return c.json(results);
});

export default router;
