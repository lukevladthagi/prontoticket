import { Hono } from 'hono';
import { authMiddleware } from '@getmocha/users-service/backend';
import type { MochaUser } from '@getmocha/users-service/shared';
import { getDataHoraBrasil } from '../utils/timezone';
import { calcularPrazoSLA } from '../utils/sla-calculator';

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.use('*', authMiddleware);

// Diagnóstico - Listar tickets sem SLA de Hotelaria, Manutenção e Rouparia
router.get('/diagnostico', async (c) => {
  const db = c.env.DB;

  try {
    const tickets = await db
      .prepare(`
        SELECT 
          c.id,
          c.numero,
          c.titulo,
          c.tipo,
          c.prioridade,
          c.setor_destino_id,
          s.nome as setor_nome,
          c.sla_id,
          c.prazo_resposta,
          c.prazo_solucao,
          c.data_abertura,
          c.categoria_id,
          cat.nome as categoria_nome
        FROM chamados c
        LEFT JOIN setores s ON c.setor_destino_id = s.id
        LEFT JOIN categorias cat ON c.categoria_id = cat.id
        WHERE c.setor_destino_id IN (7, 9, 13)
          AND c.status NOT IN ('Fechado', 'Cancelado')
          AND (c.sla_id IS NULL OR c.prazo_solucao IS NULL)
        ORDER BY c.id DESC
      `)
      .all();

    return c.json({
      total: tickets.results?.length || 0,
      tickets: tickets.results || [],
    });
  } catch (error: any) {
    console.error('Erro ao buscar tickets:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Corrigir SLAs - Recalcula SLAs para tickets sem SLA desses setores
router.post('/corrigir', async (c) => {
  const db = c.env.DB;

  try {
    // Buscar tickets sem SLA de Hotelaria (9), Manutenção (7) e Rouparia (13)
    const tickets = await db
      .prepare(`
        SELECT 
          id,
          numero,
          tipo,
          prioridade,
          setor_destino_id,
          item_id,
          subcategoria_id,
          categoria_id,
          data_abertura
        FROM chamados
        WHERE setor_destino_id IN (7, 9, 13)
          AND status NOT IN ('Fechado', 'Cancelado')
          AND (sla_id IS NULL OR prazo_solucao IS NULL)
      `)
      .all();

    const resultados = {
      processados: 0,
      corrigidos: 0,
      erros: [] as any[],
    };

    for (const ticket of (tickets.results || []) as any[]) {
      resultados.processados++;

      try {
        // Mapear "Problema" para "Incidente" (mesma correção aplicada no código)
        const tipoChamado = ticket.tipo === 'Problema' ? 'Incidente' : ticket.tipo;

        // Buscar SLA seguindo hierarquia: item → subcategoria → categoria → genérico
        let slaQuery;
        
        if (ticket.item_id) {
          slaQuery = await db
            .prepare(`
              SELECT id, tempo_resposta_minutos, tempo_solucao_minutos
              FROM slas
              WHERE setor_id = ?
                AND tipo_chamado = ?
                AND prioridade = ?
                AND item_id = ?
              LIMIT 1
            `)
            .bind(ticket.setor_destino_id, tipoChamado, ticket.prioridade, ticket.item_id)
            .first();
        }

        if (!slaQuery && ticket.subcategoria_id) {
          slaQuery = await db
            .prepare(`
              SELECT id, tempo_resposta_minutos, tempo_solucao_minutos
              FROM slas
              WHERE setor_id = ?
                AND tipo_chamado = ?
                AND prioridade = ?
                AND subcategoria_id = ?
                AND item_id IS NULL
              LIMIT 1
            `)
            .bind(ticket.setor_destino_id, tipoChamado, ticket.prioridade, ticket.subcategoria_id)
            .first();
        }

        if (!slaQuery && ticket.categoria_id) {
          slaQuery = await db
            .prepare(`
              SELECT id, tempo_resposta_minutos, tempo_solucao_minutos
              FROM slas
              WHERE setor_id = ?
                AND tipo_chamado = ?
                AND prioridade = ?
                AND categoria_id = ?
                AND subcategoria_id IS NULL
                AND item_id IS NULL
              LIMIT 1
            `)
            .bind(ticket.setor_destino_id, tipoChamado, ticket.prioridade, ticket.categoria_id)
            .first();
        }

        // SLA genérico (sem categoria)
        if (!slaQuery) {
          slaQuery = await db
            .prepare(`
              SELECT id, tempo_resposta_minutos, tempo_solucao_minutos
              FROM slas
              WHERE setor_id = ?
                AND tipo_chamado = ?
                AND prioridade = ?
                AND categoria_id IS NULL
                AND subcategoria_id IS NULL
                AND item_id IS NULL
              LIMIT 1
            `)
            .bind(ticket.setor_destino_id, tipoChamado, ticket.prioridade)
            .first();
        }

        if (slaQuery) {
          const sla = slaQuery as any;
          
          // Calcular prazos de resposta e resolução
          const dataAbertura = new Date(ticket.data_abertura);
          
          let prazo_resposta = null;
          let prazo_solucao = null;
          
          // Calcular prazo de resposta (se tiver tempo definido)
          if (sla.tempo_resposta_minutos && sla.tempo_resposta_minutos > 0) {
            const prazoResposta = await calcularPrazoSLA(
              db,
              ticket.setor_destino_id,
              dataAbertura,
              sla.tempo_resposta_minutos
            );
            prazo_resposta = prazoResposta.toISOString();
          }
          
          // Calcular prazo de resolução (se tiver tempo definido)
          if (sla.tempo_solucao_minutos && sla.tempo_solucao_minutos > 0) {
            const prazoSolucao = await calcularPrazoSLA(
              db,
              ticket.setor_destino_id,
              dataAbertura,
              sla.tempo_solucao_minutos
            );
            prazo_solucao = prazoSolucao.toISOString();
          }

          // Atualizar ticket com SLA
          await db
            .prepare(`
              UPDATE chamados
              SET 
                sla_id = ?,
                prazo_resposta = ?,
                prazo_solucao = ?,
                updated_at = ?
              WHERE id = ?
            `)
            .bind(
              sla.id,
              prazo_resposta,
              prazo_solucao,
              getDataHoraBrasil(),
              ticket.id
            )
            .run();

          resultados.corrigidos++;
        } else {
          resultados.erros.push({
            ticket: ticket.numero,
            erro: `SLA não encontrado para setor ${ticket.setor_destino_id}, tipo ${tipoChamado}, prioridade ${ticket.prioridade}`,
          });
        }
      } catch (error: any) {
        resultados.erros.push({
          ticket: ticket.numero,
          erro: error.message,
        });
      }
    }

    return c.json(resultados);
  } catch (error: any) {
    console.error('Erro ao corrigir SLAs:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default router;
