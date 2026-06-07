import { Hono } from 'hono';
import { authMiddleware } from '@getmocha/users-service/backend';
import type { MochaUser } from '@getmocha/users-service/shared';

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar setores adicionais de um usuário
router.get('/:userProfileId', authMiddleware, async (c) => {
  const currentUser = c.get('user')!;
  const userProfileId = c.req.param('userProfileId');
  const db = c.env.DB;

  // Verificar permissão
  const currentProfile = await db.prepare(
    'SELECT perfil FROM user_profiles WHERE user_id = ?'
  ).bind(currentUser.id).first<{ perfil: string }>();

  if (!currentProfile || (currentProfile.perfil !== 'admin' && currentProfile.perfil !== 'gestor')) {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  const setoresAdicionais = await db.prepare(
    `SELECT usa.id, usa.setor_id, s.nome as setor_nome
     FROM user_setores_acesso usa
     LEFT JOIN setores s ON s.id = usa.setor_id
     WHERE usa.user_profile_id = ?`
  ).bind(userProfileId).all();

  return c.json(setoresAdicionais.results || []);
});

// Adicionar setor adicional para um usuário
router.post('/:userProfileId', authMiddleware, async (c) => {
  const currentUser = c.get('user')!;
  const userProfileId = c.req.param('userProfileId');
  const { setor_id } = await c.req.json<{ setor_id: number }>();
  const db = c.env.DB;

  // Verificar permissão
  const currentProfile = await db.prepare(
    'SELECT perfil FROM user_profiles WHERE user_id = ?'
  ).bind(currentUser.id).first<{ perfil: string }>();

  if (!currentProfile || (currentProfile.perfil !== 'admin' && currentProfile.perfil !== 'gestor')) {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  // Verificar se já existe
  const existe = await db.prepare(
    'SELECT id FROM user_setores_acesso WHERE user_profile_id = ? AND setor_id = ?'
  ).bind(userProfileId, setor_id).first();

  if (existe) {
    return c.json({ error: 'Setor já adicionado para este usuário' }, 400);
  }

  // Inserir
  await db.prepare(
    `INSERT INTO user_setores_acesso (user_profile_id, setor_id, created_at, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(userProfileId, setor_id).run();

  const novo = await db.prepare(
    `SELECT usa.id, usa.setor_id, s.nome as setor_nome
     FROM user_setores_acesso usa
     LEFT JOIN setores s ON s.id = usa.setor_id
     WHERE usa.user_profile_id = ? AND usa.setor_id = ?`
  ).bind(userProfileId, setor_id).first();

  return c.json(novo);
});

// Remover setor adicional de um usuário
router.delete('/:userProfileId/:id', authMiddleware, async (c) => {
  const currentUser = c.get('user')!;
  const id = c.req.param('id');
  const db = c.env.DB;

  // Verificar permissão
  const currentProfile = await db.prepare(
    'SELECT perfil FROM user_profiles WHERE user_id = ?'
  ).bind(currentUser.id).first<{ perfil: string }>();

  if (!currentProfile || (currentProfile.perfil !== 'admin' && currentProfile.perfil !== 'gestor')) {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  await db.prepare('DELETE FROM user_setores_acesso WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});

export default router;
