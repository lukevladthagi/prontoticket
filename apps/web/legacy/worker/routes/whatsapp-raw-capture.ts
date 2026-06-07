import { Hono } from 'hono';

const whatsappRawCapture = new Hono();

// Array para armazenar os últimos webhooks recebidos
const recentWebhooks: any[] = [];

// Endpoint que captura exatamente o que o Twilio envia
whatsappRawCapture.post('/capture', async (c) => {
  const env = c.env as any;
  
  try {
    const formData = await c.req.formData();
    
    // Extrair todos os dados
    const allData: any = {};
    for (const [key, value] of formData.entries()) {
      allData[key] = value;
    }
    
    // Salvar no array (manter só os últimos 10)
    recentWebhooks.unshift({
      timestamp: new Date().toISOString(),
      data: allData,
      headers: Object.fromEntries(c.req.raw.headers.entries())
    });
    
    if (recentWebhooks.length > 10) {
      recentWebhooks.pop();
    }
    
    // Salvar no banco também
    try {
      await env.DB.prepare(`
        INSERT INTO whatsapp_conversas (
          telefone, chat_id, phone_number, mensagem, tipo
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        allData.From || 'unknown',
        'raw_capture',
        allData.From || 'unknown',
        JSON.stringify(allData),
        'debug'
      ).run();
    } catch (dbError) {
      console.error('Erro ao salvar no banco:', dbError);
    }
    
    return c.text('OK');
  } catch (error) {
    console.error('Erro no raw capture:', error);
    return c.text('OK');
  }
});

// Endpoint para ver os dados capturados
whatsappRawCapture.get('/view', async (c) => {
  return c.json({
    total: recentWebhooks.length,
    webhooks: recentWebhooks
  });
});

export default whatsappRawCapture;
