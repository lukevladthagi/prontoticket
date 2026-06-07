import { Hono } from "hono";

const cronRouter = new Hono<{ Bindings: Env }>();

// Middleware para verificar token secreto
const verificarToken = async (c: any, next: any) => {
  const token = c.req.header('X-Cron-Token') || c.req.query('token');
  const secretToken = c.env.CRON_SECRET_TOKEN;

  if (!secretToken) {
    return c.json({ 
      error: 'Token de cron não configurado. Configure o secret CRON_SECRET_TOKEN nas configurações do app.' 
    }, 500);
  }

  if (!token || token !== secretToken) {
    return c.json({ error: 'Token inválido ou ausente' }, 401);
  }

  await next();
};

// Middleware específico para fechamento de tickets
const verificarTokenFechar = async (c: any, next: any) => {
  const token = c.req.header('X-Cron-Token') || c.req.query('token');
  const secretToken = c.env.CRON_SECRET_FECHAR;

  if (!secretToken) {
    return c.json({ 
      error: 'Token de fechamento não configurado. Configure o secret CRON_SECRET_FECHAR nas configurações do app.' 
    }, 500);
  }

  if (!token || token !== secretToken) {
    return c.json({ error: 'Token inválido ou ausente' }, 401);
  }

  await next();
};

// Endpoint para processar chamados recorrentes
cronRouter.get("/processar-recorrentes", verificarToken, async (c) => {
  try {
    const { processarChamadosRecorrentes } = await import('../scheduled');
    await processarChamadosRecorrentes(c.env);
    
    return c.json({ 
      success: true, 
      message: "Processamento de chamados recorrentes executado com sucesso",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Cron API] Erro ao processar recorrentes:', error);
    return c.json({ 
      error: 'Erro ao processar chamados recorrentes',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Endpoint para processar manutenções preventivas
cronRouter.get("/processar-manutencoes", verificarToken, async (c) => {
  try {
    const { processarManutencoesPreventivas } = await import('../scheduled');
    await processarManutencoesPreventivas(c.env);
    
    return c.json({ 
      success: true, 
      message: "Processamento de manutenções preventivas executado com sucesso",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Cron API] Erro ao processar manutenções:', error);
    return c.json({ 
      error: 'Erro ao processar manutenções preventivas',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Endpoint para processar ambos (útil para executar tudo de uma vez)
cronRouter.get("/processar-todos", verificarToken, async (c) => {
  try {
    const { processarChamadosRecorrentes, processarManutencoesPreventivas, fecharTicketsAutomaticamente, resetarGamificacaoMensal } = await import('../scheduled');
    
    await Promise.all([
      processarChamadosRecorrentes(c.env),
      processarManutencoesPreventivas(c.env),
      fecharTicketsAutomaticamente(c.env),
      resetarGamificacaoMensal(c.env)
    ]);
    
    return c.json({ 
      success: true, 
      message: "Processamento de recorrentes, manutenções, fechamento automático e reset de gamificação executado com sucesso",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Cron API] Erro ao processar tarefas:', error);
    return c.json({ 
      error: 'Erro ao processar tarefas agendadas',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Endpoint para fechar tickets automaticamente
cronRouter.get("/fechar-tickets", verificarTokenFechar, async (c) => {
  try {
    const { fecharTicketsAutomaticamente } = await import('../scheduled');
    await fecharTicketsAutomaticamente(c.env);
    
    return c.json({ 
      success: true, 
      message: "Fechamento automático de tickets executado com sucesso",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Cron API] Erro ao fechar tickets:', error);
    return c.json({ 
      error: 'Erro ao fechar tickets automaticamente',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Endpoint para resetar gamificação mensal (apenas no dia 1º do mês)
cronRouter.get("/resetar-gamificacao", verificarToken, async (c) => {
  try {
    const { resetarGamificacaoMensal } = await import('../scheduled');
    await resetarGamificacaoMensal(c.env);
    
    return c.json({ 
      success: true, 
      message: "Verificação de reset de gamificação executada com sucesso",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Cron API] Erro ao resetar gamificação:', error);
    return c.json({ 
      error: 'Erro ao resetar gamificação mensal',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default cronRouter;
