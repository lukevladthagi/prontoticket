import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

interface ArtigoKBAnexo {
  id: number;
  artigo_id: number;
  nome_arquivo: string;
  url: string;
  tipo_arquivo: string | null;
  tamanho: number | null;
  autor_id: string;
  created_at: string;
  updated_at: string;
}

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar anexos de um artigo
router.get("/:artigoId/anexos", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const artigoId = c.req.param("artigoId");

  // Verificar se o usuário é do setor TI (1) ou Call Center (14)
  const { results: profiles } = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();
  
  const setorId = profiles?.[0]?.setor_id as number | null;
  const setoresPermitidos = [1, 14]; // TI e Call Center
  
  if (!profiles || profiles.length === 0 || !setoresPermitidos.includes(setorId as number)) {
    return c.json({ error: "Acesso restrito" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM artigos_kb_anexos WHERE artigo_id = ? ORDER BY created_at DESC"
  ).bind(artigoId).all<ArtigoKBAnexo>();

  return c.json(results);
});

// Adicionar anexo a um artigo (apenas TI)
router.post("/:artigoId/anexos", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const artigoId = c.req.param("artigoId");
  
  // Verificar se o usuário é do setor TI
  const { results: profiles } = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();
  
  if (!profiles || profiles.length === 0 || profiles[0].setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor de TI" }, 403);
  }
  
  const body = await c.req.json();

  const result = await c.env.DB.prepare(
    `INSERT INTO artigos_kb_anexos (artigo_id, nome_arquivo, url, tipo_arquivo, tamanho, autor_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    artigoId,
    body.nome_arquivo,
    body.url,
    body.tipo_arquivo || null,
    body.tamanho || null,
    user.id
  ).run();

  const anexo = await c.env.DB.prepare(
    "SELECT * FROM artigos_kb_anexos WHERE id = ?"
  ).bind(result.meta.last_row_id).first<ArtigoKBAnexo>();

  return c.json(anexo, 201);
});

// Deletar anexo (apenas TI)
router.delete("/:artigoId/anexos/:anexoId", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const anexoId = c.req.param("anexoId");

  // Verificar se o usuário é do setor TI
  const { results: profiles } = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();
  
  if (!profiles || profiles.length === 0 || profiles[0].setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor de TI" }, 403);
  }

  await c.env.DB.prepare(
    "DELETE FROM artigos_kb_anexos WHERE id = ?"
  ).bind(anexoId).run();

  return c.json({ success: true });
});

export default router;
