import { Hono } from 'hono';

const whatsappSimple = new Hono();

// Endpoint super simples para testar se Twilio consegue acessar
whatsappSimple.post('/', async (c) => {
  console.log('[WhatsApp-Simple] ===== WEBHOOK RECEBIDO =====');
  console.log('[WhatsApp-Simple] Método:', c.req.method);
  console.log('[WhatsApp-Simple] URL:', c.req.url);
  
  const env = c.env as any;
  
  // Gravar no banco
  try {
    const formData = await c.req.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    
    console.log('[WhatsApp-Simple] From:', from);
    console.log('[WhatsApp-Simple] Body:', body);
    
    await env.DB.prepare(`
      INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
      VALUES (?, ?, ?, ?, 'debug')
    `).bind(from || 'unknown', from || 'unknown', from || 'unknown', `SIMPLE: ${body || 'no body'}`).run();
    
    console.log('[WhatsApp-Simple] Salvo no banco');
  } catch (error) {
    console.error('[WhatsApp-Simple] Erro:', error);
  }
  
  return c.text('OK');
});

export default whatsappSimple;
