import { Hono } from 'hono';

const debug = new Hono();

// Armazenar últimos webhooks recebidos em memória (em produção isso seria efêmero)
let ultimosWebhooks: any[] = [];

// Capturar webhook bruto
debug.post('/capture', async (c) => {
  const env = c.env as any;
  
  try {
    const formData = await c.req.formData();
    const data: any = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    
    const registro = {
      timestamp: new Date().toISOString(),
      data: data,
      env_check: {
        has_db: !!env.DB,
        has_twilio_sid: !!env.TWILIO_ACCOUNT_SID,
        has_twilio_token: !!env.TWILIO_AUTH_TOKEN,
        has_twilio_number: !!env.TWILIO_WHATSAPP_NUMBER,
        twilio_number_value: env.TWILIO_WHATSAPP_NUMBER
      }
    };
    
    ultimosWebhooks.unshift(registro);
    if (ultimosWebhooks.length > 10) {
      ultimosWebhooks = ultimosWebhooks.slice(0, 10);
    }
    
    console.log('[Debug] Webhook capturado:', registro);
    
    return c.json({ status: 'captured', data: registro });
  } catch (error) {
    console.error('[Debug] Erro ao capturar webhook:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Ver webhooks capturados
debug.get('/view', async (c) => {
  return c.json({
    count: ultimosWebhooks.length,
    webhooks: ultimosWebhooks
  });
});

// Limpar cache
debug.post('/clear', async (c) => {
  ultimosWebhooks = [];
  return c.json({ status: 'cleared' });
});

export default debug;
