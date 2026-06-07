import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

// Endpoint para diagnosticar tickets com SLA errado vindos do Telegram
app.get('/diagnostico', async (c) => {
  const env = c.env;

  try {
    // Buscar tickets com SLA de setor diferente (qualquer setor)
    const ticketsErrados = await env.DB.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.titulo,
        c.status,
        c.setor_destino_id,
        s.nome as setor_nome,
        c.sla_id,
        sla.nome as sla_nome,
        sla.setor_id as sla_setor_id,
        s2.nome as sla_setor_nome,
        c.origem,
        c.created_at,
        c.prioridade
      FROM chamados c
      LEFT JOIN setores s ON c.setor_destino_id = s.id
      LEFT JOIN slas sla ON c.sla_id = sla.id
      LEFT JOIN setores s2 ON sla.setor_id = s2.id
      WHERE c.setor_destino_id != sla.setor_id
        AND sla.setor_id IS NOT NULL
        AND c.origem = 'telegram'
      ORDER BY c.id DESC
      LIMIT 100
    `).all();

    // Contar por SLA errado
    const porSLA = await env.DB.prepare(`
      SELECT 
        sla.id as sla_id,
        sla.nome as sla_nome,
        sla.setor_id as sla_setor_id,
        s.nome as sla_setor_nome,
        COUNT(*) as total
      FROM chamados c
      LEFT JOIN slas sla ON c.sla_id = sla.id
      LEFT JOIN setores s ON sla.setor_id = s.id
      WHERE c.setor_destino_id != sla.setor_id
        AND sla.setor_id IS NOT NULL
        AND c.origem = 'telegram'
      GROUP BY sla.id, sla.nome, sla.setor_id, s.nome
      ORDER BY total DESC
    `).all();

    // Buscar todos os SLAs disponíveis de todos os setores
    const slasDisponiveis = await env.DB.prepare(`
      SELECT 
        sla.id,
        sla.nome,
        sla.setor_id,
        sla.prioridade,
        s.nome as setor_nome
      FROM slas sla
      LEFT JOIN setores s ON sla.setor_id = s.id
      WHERE sla.setor_id IS NOT NULL
        AND sla.ativo = 1
      ORDER BY sla.setor_id, sla.prioridade
    `).all();

    return c.json({
      total: ticketsErrados.results.length,
      tickets: ticketsErrados.results,
      resumo_por_sla: porSLA.results,
      slas_disponiveis: slasDisponiveis.results
    });

  } catch (error) {
    console.error('Erro no diagnóstico:', error);
    return c.json({ 
      error: 'Erro ao buscar tickets',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Endpoint para corrigir um ticket individual com SLA específico
app.post('/corrigir-ticket/:ticketId', async (c) => {
  const env = c.env;
  const ticketId = c.req.param('ticketId');
  const body = await c.req.json();
  const { sla_id } = body;

  if (!sla_id) {
    return c.json({ error: 'sla_id é obrigatório' }, 400);
  }

  try {
    // Buscar informações do ticket
    const ticket = await env.DB.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.sla_id,
        c.setor_destino_id,
        c.prioridade,
        sla.nome as sla_antigo,
        sla.setor_id as sla_setor_antigo
      FROM chamados c
      LEFT JOIN slas sla ON c.sla_id = sla.id
      WHERE c.id = ?
    `).bind(ticketId).first();

    if (!ticket) {
      return c.json({ error: 'Ticket não encontrado' }, 404);
    }

    // Buscar informações do novo SLA
    const novoSLA = await env.DB.prepare(`
      SELECT id, nome, setor_id FROM slas WHERE id = ?
    `).bind(sla_id).first();

    if (!novoSLA) {
      return c.json({ error: 'SLA não encontrado' }, 404);
    }

    // Atualizar com o SLA selecionado
    await env.DB.prepare(`
      UPDATE chamados 
      SET sla_id = ?,
          updated_at = datetime('now', '-3 hours')
      WHERE id = ?
    `).bind(novoSLA.id, ticket.id).run();

    // Registrar no histórico
    await env.DB.prepare(`
      INSERT INTO historico (chamado_id, user_id, user_nome, acao, detalhes)
      VALUES (?, 'sistema', 'Sistema', 'correcao_sla', ?)
    `).bind(
      ticket.id,
      JSON.stringify({
        motivo: 'Correção manual - SLA de outro setor aplicado incorretamente',
        sla_anterior: ticket.sla_antigo,
        sla_novo: novoSLA.nome
      })
    ).run();

    return c.json({
      sucesso: true,
      numero: ticket.numero,
      sla_anterior: ticket.sla_antigo,
      sla_novo: novoSLA.nome
    });

  } catch (error) {
    console.error('Erro ao corrigir ticket:', error);
    return c.json({ 
      error: 'Erro ao corrigir ticket',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Endpoint para corrigir todos os tickets de um setor específico
app.post('/corrigir-por-setor/:setorId', async (c) => {
  const env = c.env;
  const setorId = c.req.param('setorId');

  try {
    // Buscar tickets com SLA errado do setor especificado
    const ticketsErrados = await env.DB.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.sla_id,
        c.setor_destino_id,
        c.prioridade,
        sla.nome as sla_antigo,
        sla.setor_id as sla_setor_antigo
      FROM chamados c
      LEFT JOIN slas sla ON c.sla_id = sla.id
      WHERE c.setor_destino_id = ?
        AND c.setor_destino_id != sla.setor_id
        AND sla.setor_id IS NOT NULL
        AND c.origem = 'telegram'
    `).bind(setorId).all();

    if (ticketsErrados.results.length === 0) {
      return c.json({
        sucesso: true,
        total_corrigidos: 0,
        mensagem: 'Nenhum ticket encontrado com SLA incorreto neste setor'
      });
    }

    const ticketsCorrigidos = [];
    const erros = [];

    for (const ticket of ticketsErrados.results) {
      try {
        // Buscar SLA correto: primeiro tenta por categoria, depois genérico
        let slaCorreto = null;
        
        // Se tem categoria, tenta buscar SLA específico
        if (ticket.categoria_id) {
          slaCorreto = await env.DB.prepare(`
            SELECT id, nome FROM slas 
            WHERE prioridade = 'P3' 
              AND setor_id = ?
              AND categoria_id = ?
            ORDER BY tempo_solucao_minutos ASC
            LIMIT 1
          `).bind(ticket.setor_destino_id, ticket.categoria_id).first();
        }
        
        // Se não encontrou por categoria, busca SLA genérico
        if (!slaCorreto) {
          slaCorreto = await env.DB.prepare(`
            SELECT id, nome FROM slas 
            WHERE prioridade = 'P3' 
              AND setor_id = ?
              AND (categoria_id IS NULL OR categoria_id = 'null')
            ORDER BY tempo_solucao_minutos ASC
            LIMIT 1
          `).bind(ticket.setor_destino_id).first();
        }

        if (!slaCorreto) {
          erros.push({
            numero: ticket.numero,
            erro: `SLA P3 não encontrado para o setor ${ticket.setor_destino_id}${ticket.categoria_id ? ` e categoria ${ticket.categoria_id}` : ''}`
          });
          continue;
        }

        // Atualizar com SLA correto do setor
        await env.DB.prepare(`
          UPDATE chamados 
          SET sla_id = ?,
              updated_at = datetime('now', '-3 hours')
          WHERE id = ?
        `).bind(slaCorreto.id, ticket.id).run();

        // Registrar no histórico
        await env.DB.prepare(`
          INSERT INTO historico (chamado_id, user_id, user_nome, acao, detalhes)
          VALUES (?, 'sistema', 'Sistema', 'correcao_sla', ?)
        `).bind(
          ticket.id,
          JSON.stringify({
            motivo: 'Correção automática por setor - SLA de outro setor aplicado incorretamente',
            sla_anterior: ticket.sla_antigo,
            sla_novo: slaCorreto.nome
          })
        ).run();

        ticketsCorrigidos.push({
          numero: ticket.numero,
          sla_anterior: ticket.sla_antigo,
          sla_novo: slaCorreto.nome
        });

      } catch (error) {
        erros.push({
          numero: ticket.numero,
          erro: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return c.json({
      sucesso: true,
      total_corrigidos: ticketsCorrigidos.length,
      tickets_corrigidos: ticketsCorrigidos,
      erros: erros.length > 0 ? erros : undefined
    });

  } catch (error) {
    console.error('Erro ao corrigir tickets:', error);
    return c.json({ 
      error: 'Erro ao corrigir tickets',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Endpoint para corrigir tickets com SLA errado (todos os setores)
app.post('/corrigir', async (c) => {
  const env = c.env;

  try {
    // Buscar tickets com SLA de setor diferente
    const ticketsErrados = await env.DB.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.sla_id,
        c.setor_destino_id,
        c.categoria_id,
        c.prioridade,
        sla.nome as sla_antigo,
        sla.setor_id as sla_setor_antigo
      FROM chamados c
      LEFT JOIN slas sla ON c.sla_id = sla.id
      WHERE c.setor_destino_id != sla.setor_id
        AND sla.setor_id IS NOT NULL
        AND c.origem = 'telegram'
    `).all();

    const ticketsCorrigidos = [];
    const erros = [];

    for (const ticket of ticketsErrados.results) {
      try {
        // Buscar SLA correto: primeiro tenta por categoria, depois genérico
        let slaCorreto = null;
        
        // Se tem categoria, tenta buscar SLA específico
        if (ticket.categoria_id) {
          slaCorreto = await env.DB.prepare(`
            SELECT id, nome FROM slas 
            WHERE prioridade = 'P3' 
              AND setor_id = ?
              AND categoria_id = ?
            ORDER BY tempo_solucao_minutos ASC
            LIMIT 1
          `).bind(ticket.setor_destino_id, ticket.categoria_id).first();
        }
        
        // Se não encontrou por categoria, busca SLA genérico
        if (!slaCorreto) {
          slaCorreto = await env.DB.prepare(`
            SELECT id, nome FROM slas 
            WHERE prioridade = 'P3' 
              AND setor_id = ?
              AND (categoria_id IS NULL OR categoria_id = 'null')
            ORDER BY tempo_solucao_minutos ASC
            LIMIT 1
          `).bind(ticket.setor_destino_id).first();
        }

        if (!slaCorreto) {
          erros.push({
            numero: ticket.numero,
            erro: `SLA P3 não encontrado para o setor ${ticket.setor_destino_id}${ticket.categoria_id ? ` e categoria ${ticket.categoria_id}` : ''}`
          });
          continue;
        }

        // Atualizar com SLA correto do setor
        await env.DB.prepare(`
          UPDATE chamados 
          SET sla_id = ?,
              updated_at = datetime('now', '-3 hours')
          WHERE id = ?
        `).bind(slaCorreto.id, ticket.id).run();

        // Registrar no histórico
        await env.DB.prepare(`
          INSERT INTO historico (chamado_id, user_id, user_nome, acao, detalhes)
          VALUES (?, 'sistema', 'Sistema', 'correcao_sla', ?)
        `).bind(
          ticket.id,
          JSON.stringify({
            motivo: 'Correção automática - SLA de outro setor aplicado incorretamente',
            sla_anterior: ticket.sla_antigo,
            sla_novo: slaCorreto.nome
          })
        ).run();

        ticketsCorrigidos.push({
          numero: ticket.numero,
          sla_anterior: ticket.sla_antigo,
          sla_novo: slaCorreto.nome
        });

      } catch (error) {
        erros.push({
          numero: ticket.numero,
          erro: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return c.json({
      sucesso: true,
      total_corrigidos: ticketsCorrigidos.length,
      tickets_corrigidos: ticketsCorrigidos,
      erros: erros.length > 0 ? erros : undefined
    });

  } catch (error) {
    console.error('Erro ao corrigir tickets:', error);
    return c.json({ 
      error: 'Erro ao corrigir tickets',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default app;
