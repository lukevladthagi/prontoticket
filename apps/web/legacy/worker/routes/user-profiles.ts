import { Hono } from 'hono';
import { authMiddleware } from '@getmocha/users-service/backend';
import type { MochaUser } from '@getmocha/users-service/shared';
import type { UserProfile } from '../../shared/types';

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar todos os usuários do sistema (admin, gestor) ou técnicos (para transferência)
router.get('/', authMiddleware, async (c) => {
  const currentUser = c.get('user')!;
  const db = c.env.DB;

  // Verificar se o usuário atual é gestor, admin ou técnico
  const currentProfile = await db.prepare(
    'SELECT perfil FROM user_profiles WHERE user_id = ?'
  ).bind(currentUser.id).first() as UserProfile | null;

  if (!currentProfile) {
    return c.json({ error: 'Perfil não encontrado' }, 404);
  }

  // Solicitantes não podem acessar lista de usuários
  if (currentProfile.perfil === 'solicitante') {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  try {
    // Buscar setores primeiro
    const setoresResult = await db.prepare('SELECT id, nome FROM setores').all();
    const setoresMap = new Map();
    if (setoresResult.results) {
      setoresResult.results.forEach((s: any) => {
        setoresMap.set(s.id, s.nome);
      });
    }

    // Admin, gestores e técnicos veem todos os usuários
    const usuarios = await db.prepare(
      'SELECT * FROM user_profiles ORDER BY nome, email'
    ).all();

    // Adicionar nome do setor a cada usuário
    const usuariosComSetor = usuarios.results.map((u: any) => ({
      ...u,
      setor_nome: u.setor_id ? setoresMap.get(u.setor_id) : null
    }));

    return c.json(usuariosComSetor);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return c.json({ error: 'Erro ao listar usuários' }, 500);
  }
});

// Obter perfil do usuário logado
router.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  const profile = await db.prepare(
    'SELECT * FROM user_profiles WHERE user_id = ?'
  ).bind(user.id).first<UserProfile>();
  
  if (!profile) {
    return c.json({ error: 'Perfil não encontrado' }, 404);
  }
  
  // Buscar nome do setor se setor_id estiver presente
  let setor_nome = null;
  if (profile.setor_id) {
    const setor = await db.prepare(
      'SELECT nome FROM setores WHERE id = ?'
    ).bind(profile.setor_id).first<{ nome: string }>();
    
    if (setor) {
      setor_nome = setor.nome;
    }
  }
  
  return c.json({ ...profile, setor_nome });
});

// Atualizar perfil do usuário logado
router.put('/me', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{
    telefone?: string;
    setor?: string;
    unidade_id?: number;
  }>();
  
  await c.env.DB.prepare(
    `UPDATE user_profiles 
     SET telefone = ?, setor = ?, unidade_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).bind(
    body.telefone || null,
    body.setor || null,
    body.unidade_id || null,
    user.id
  ).run();
  
  const updated = await c.env.DB.prepare(
    'SELECT * FROM user_profiles WHERE user_id = ?'
  ).bind(user.id).first<UserProfile>();
  
  return c.json(updated);
});

// Gerar código de vinculação do Telegram
router.post('/me/telegram-link-code', authMiddleware, async (c) => {
  const user = c.get('user')!;
  
  // Gerar código de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Código expira em 10 minutos
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  
  await c.env.DB.prepare(
    `UPDATE user_profiles 
     SET telegram_link_code = ?, telegram_link_expires_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).bind(code, expiresAt, user.id).run();
  
  return c.json({ code, expires_at: expiresAt });
});

// Desvincular Telegram
router.delete('/me/telegram', authMiddleware, async (c) => {
  const user = c.get('user')!;
  
  await c.env.DB.prepare(
    `UPDATE user_profiles 
     SET telegram_user_id = NULL, telegram_username = NULL, 
         telegram_link_code = NULL, telegram_link_expires_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).bind(user.id).run();
  
  return c.json({ success: true });
});

// Atualizar perfil de outro usuário (admin/gestor only)
router.put('/:id', authMiddleware, async (c) => {
  const currentUser = c.get('user')!;
  const targetUserId = c.req.param('id');
  const db = c.env.DB;

  // Verificar se o usuário atual é gestor, admin ou técnico
  const currentProfile = await db.prepare(
    'SELECT perfil FROM user_profiles WHERE user_id = ?'
  ).bind(currentUser.id).first() as UserProfile | null;

  if (!currentProfile || (currentProfile.perfil !== 'admin' && currentProfile.perfil !== 'gestor' && currentProfile.perfil !== 'tecnico')) {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  const body = await c.req.json<{
    nome?: string;
    perfil?: string;
    unidade_id?: number | null;
    setor_id?: number | null;
    ativo?: boolean;
  }>();

  try {
    // Build update fields dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.nome !== undefined) {
      updates.push('nome = ?');
      values.push(body.nome);
    }
    if (body.perfil !== undefined) {
      updates.push('perfil = ?');
      values.push(body.perfil);
    }
    if (body.unidade_id !== undefined) {
      updates.push('unidade_id = ?');
      values.push(body.unidade_id);
    }
    if (body.setor_id !== undefined) {
      updates.push('setor_id = ?');
      values.push(body.setor_id);
    }
    if (body.ativo !== undefined) {
      updates.push('ativo = ?');
      values.push(body.ativo ? 1 : 0);
    }

    if (updates.length === 0) {
      return c.json({ error: 'Nenhum campo para atualizar' }, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(targetUserId);

    console.log('🔄 Atualizando usuário:', targetUserId);
    console.log('📝 Campos a atualizar:', updates);
    console.log('💾 Valores:', values);
    
    const result = await db.prepare(
      `UPDATE user_profiles SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    console.log('✅ Update result:', result);

    const updated = await db.prepare(
      'SELECT * FROM user_profiles WHERE id = ?'
    ).bind(targetUserId).first<UserProfile>();

    console.log('📊 Usuário atualizado:', updated);

    return c.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return c.json({ error: 'Erro ao atualizar usuário' }, 500);
  }
});

export default router;
