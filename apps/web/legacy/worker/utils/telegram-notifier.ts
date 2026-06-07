/**
 * Utility para enviar notificações via Telegram
 */

export async function enviarNotificacaoTelegram(
  env: Env,
  userId: string,
  mensagem: string
): Promise<boolean> {
  try {
    // Buscar telegram_user_id do usuário
    const profile = await env.DB.prepare(
      "SELECT telegram_user_id FROM user_profiles WHERE user_id = ?"
    ).bind(userId).first<{ telegram_user_id: string | null }>();

    if (!profile?.telegram_user_id || !env.TELEGRAM_BOT_TOKEN) {
      console.log('Usuário não tem Telegram configurado ou bot token ausente');
      return false;
    }

    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: profile.telegram_user_id,
        text: mensagem,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Erro ao enviar mensagem Telegram:', error);
      return false;
    }

    console.log(`Notificação Telegram enviada para usuário ${userId}`);
    return true;
  } catch (error) {
    console.error('Erro ao enviar notificação Telegram:', error);
    return false;
  }
}

/**
 * Envia notificação para o chat do Telegram onde o chamado foi criado
 */
export async function enviarNotificacaoChatTelegram(
  env: Env,
  chamadoId: number,
  mensagem: string
): Promise<boolean> {
  try {
    // Buscar telegram_chat_id do chamado
    const chamado = await env.DB.prepare(
      "SELECT telegram_chat_id FROM chamados WHERE id = ?"
    ).bind(chamadoId).first<{ telegram_chat_id: string | null }>();

    if (!chamado?.telegram_chat_id || !env.TELEGRAM_BOT_TOKEN) {
      console.log('Chamado não foi criado via Telegram ou bot token ausente');
      return false;
    }

    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chamado.telegram_chat_id,
        text: mensagem,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Erro ao enviar mensagem Telegram:', error);
      return false;
    }

    console.log(`Notificação Telegram enviada para chat do chamado ${chamadoId}`);
    return true;
  } catch (error) {
    console.error('Erro ao enviar notificação Telegram:', error);
    return false;
  }
}
