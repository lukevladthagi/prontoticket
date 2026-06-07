import { Hono } from 'hono';

const whatsappSimpleTest = new Hono();

// Teste direto de envio de mensagem via Twilio
whatsappSimpleTest.get('/send', async (c) => {
  const env = c.env as any;
  const phone = c.req.query('phone');
  
  try {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const from = env.TWILIO_WHATSAPP_NUMBER;
    
    // Verificar secrets e parâmetros
    if (!phone) return c.json({ error: 'Parâmetro phone é obrigatório' });
    if (!accountSid) return c.json({ error: 'TWILIO_ACCOUNT_SID não configurado' });
    if (!authToken) return c.json({ error: 'TWILIO_AUTH_TOKEN não configurado' });
    if (!from) return c.json({ error: 'TWILIO_WHATSAPP_NUMBER não configurado' });
    
    const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);
    
    console.log('[Test] Enviando de:', from, 'para:', to);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: 'Teste direto da API Twilio - se você recebeu isso, o sistema está funcionando!'
      })
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
    
    return c.json({ 
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      from,
      to,
      result
    });
    
  } catch (error) {
    return c.json({ 
      error: String(error),
      message: error instanceof Error ? error.message : undefined,
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

export default whatsappSimpleTest;
