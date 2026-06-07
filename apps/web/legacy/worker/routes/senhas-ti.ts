import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { UserProfile } from "../../shared/types";

interface SenhaTI {
  id: number;
  titulo: string;
  categoria: string;
  usuario: string | null;
  senha: string;
  url: string | null;
  observacoes: string | null;
  criador_id: string;
  criador_nome: string;
  created_at: string;
  updated_at: string;
}

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Middleware para verificar se o usuário tem acesso ao gerenciador de senhas
async function verificarAcesso(c: any): Promise<boolean> {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first() as UserProfile | null;

  // Apenas membros do setor TI (setor_id = 1)
  return profile !== null && profile.setor_id === 1;
}

// Listar todas as senhas
router.get("/", authMiddleware, async (c) => {
  if (!await verificarAcesso(c)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM senhas_ti ORDER BY categoria, titulo"
  ).all();

  return c.json(results);
});

// Buscar senha específica
router.get("/:id", authMiddleware, async (c) => {
  if (!await verificarAcesso(c)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const id = c.req.param("id");

  const senha = await c.env.DB.prepare(
    "SELECT * FROM senhas_ti WHERE id = ?"
  ).bind(id).first() as SenhaTI | null;

  if (!senha) {
    return c.json({ error: "Senha não encontrada" }, 404);
  }

  return c.json(senha);
});

// Criar nova senha
router.post("/", authMiddleware, async (c) => {
  if (!await verificarAcesso(c)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first() as UserProfile | null;

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  const body = await c.req.json();

  const result = await c.env.DB.prepare(
    `INSERT INTO senhas_ti (
      titulo, categoria, usuario, senha, url, observacoes, criador_id, criador_nome
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.titulo,
    body.categoria,
    body.usuario || null,
    body.senha,
    body.url || null,
    body.observacoes || null,
    user.id,
    profile.nome
  ).run();

  const senha = await c.env.DB.prepare(
    "SELECT * FROM senhas_ti WHERE id = ?"
  ).bind(result.meta.last_row_id).first() as SenhaTI | null;

  return c.json(senha, 201);
});

// Atualizar senha
router.put("/:id", authMiddleware, async (c) => {
  if (!await verificarAcesso(c)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const id = c.req.param("id");
  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE senhas_ti SET 
      titulo = ?, categoria = ?, usuario = ?, senha = ?, 
      url = ?, observacoes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    body.titulo,
    body.categoria,
    body.usuario || null,
    body.senha,
    body.url || null,
    body.observacoes || null,
    id
  ).run();

  const senha = await c.env.DB.prepare(
    "SELECT * FROM senhas_ti WHERE id = ?"
  ).bind(id).first() as SenhaTI | null;

  return c.json(senha);
});

// Deletar senha
router.delete("/:id", authMiddleware, async (c) => {
  if (!await verificarAcesso(c)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const id = c.req.param("id");

  await c.env.DB.prepare("DELETE FROM senhas_ti WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

export default router;
