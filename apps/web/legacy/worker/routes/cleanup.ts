import { Hono } from 'hono';

const app = new Hono();

// Endpoint para limpar dados de teste da produção
// Limpa: chamados, projetos, contratos e dados relacionados
// Mantém: usuários, configurações, categorias, SLAs, setores
app.post('/limpar-dados-teste', async (c) => {
  console.log('🚀 Endpoint /limpar-dados-teste chamado');
  
  try {
    console.log('📥 Lendo body da requisição...');
    const body = await c.req.json();
    console.log('📦 Body recebido:', JSON.stringify(body));
    
    const { token } = body;
    const env = c.env as any;
    
    console.log('🔐 Verificando token de segurança...');
    console.log('Token fornecido existe?', !!token);
    console.log('CLEANUP_SECRET_TOKEN existe?', !!env.CLEANUP_SECRET_TOKEN);
    
    if (!env.CLEANUP_SECRET_TOKEN) {
      console.error('❌ CLEANUP_SECRET_TOKEN não configurado no ambiente');
      return c.json({ 
        error: 'Token de limpeza não configurado',
        hint: 'Configure CLEANUP_SECRET_TOKEN em Settings → Secrets (produção)'
      }, 500);
    }
    
    if (!token) {
      console.error('❌ Token não fornecido na requisição');
      return c.json({ error: 'Token não fornecido no body' }, 400);
    }
    
    if (token !== env.CLEANUP_SECRET_TOKEN) {
      console.error('❌ Token inválido fornecido');
      console.log('Esperado (primeiros 5 chars):', env.CLEANUP_SECRET_TOKEN.substring(0, 5));
      console.log('Recebido (primeiros 5 chars):', token.substring(0, 5));
      return c.json({ error: 'Token inválido' }, 401);
    }

    const db = env.DB;
    console.log('✅ Token validado, iniciando limpeza...');
    
    console.log('🧹 Iniciando limpeza de dados de teste...');
    
    // 1. Limpar dados relacionados aos chamados
    console.log('⏳ Removendo pontos de gamificação...');
    await db.prepare('DELETE FROM gamificacao_pontos WHERE chamado_id IS NOT NULL').run();
    console.log('✓ Pontos de gamificação (chamados) removidos');
    
    console.log('⏳ Removendo notificações...');
    await db.prepare('DELETE FROM notificacoes WHERE chamado_id IS NOT NULL').run();
    console.log('✓ Notificações removidas');
    
    console.log('⏳ Removendo histórico...');
    await db.prepare('DELETE FROM historico').run();
    console.log('✓ Histórico removido');
    
    console.log('⏳ Removendo anexos...');
    await db.prepare('DELETE FROM anexos').run();
    console.log('✓ Anexos removidos');
    
    console.log('⏳ Removendo materiais de chamados...');
    await db.prepare('DELETE FROM chamado_materiais').run();
    console.log('✓ Materiais removidos');
    
    console.log('⏳ Removendo movimentações de estoque...');
    await db.prepare('DELETE FROM estoque_movimentacoes WHERE chamado_id IS NOT NULL').run();
    console.log('✓ Movimentações de estoque removidas');
    
    console.log('⏳ Removendo manutenções realizadas...');
    await db.prepare('DELETE FROM manutencoes_realizadas').run();
    console.log('✓ Manutenções realizadas removidas');
    
    console.log('⏳ Removendo conversas WhatsApp...');
    await db.prepare('DELETE FROM whatsapp_conversas').run();
    console.log('✓ Conversas WhatsApp removidas');
    
    console.log('⏳ Removendo conversas Telegram...');
    await db.prepare('DELETE FROM telegram_conversas').run();
    console.log('✓ Conversas Telegram removidas');
    
    console.log('⏳ Removendo comentários...');
    await db.prepare('DELETE FROM comentarios').run();
    console.log('✓ Comentários removidos');
    
    console.log('⏳ Removendo chamados...');
    await db.prepare('DELETE FROM chamados').run();
    console.log('✓ Chamados removidos');
    
    // 2. Limpar dados relacionados aos projetos
    console.log('⏳ Removendo pontos de gamificação (projetos)...');
    await db.prepare('DELETE FROM gamificacao_pontos WHERE projeto_id IS NOT NULL').run();
    console.log('✓ Pontos de gamificação (projetos) removidos');
    
    console.log('⏳ Removendo documentos de projeto...');
    await db.prepare('DELETE FROM projeto_documentos').run();
    console.log('✓ Documentos de projeto removidos');
    
    console.log('⏳ Removendo tarefas de projeto...');
    await db.prepare('DELETE FROM projeto_tarefas').run();
    console.log('✓ Tarefas de projeto removidas');
    
    console.log('⏳ Removendo aprovações de projeto...');
    await db.prepare('DELETE FROM projeto_aprovacoes').run();
    console.log('✓ Aprovações de projeto removidas');
    
    console.log('⏳ Removendo projetos...');
    await db.prepare('DELETE FROM projetos').run();
    console.log('✓ Projetos removidos');
    
    // 3. Limpar contratos
    console.log('⏳ Removendo contratos...');
    await db.prepare('DELETE FROM contratos').run();
    console.log('✓ Contratos removidos');
    
    console.log('🎉 Limpeza concluída com sucesso!');
    
    return c.json({ 
      success: true,
      message: 'Dados de teste removidos com sucesso',
      removido: {
        chamados: true,
        comentarios: true,
        historico: true,
        anexos: true,
        materiais: true,
        notificacoes: true,
        manutencoes: true,
        conversas: true,
        projetos: true,
        documentos: true,
        tarefas: true,
        aprovacoes: true,
        contratos: true,
        pontos: true,
        estoque: true
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao limpar dados:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
    return c.json({ 
      error: 'Erro ao limpar dados', 
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

export default app;
