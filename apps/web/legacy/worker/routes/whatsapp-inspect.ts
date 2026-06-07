import { Hono } from 'hono';

const whatsappInspect = new Hono();

whatsappInspect.post('/', async (c) => {
  const env = c.env as any;
  
  try {
    // Capturar tudo sobre a requisição
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    const method = c.req.method;
    const url = c.req.url;
    const contentType = c.req.header('content-type');
    
    let body = '';
    let formData: Record<string, string> = {};
    
    try {
      const rawBody = await c.req.text();
      body = rawBody;
      
      // Tentar parsear como form data
      if (contentType?.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(rawBody);
        params.forEach((value, key) => {
          formData[key] = value;
        });
      }
    } catch (e) {
      body = 'Erro ao ler body: ' + String(e);
    }
    
    const inspect = {
      timestamp: new Date().toISOString(),
      method,
      url,
      contentType,
      headers,
      rawBody: body.substring(0, 500),
      formData,
      hasDB: !!env.DB,
      hasTwilioSid: !!env.TWILIO_ACCOUNT_SID
    };
    
    // Salvar no banco
    await env.DB.prepare(`
      INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
      VALUES (?, ?, ?, ?, 'debug')
    `).bind('inspect', 'inspect', 'inspect', JSON.stringify(inspect)).run();
    
    return c.text('OK');
  } catch (error) {
    return c.text('ERROR: ' + String(error));
  }
});

whatsappInspect.get('/view', async (c) => {
  const env = c.env as any;
  
  const records = await env.DB.prepare(`
    SELECT * FROM whatsapp_conversas 
    WHERE telefone = 'inspect'
    ORDER BY created_at DESC
    LIMIT 5
  `).all();
  
  return c.json(records.results);
});

export default whatsappInspect;
