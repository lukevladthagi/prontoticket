import { Hono } from 'hono';

const whatsappTestProducao = new Hono();

// Endpoint para testar o envio direto via Twilio em produção
whatsappTestProducao.get('/test', async (c) => {
  const env = c.env as any;
  const logs: string[] = [];
  
  logs.push('=== TESTE DE PRODUÇÃO ===');
  logs.push(`Timestamp: ${new Date().toISOString()}`);
  
  // 1. Verificar secrets
  logs.push('\n--- SECRETS ---');
  logs.push(`TWILIO_ACCOUNT_SID: ${env.TWILIO_ACCOUNT_SID ? '✓ CONFIGURADO' : '✗ FALTANDO'}`);
  logs.push(`TWILIO_AUTH_TOKEN: ${env.TWILIO_AUTH_TOKEN ? '✓ CONFIGURADO' : '✗ FALTANDO'}`);
  logs.push(`TWILIO_WHATSAPP_NUMBER: ${env.TWILIO_WHATSAPP_NUMBER || '✗ FALTANDO'}`);
  logs.push(`OPENAI_API_KEY: ${env.OPENAI_API_KEY ? '✓ CONFIGURADO' : '✗ FALTANDO'}`);
  
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_NUMBER) {
    return c.json({ 
      success: false, 
      error: 'Secrets do Twilio não configurados',
      logs 
    });
  }
  
  // 2. Testar banco de dados
  logs.push('\n--- BANCO DE DADOS ---');
  try {
    const tables = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all();
    logs.push(`Tabelas encontradas: ${tables.results.length}`);
    const hasWhatsappTable = tables.results.some((t: any) => t.name === 'whatsapp_conversas');
    logs.push(`Tabela whatsapp_conversas: ${hasWhatsappTable ? '✓ EXISTE' : '✗ NÃO EXISTE'}`);
  } catch (error) {
    logs.push(`Erro ao verificar banco: ${error}`);
  }
  
  // 3. Testar envio de mensagem via Twilio
  logs.push('\n--- TESTE DE ENVIO ---');
  const testPhone = c.req.query('phone') || '+558592744114';
  const to = testPhone.startsWith('whatsapp:') ? testPhone : `whatsapp:${testPhone}`;
  
  try {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const from = env.TWILIO_WHATSAPP_NUMBER;
    
    logs.push(`De: ${from}`);
    logs.push(`Para: ${to}`);
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: `✅ Teste de produção bem-sucedido!\nTimestamp: ${new Date().toISOString()}`
      })
    });
    
    logs.push(`Status HTTP: ${response.status}`);
    
    const result = await response.json();
    
    if (response.ok) {
      logs.push(`✓ Mensagem enviada com sucesso!`);
      logs.push(`SID: ${(result as any).sid}`);
    } else {
      logs.push(`✗ Erro ao enviar mensagem`);
      logs.push(`Código: ${(result as any).code}`);
      logs.push(`Mensagem: ${(result as any).message}`);
    }
    
    return c.json({ 
      success: response.ok, 
      twilioResponse: result,
      logs 
    });
    
  } catch (error) {
    logs.push(`✗ Exceção durante envio: ${error}`);
    return c.json({ 
      success: false, 
      error: String(error),
      logs 
    });
  }
});

export default whatsappTestProducao;
