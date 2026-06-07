import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { Categoria } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar categorias principais
router.get("/", authMiddleware, async (c) => {
  const setorId = c.req.query("setor_id");
  
  let query = "SELECT id, nome, descricao, categoria_pai_id, tipo, setor_id, tipo_problema, ativo, created_at, updated_at FROM categorias WHERE tipo = 'categoria' AND ativo = TRUE";
  const params: any[] = [];
  
  if (setorId) {
    query += " AND (setor_id = ? OR setor_id IS NULL)";
    params.push(parseInt(setorId));
  }
  
  query += " ORDER BY nome";
  
  const { results } = await c.env.DB.prepare(query).bind(...params).all<Categoria>();

  return c.json(results);
});

// Listar todas as categorias (para a página de configurações)
router.get("/all", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM categorias WHERE ativo = TRUE ORDER BY nome"
  ).all<Categoria>();

  return c.json(results);
});

// Listar subcategorias de uma categoria
router.get("/:id/subcategorias", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const { results } = await c.env.DB.prepare(
    "SELECT id, nome, descricao, categoria_pai_id, tipo, setor_id, tipo_problema, ativo, created_at, updated_at FROM categorias WHERE categoria_pai_id = ? AND tipo = 'subcategoria' AND ativo = TRUE ORDER BY nome"
  ).bind(id).all<Categoria>();

  return c.json(results);
});

// Listar itens de uma subcategoria
router.get("/:id/itens", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const { results } = await c.env.DB.prepare(
    "SELECT id, nome, descricao, categoria_pai_id, tipo, setor_id, tipo_problema, ativo, created_at, updated_at FROM categorias WHERE categoria_pai_id = ? AND tipo = 'item' AND ativo = TRUE ORDER BY nome"
  ).bind(id).all<Categoria>();

  return c.json(results);
});

// Obter árvore completa de categorias
router.get("/tree", authMiddleware, async (c) => {
  const { results: categorias } = await c.env.DB.prepare(
    "SELECT * FROM categorias WHERE tipo = 'categoria' AND ativo = TRUE ORDER BY nome"
  ).all<Categoria>();

  const tree = await Promise.all(categorias.map(async (cat) => {
    const { results: subcats } = await c.env.DB.prepare(
      "SELECT * FROM categorias WHERE categoria_pai_id = ? AND tipo = 'subcategoria' AND ativo = TRUE ORDER BY nome"
    ).bind(cat.id).all<Categoria>();

    const subcategorias = await Promise.all(subcats.map(async (sub) => {
      const { results: items } = await c.env.DB.prepare(
        "SELECT * FROM categorias WHERE categoria_pai_id = ? AND tipo = 'item' AND ativo = TRUE ORDER BY nome"
      ).bind(sub.id).all<Categoria>();

      return { ...sub, itens: items };
    }));

    return { ...cat, subcategorias };
  }));

  return c.json(tree);
});

// Criar categoria/subcategoria/item
router.post("/", authMiddleware, async (c) => {
  const data = await c.req.json();

  const { nome, descricao, tipo, categoria_pai_id, setor_id } = data;

  if (!nome || !tipo) {
    return c.json({ error: "Nome e tipo são obrigatórios" }, 400);
  }

  if (!['categoria', 'subcategoria', 'item'].includes(tipo)) {
    return c.json({ error: "Tipo inválido" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO categorias (nome, descricao, tipo, categoria_pai_id, setor_id, ativo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(nome, descricao || null, tipo, categoria_pai_id || null, setor_id || null).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

// Atualizar categoria/subcategoria/item
router.put("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();

  const { nome, descricao, setor_id } = data;

  if (!nome) {
    return c.json({ error: "Nome é obrigatório" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE categorias 
     SET nome = ?, descricao = ?, setor_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(nome, descricao || null, setor_id || null, id).run();

  return c.json({ success: true });
});

// Desativar categoria/subcategoria/item
router.delete("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");

  await c.env.DB.prepare(
    `UPDATE categorias 
     SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(id).run();

  return c.json({ success: true });
});

export default router;
