import { Hono } from 'hono';
import { authMiddleware } from '@getmocha/users-service/backend';
import type { MochaUser } from '@getmocha/users-service/shared';

const auth = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Vincular usuário do Telegram ao Google após login
auth.post('/link-telegram', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { telegram_user_id } = await c.req.json();

    if (!telegram_user_id) {
      return c.json({ error: 'telegram_user_id é obrigatório' }, 400);
    }

    // Verificar se já existe perfil com esse telegram_user_id
    const existingProfile = await c.env.DB.prepare(`
      SELECT * FROM user_profiles WHERE telegram_user_id = ?
    `).bind(telegram_user_id).first();

    if (!existingProfile) {
      return c.json({ error: 'Perfil do Telegram não encontrado' }, 404);
    }

    // Verificar se já existe perfil para este user_id do Google
    const googleProfile = await c.env.DB.prepare(`
      SELECT * FROM user_profiles WHERE user_id = ?
    `).bind(user!.id).first();

    if (googleProfile) {
      // Se já tem perfil Google, vincular o telegram_user_id nele
      await c.env.DB.prepare(`
        UPDATE user_profiles 
        SET telegram_user_id = ?, telegram_username = ?
        WHERE user_id = ?
      `).bind(
        telegram_user_id,
        existingProfile.telegram_username,
        user!.id
      ).run();

      // Transferir chamados do perfil Telegram para o perfil Google
      await c.env.DB.prepare(`
        UPDATE chamados 
        SET solicitante_id = ?
        WHERE solicitante_id = ?
      `).bind(user!.id, existingProfile.user_id).run();

      // Deletar perfil temporário do Telegram
      await c.env.DB.prepare(`
        DELETE FROM user_profiles WHERE id = ?
      `).bind(existingProfile.id).run();
    } else {
      // Se não tem perfil Google, atualizar o perfil do Telegram com user_id do Google
      await c.env.DB.prepare(`
        UPDATE user_profiles 
        SET user_id = ?, email = ?, nome = ?
        WHERE telegram_user_id = ?
      `).bind(
        user!.id,
        user!.email,
        user!.google_user_data.name || user!.google_user_data.given_name || existingProfile.nome,
        telegram_user_id
      ).run();
    }

    return c.json({ success: true, message: 'Conta vinculada com sucesso' });
  } catch (error) {
    console.error('Erro ao vincular Telegram:', error);
    return c.json({ error: 'Erro ao vincular conta' }, 500);
  }
});

// Vincular usuário do WhatsApp ao Google após login
auth.post('/link-whatsapp', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { whatsapp_phone } = await c.req.json();

    if (!whatsapp_phone) {
      return c.json({ error: 'whatsapp_phone é obrigatório' }, 400);
    }

    // Verificar se já existe perfil com esse whatsapp_phone
    const existingProfile = await c.env.DB.prepare(`
      SELECT * FROM user_profiles WHERE whatsapp_phone = ?
    `).bind(whatsapp_phone).first();

    if (!existingProfile) {
      return c.json({ error: 'Perfil do WhatsApp não encontrado' }, 404);
    }

    // Verificar se já existe perfil para este user_id do Google
    const googleProfile = await c.env.DB.prepare(`
      SELECT * FROM user_profiles WHERE user_id = ?
    `).bind(user!.id).first();

    if (googleProfile) {
      // Se já tem perfil Google, vincular o whatsapp_phone nele
      await c.env.DB.prepare(`
        UPDATE user_profiles 
        SET whatsapp_phone = ?
        WHERE user_id = ?
      `).bind(
        whatsapp_phone,
        user!.id
      ).run();

      // Transferir chamados do perfil WhatsApp para o perfil Google
      await c.env.DB.prepare(`
        UPDATE chamados 
        SET solicitante_id = ?
        WHERE solicitante_id = ?
      `).bind(user!.id, existingProfile.user_id).run();

      // Deletar perfil temporário do WhatsApp
      await c.env.DB.prepare(`
        DELETE FROM user_profiles WHERE id = ?
      `).bind(existingProfile.id).run();
    } else {
      // Se não tem perfil Google, atualizar o perfil do WhatsApp com user_id do Google
      await c.env.DB.prepare(`
        UPDATE user_profiles 
        SET user_id = ?, email = ?, nome = ?
        WHERE whatsapp_phone = ?
      `).bind(
        user!.id,
        user!.email,
        user!.google_user_data.name || user!.google_user_data.given_name || existingProfile.nome,
        whatsapp_phone
      ).run();
    }

    return c.json({ success: true, message: 'Conta vinculada com sucesso' });
  } catch (error) {
    console.error('Erro ao vincular WhatsApp:', error);
    return c.json({ error: 'Erro ao vincular conta' }, 500);
  }
});

// Verificar se usuário tem Telegram vinculado
auth.get('/telegram-status', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    const profile = await c.env.DB.prepare(`
      SELECT telegram_user_id, telegram_username FROM user_profiles WHERE user_id = ?
    `).bind(user!.id).first();

    if (!profile) {
      return c.json({ linked: false });
    }

    return c.json({
      linked: !!profile.telegram_user_id,
      telegram_username: profile.telegram_username
    });
  } catch (error) {
    console.error('Erro ao verificar status do Telegram:', error);
    return c.json({ error: 'Erro ao verificar status' }, 500);
  }
});

// Verificar se usuário tem WhatsApp vinculado
auth.get('/whatsapp-status', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    const profile = await c.env.DB.prepare(`
      SELECT whatsapp_phone FROM user_profiles WHERE user_id = ?
    `).bind(user!.id).first();

    if (!profile) {
      return c.json({ linked: false });
    }

    return c.json({
      linked: !!profile.whatsapp_phone,
      whatsapp_phone: profile.whatsapp_phone
    });
  } catch (error) {
    console.error('Erro ao verificar status do WhatsApp:', error);
    return c.json({ error: 'Erro ao verificar status' }, 500);
  }
});

export default auth;
