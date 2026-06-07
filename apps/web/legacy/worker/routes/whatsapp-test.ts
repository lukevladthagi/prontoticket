import { Hono } from 'hono';

const whatsappTest = new Hono();

// Teste simples de envio de mensagem WhatsApp
whatsappTest.post('/test-send', async (c) => {
  const env = c.env as any;
  const { to, message } = await c.req.json();
  
  console.log('[Test] Tentando enviar para:', to);
  console.log('[Test] Mensagem:', message);
  
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_NUMBER) {
    return c.json({ error: 'Secrets não configurados' }, 400);
  }
  
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_WHATSAPP_NUMBER;
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  try {
    const auth = btoa(`${accountSid}:${authToken}`);
    
    console.log('[Test] Fazendo request para Twilio...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: message
      })
    });

    const result = await response.json();
    console.log('[Test] Status:', response.status);
    console.log('[Test] Result:', JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      return c.json({ 
        error: 'Erro do Twilio',
        status: response.status,
        details: result
      }, 400);
    }
    
    return c.json({ 
      success: true,
      sid: (result as any).sid,
      status: (result as any).status
    });
  } catch (error) {
    console.error('[Test] Erro:', error);
    return c.json({ 
      error: 'Erro ao enviar',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default whatsappTest;
