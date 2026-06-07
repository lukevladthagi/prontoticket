import { Hono } from 'hono';
import { getDataHoraBrasil } from '../utils/timezone';

const app = new Hono<{ Bindings: Env }>();

// GET - Listar tickets com status pausado mas sem sla_pausado_em
app.get('/diagnostico', async (c) => {

  const tickets = await c.env.DB.prepare(`
    SELECT 
      c.id,
      c.numero,
      c.titulo,
      c.status,
      c.sla_pausado_em,
      c.sla_pausado_motivo,
      c.prazo_resposta,
      c.prazo_solucao,
      c.data_abertura,
      s.nome as setor_nome
    FROM chamados c
    LEFT JOIN setores s ON c.setor_destino_id = s.id
    WHERE c.status IN ('Aguardando usuário', 'Aguardando fornecedor', 'Pausado - Usuário', 'Pausado - Fornecedor')
      AND c.sla_pausado_em IS NULL
    ORDER BY c.data_abertura DESC
  `).all();

  return c.json({
    total: tickets.results?.length || 0,
    tickets: tickets.results || []
  });
});

// POST - Corrigir um ticket específico
app.post('/corrigir/:id', async (c) => {
  const ticketId = c.req.param('id');

  // Buscar o ticket
  const ticket = await c.env.DB.prepare(`
    SELECT * FROM chamados WHERE id = ?
  `).bind(ticketId).first();

  if (!ticket) {
    return c.json({ error: 'Ticket não encontrado' }, 404);
  }

  // Verificar se está em status pausado
  const statusPausado = ['Aguardando usuário', 'Aguardando fornecedor', 'Pausado - Usuário', 'Pausado - Fornecedor'];
  if (!statusPausado.includes(ticket.status as string)) {
    return c.json({ error: 'Ticket não está em status pausado' }, 400);
  }

  // Atualizar com data atual
  const agora = getDataHoraBrasil();
  await c.env.DB.prepare(`
    UPDATE chamados
    SET sla_pausado_em = ?,
        sla_pausado_motivo = ?
    WHERE id = ?
  `).bind(
    agora,
    ticket.sla_pausado_motivo || `Aguardando: ${ticket.status}`,
    ticketId
  ).run();

  return c.json({
    success: true,
    message: 'Ticket corrigido com sucesso',
    ticket_numero: ticket.numero,
    sla_pausado_em: agora
  });
});

// POST - Corrigir todos os tickets de uma vez
app.post('/corrigir-todos', async (c) => {

  // Buscar todos os tickets com problema
  const tickets = await c.env.DB.prepare(`
    SELECT id, numero, status, sla_pausado_motivo, updated_at
    FROM chamados
    WHERE status IN ('Aguardando usuário', 'Aguardando fornecedor', 'Pausado - Usuário', 'Pausado - Fornecedor')
      AND sla_pausado_em IS NULL
  `).all();

  if (!tickets.results || tickets.results.length === 0) {
    return c.json({
      success: true,
      message: 'Nenhum ticket precisa de correção',
      corrigidos: 0
    });
  }

  let corrigidos = 0;
  const detalhes = [];

  // Corrigir cada ticket
  for (const ticket of tickets.results) {
    try {
      // Tentar encontrar no histórico quando o ticket foi pausado
      const historico = await c.env.DB.prepare(`
        SELECT created_at, detalhes
        FROM historico
        WHERE chamado_id = ?
          AND (
            (acao = 'mudanca_status' AND valor_novo IN ('Aguardando usuário', 'Aguardando fornecedor', 'Pausado - Usuário', 'Pausado - Fornecedor'))
            OR detalhes LIKE '%Pausando SLA%'
            OR detalhes LIKE '%pausado%'
          )
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(ticket.id).first();

      // Usar a data do histórico se encontrar, senão usar updated_at do ticket
      const dataPausa = historico?.created_at || ticket.updated_at;

      await c.env.DB.prepare(`
        UPDATE chamados
        SET sla_pausado_em = ?,
            sla_pausado_motivo = ?
        WHERE id = ?
      `).bind(
        dataPausa,
        ticket.sla_pausado_motivo || `Pausado: ${ticket.status}`,
        ticket.id
      ).run();
      
      corrigidos++;
      detalhes.push({
        numero: ticket.numero,
        status: ticket.status,
        data_pausa: dataPausa,
        origem: historico ? 'histórico' : 'updated_at'
      });
    } catch (error) {
      console.error(`Erro ao corrigir ticket ${ticket.numero}:`, error);
      detalhes.push({
        numero: ticket.numero,
        erro: String(error)
      });
    }
  }

  return c.json({
    success: true,
    message: `${corrigidos} tickets corrigidos com sucesso`,
    total: tickets.results.length,
    corrigidos,
    detalhes
  });
});

export default app;
