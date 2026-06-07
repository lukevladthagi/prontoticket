import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { ArtigoKB } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se o usuário é do setor TI (1) ou Call Center (14)
  const { results: profiles } = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();
  
  const setorId = profiles?.[0]?.setor_id as number | null;
  const setoresPermitidos = [1, 14]; // TI e Call Center
  
  if (!profiles || profiles.length === 0 || !setoresPermitidos.includes(setorId as number)) {
    return c.json({ error: "Acesso restrito" }, 403);
  }
  
  const busca = c.req.query("q");
  const categoriaId = c.req.query("categoria_id");

  let query = "SELECT * FROM artigos_kb WHERE ativo = TRUE";
  const params: any[] = [];

  // TI (setor 1) vê todos os artigos; Call Center (14) vê apenas os do seu setor ou sem setor definido
  if (setorId === 14) {
    query += " AND (setor_id = ? OR setor_id IS NULL)";
    params.push(14);
  }

  if (busca) {
    query += " AND (titulo LIKE ? OR conteudo LIKE ? OR palavras_chave LIKE ?)";
    const searchTerm = `%${busca}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (categoriaId) {
    query += " AND categoria_id = ?";
    params.push(parseInt(categoriaId));
  }

  query += " ORDER BY visualizacoes DESC, titulo";

  const { results } = await c.env.DB.prepare(query).bind(...params).all<ArtigoKB>();

  return c.json(results);
});

router.get("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se o usuário é do setor TI (1) ou Call Center (14)
  const { results: profiles } = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();
  
  const setorId = profiles?.[0]?.setor_id as number | null;
  const setoresPermitidos = [1, 14]; // TI e Call Center
  
  if (!profiles || profiles.length === 0 || !setoresPermitidos.includes(setorId as number)) {
    return c.json({ error: "Acesso restrito" }, 403);
  }
  
  const id = c.req.param("id");

  const artigo = await c.env.DB.prepare(
    "SELECT * FROM artigos_kb WHERE id = ?"
  ).bind(id).first<ArtigoKB>();

  if (!artigo) {
    return c.json({ error: "Artigo não encontrado" }, 404);
  }

  // Call Center só pode ver artigos do seu setor ou sem setor definido
  if (setorId === 14 && artigo.setor_id && artigo.setor_id !== 14) {
    return c.json({ error: "Acesso restrito" }, 403);
  }

  // Incrementar visualizações
  await c.env.DB.prepare(
    "UPDATE artigos_kb SET visualizacoes = visualizacoes + 1 WHERE id = ?"
  ).bind(id).run();

  return c.json(artigo);
});

router.post("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se o usuário é do setor TI
  const { results: profiles } = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();
  
  if (!profiles || profiles.length === 0 || profiles[0].setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor de TI" }, 403);
  }
  
  const body = await c.req.json();

  const result = await c.env.DB.prepare(
    `INSERT INTO artigos_kb (titulo, conteudo, tipo_documento, categoria_id, palavras_chave, autor_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    body.titulo,
    body.conteudo,
    body.tipo_documento || 'Artigo',
    body.categoria_id || null,
    body.palavras_chave || null,
    user.id
  ).run();

  const artigo = await c.env.DB.prepare(
    "SELECT * FROM artigos_kb WHERE id = ?"
  ).bind(result.meta.last_row_id).first<ArtigoKB>();

  return c.json(artigo, 201);
});

router.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se o usuário é do setor TI
  const { results: profiles } = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();
  
  if (!profiles || profiles.length === 0 || profiles[0].setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor de TI" }, 403);
  }
  
  const id = c.req.param("id");
  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE artigos_kb 
     SET titulo = ?, conteudo = ?, tipo_documento = ?, palavras_chave = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    body.titulo,
    body.conteudo,
    body.tipo_documento || 'Artigo',
    body.palavras_chave || null,
    id
  ).run();

  const artigo = await c.env.DB.prepare(
    "SELECT * FROM artigos_kb WHERE id = ?"
  ).bind(id).first<ArtigoKB>();

  return c.json(artigo);
});

router.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se o usuário é do setor TI
  const { results: profiles } = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();
  
  if (!profiles || profiles.length === 0 || profiles[0].setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor de TI" }, 403);
  }
  
  const id = c.req.param("id");

  // Soft delete - marca como inativo
  await c.env.DB.prepare(
    "UPDATE artigos_kb SET ativo = FALSE WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true });
});

export default router;
