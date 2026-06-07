import { Hono } from 'hono';
import { getDataHoraBrasil } from '../utils/timezone';

const app = new Hono<{ Bindings: Env }>();

// Diagnóstico: tickets do setor Manutenção com categoria TI "Manutenção" (id 990)
app.get('/diagnostico', async (c) => {
  const db = c.env.DB;

  try {
    const tickets = await db.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.titulo,
        s.nome as setor_nome,
        c.categoria_id,
        cat.nome as categoria_nome,
        c.data_abertura
      FROM chamados c
      LEFT JOIN setores s ON c.setor_destino_id = s.id
      LEFT JOIN categorias cat ON c.categoria_id = cat.id
      WHERE c.setor_destino_id = 7
        AND c.categoria_id = 990
      ORDER BY c.data_abertura DESC
    `).all();

    return c.json({
      total: tickets.results?.length || 0,
      tickets: tickets.results || []
    });
  } catch (error) {
    console.error('Erro ao diagnosticar tickets:', error);
    return c.json({ error: 'Erro ao diagnosticar tickets' }, 500);
  }
});

// Corrigir tickets afetados
app.post('/corrigir', async (c) => {
  const db = c.env.DB;

  try {
    // Buscar tickets afetados
    const tickets = await db.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.tipo,
        c.prioridade,
        c.data_abertura
      FROM chamados c
      WHERE c.setor_destino_id = 7
        AND c.categoria_id = 990
    `).all();

    const ticketsAfetados = tickets.results || [];
    let corrigidos = 0;

    for (const ticket of ticketsAfetados) {
      // Buscar SLA genérico do setor Manutenção baseado no tipo e prioridade
      const slaResult = await db.prepare(`
        SELECT 
          id,
          tempo_resposta_minutos,
          tempo_solucao_minutos
        FROM slas
        WHERE setor_id = 7
          AND tipo_chamado = ?
          AND prioridade = ?
          AND categoria_id IS NULL
          AND subcategoria_id IS NULL
          AND item_id IS NULL
        LIMIT 1
      `).bind(ticket.tipo, ticket.prioridade).first();

      if (!slaResult) {
        console.warn(`SLA não encontrado para ticket ${ticket.numero} (tipo: ${ticket.tipo}, prioridade: ${ticket.prioridade})`);
        continue;
      }

      const slaId = slaResult.id as number;
      const tempoResposta = slaResult.tempo_resposta_minutos as number;
      const tempoSolucao = slaResult.tempo_solucao_minutos as number;

      const dataAbertura = new Date(ticket.data_abertura as string);
      
      // Calcular novos prazos
      let prazoResposta = null;
      if (tempoResposta > 0) {
        prazoResposta = new Date(dataAbertura.getTime() + tempoResposta * 60000).toISOString();
      }

      const prazoSolucao = new Date(dataAbertura.getTime() + tempoSolucao * 60000).toISOString();

      // Atualizar ticket
      await db.prepare(`
        UPDATE chamados
        SET 
          tipo_problema = NULL,
          categoria_id = NULL,
          subcategoria_id = NULL,
          item_id = NULL,
          sla_id = ?,
          prazo_resposta = ?,
          prazo_solucao = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(
        slaId,
        prazoResposta,
        prazoSolucao,
        getDataHoraBrasil(),
        ticket.id
      ).run();

      // Registrar no histórico
      await db.prepare(`
        INSERT INTO historico (
          chamado_id,
          tipo,
          descricao,
          usuario_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        ticket.id,
        'acao_sistema',
        'Categoria TI "Manutenção" removida. SLA do setor Manutenção recalculado automaticamente.',
        null,
        getDataHoraBrasil()
      ).run();

      corrigidos++;
    }

    return c.json({
      success: true,
      total: ticketsAfetados.length,
      corrigidos
    });
  } catch (error) {
    console.error('Erro ao corrigir tickets:', error);
    return c.json({ error: 'Erro ao corrigir tickets' }, 500);
  }
});

export default app;
