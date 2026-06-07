import { Hono } from 'hono';

const whatsappDiag = new Hono();

// Endpoint de diagnóstico detalhado
whatsappDiag.post('/webhook-debug', async (c) => {
  const env = c.env as any;
  
  try {
    // Capturar tudo
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    const formData = await c.req.formData();
    const formDataObj: Record<string, any> = {};
    formData.forEach((value, key) => {
      formDataObj[key] = value;
    });
    
    // Salvar diagnóstico no banco
    const diagnostico = {
      timestamp: new Date().toISOString(),
      headers,
      formData: formDataObj,
      url: c.req.url,
      method: c.req.method
    };
    
    console.log('[WhatsApp Debug] Recebido:', JSON.stringify(diagnostico, null, 2));
    
    // Tentar salvar no banco
    try {
      await env.DB.prepare(`
        INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
        VALUES ('DEBUG', 'DEBUG', 'DEBUG', ?, 'sistema')
      `).bind(JSON.stringify(diagnostico)).run();
      
      console.log('[WhatsApp Debug] Salvo no banco');
    } catch (dbError) {
      console.error('[WhatsApp Debug] Erro ao salvar no banco:', dbError);
    }
    
    // Retornar diagnóstico completo
    return c.json({
      success: true,
      message: 'Diagnóstico capturado',
      data: diagnostico,
      env_check: {
        has_db: !!env.DB,
        has_twilio_sid: !!env.TWILIO_ACCOUNT_SID,
        has_twilio_token: !!env.TWILIO_AUTH_TOKEN,
        has_twilio_number: !!env.TWILIO_WHATSAPP_NUMBER
      }
    });
    
  } catch (error) {
    console.error('[WhatsApp Debug] ERRO:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 200); // Retornar 200 para não bloquear Twilio
  }
});

// Endpoint para ver últimos diagnósticos
whatsappDiag.get('/debug-logs', async (c) => {
  const env = c.env as any;
  
  try {
    const logs = await env.DB.prepare(`
      SELECT * FROM whatsapp_conversas 
      WHERE telefone = 'DEBUG' 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all();
    
    return c.json({
      success: true,
      logs: logs.results.map((log: any) => ({
        timestamp: log.created_at,
        data: JSON.parse(log.mensagem)
      }))
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint para verificar mensagens recentes no banco
whatsappDiag.get('/check-database', async (c) => {
  const env = c.env as any;
  
  try {
    // Buscar últimas 20 mensagens
    const mensagens = await env.DB.prepare(`
      SELECT telefone, phone_number, mensagem, tipo, created_at, chamado_id
      FROM whatsapp_conversas 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all();
    
    // Contar total de mensagens
    const total = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM whatsapp_conversas
    `).first();
    
    return c.json({
      success: true,
      total_messages: total?.total || 0,
      recent_messages: mensagens.results
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

export default whatsappDiag;
