import { Hono } from 'hono';

const telegramMessages = new Hono<{ Bindings: Env }>();

// Enviar mensagem para usuário no Telegram
telegramMessages.post('/:chamadoId/enviar', async (c) => {
  try {
    const chamadoId = c.req.param('chamadoId');
    const { mensagem } = await c.req.json();

    if (!mensagem) {
      return c.json({ error: 'Mensagem é obrigatória' }, 400);
    }

    // Buscar o telegram_chat_id do chamado
    const chamado = await c.env.DB.prepare(`
      SELECT telegram_chat_id FROM chamados WHERE id = ?
    `).bind(chamadoId).first();

    if (!chamado) {
      return c.json({ error: 'Chamado não encontrado' }, 404);
    }

    if (!chamado.telegram_chat_id) {
      return c.json({ error: 'Este chamado não foi criado via Telegram' }, 400);
    }

    // Enviar mensagem via Telegram Bot API
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chamado.telegram_chat_id,
        text: mensagem,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erro ao enviar mensagem Telegram:', result);
      return c.json({ error: 'Erro ao enviar mensagem', details: result }, 500);
    }

    return c.json({ success: true, message: 'Mensagem enviada com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return c.json({ error: 'Erro interno ao enviar mensagem' }, 500);
  }
});

// Buscar histórico de mensagens do Telegram para um chamado
telegramMessages.get('/:chamadoId/historico', async (c) => {
  // Funcionalidade temporariamente desabilitada
  return c.json({ messages: [] });
});

export default telegramMessages;
