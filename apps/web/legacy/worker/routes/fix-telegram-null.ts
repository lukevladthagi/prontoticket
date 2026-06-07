import { Hono } from 'hono';
import { authMiddleware } from '@getmocha/users-service/backend';
import type { MochaUser } from '@getmocha/users-service/shared';

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Corrigir telegram_user_id com valor "null" (string) para NULL real
router.post('/corrigir', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  // Verificar se é admin
  const profile = await db.prepare(
    'SELECT perfil FROM user_profiles WHERE user_id = ?'
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil !== 'admin') {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  try {
    // Buscar usuários com telegram_user_id = 'null' (string)
    const usuariosComProblema = await db.prepare(
      `SELECT id, nome, email, telegram_user_id 
       FROM user_profiles 
       WHERE telegram_user_id = 'null'`
    ).all();

    console.log('Usuários encontrados com telegram_user_id = "null":', usuariosComProblema.results);

    // Corrigir cada usuário
    for (const usuario of usuariosComProblema.results) {
      await db.prepare(
        `UPDATE user_profiles 
         SET telegram_user_id = NULL, 
             telegram_username = NULL,
             telegram_link_code = NULL,
             telegram_link_expires_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind((usuario as any).id).run();
    }

    // Verificar resultado
    const verificacao = await db.prepare(
      `SELECT id, nome, email, telegram_user_id 
       FROM user_profiles 
       WHERE nome LIKE '%Lucas%' OR nome LIKE '%Marins%'`
    ).all();

    return c.json({
      success: true,
      usuariosCorrigidos: usuariosComProblema.results?.length || 0,
      verificacao: verificacao.results
    });
  } catch (error) {
    console.error('Erro ao corrigir telegram_user_id:', error);
    return c.json({ 
      error: 'Erro ao corrigir dados',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Diagnóstico
router.get('/diagnostico', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  // Verificar se é admin
  const profile = await db.prepare(
    'SELECT perfil FROM user_profiles WHERE user_id = ?'
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil !== 'admin') {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  try {
    // Buscar todos os usuários e seus valores de telegram_user_id
    const usuarios = await db.prepare(
      `SELECT id, nome, email, perfil, ativo, telegram_user_id,
       CASE 
         WHEN telegram_user_id IS NULL THEN 'SQL NULL'
         WHEN telegram_user_id = 'null' THEN 'STRING null'
         WHEN telegram_user_id = '' THEN 'EMPTY STRING'
         ELSE 'VALUE: ' || telegram_user_id
       END as diagnostic
       FROM user_profiles
       WHERE perfil IN ('admin', 'gestor', 'tecnico')
       ORDER BY nome`
    ).all();

    return c.json({
      total: usuarios.results?.length || 0,
      usuarios: usuarios.results
    });
  } catch (error) {
    console.error('Erro no diagnóstico:', error);
    return c.json({ 
      error: 'Erro ao buscar dados',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default router;
