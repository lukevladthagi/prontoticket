import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  try {
    console.log('=== RELATORIO TICKETS - INICIO ===');
    const setorId = c.req.query("setor_id");
    const dataInicio = c.req.query("data_inicio");
    const dataFim = c.req.query("data_fim");
    console.log('Parametros:', { setorId, dataInicio, dataFim });

    let query = `
      SELECT 
        c.id,
        c.numero,
        c.titulo,
        c.tipo,
        c.prioridade,
        c.status,
        c.data_abertura,
        c.data_primeira_resposta,
        c.data_resolucao,
        c.data_fechamento,
        c.prazo_resposta,
        c.prazo_solucao,
        c.sla_pausado_em,
        c.sla_pausado_motivo,
        COALESCE(sla.tempo_resposta_minutos, 0) as tempo_resposta_minutos,
        COALESCE(sla.tempo_solucao_minutos, 0) as tempo_solucao_minutos,
        s.nome as setor_nome,
        up.nome as solicitante_nome,
        tech.nome as tecnico_nome,
        cat.nome as categoria_nome,
        sub.nome as subcategoria_nome,
        item.nome as item_nome
      FROM chamados c
      LEFT JOIN setores s ON c.setor_destino_id = s.id
      LEFT JOIN user_profiles up ON c.solicitante_id = up.user_id
      LEFT JOIN user_profiles tech ON c.tecnico_responsavel_id = tech.user_id
      LEFT JOIN slas sla ON c.sla_id = sla.id
      LEFT JOIN categorias cat ON c.categoria_id = cat.id AND cat.tipo = 'categoria'
      LEFT JOIN categorias sub ON c.subcategoria_id = sub.id AND sub.tipo = 'subcategoria'
      LEFT JOIN categorias item ON c.item_id = item.id AND item.tipo = 'item'
      WHERE 1=1
    `;

    const bindings: any[] = [];

    if (setorId && setorId !== 'todos') {
      query += ` AND c.setor_destino_id = ?`;
      bindings.push(parseInt(setorId));
    }

    if (dataInicio) {
      query += ` AND DATE(c.data_abertura) >= DATE(?)`;
      bindings.push(dataInicio);
    }

    if (dataFim) {
      query += ` AND DATE(c.data_abertura) <= DATE(?)`;
      bindings.push(dataFim);
    }

    query += ` ORDER BY c.data_abertura DESC`;

    console.log('Query SQL:', query);
    console.log('Bindings:', bindings);
    
    const { results } = await c.env.DB.prepare(query).bind(...bindings).all();
    
    console.log('Resultados encontrados:', results?.length || 0);

    // Calcular status de SLA para cada ticket
    const ticketsComSLA = results.map((ticket: any) => {
      const agora = new Date();
      
      // Declarar variáveis primeiro
      let statusSLAAtendimento = 'N/A';
      let statusSLAResolucao = 'N/A';
      let tempoAtendimentoDecorrido = null;
      let tempoResolucaoDecorrido = null;
      
      // Se o SLA está pausado, não calcular como fora do prazo
      if (ticket.sla_pausado_em) {
        statusSLAAtendimento = 'Pausado';
        statusSLAResolucao = 'Pausado';
      } else {
        // Status SLA Atendimento
        if (ticket.prazo_resposta && ticket.tempo_resposta_minutos > 0) {
          const prazoResposta = new Date(ticket.prazo_resposta);
          
          if (ticket.data_primeira_resposta) {
            const dataResposta = new Date(ticket.data_primeira_resposta);
            tempoAtendimentoDecorrido = Math.round((dataResposta.getTime() - new Date(ticket.data_abertura).getTime()) / 60000);
            statusSLAAtendimento = dataResposta <= prazoResposta ? 'Dentro do SLA' : 'Fora do SLA';
          } else if (ticket.status !== 'Fechado' && ticket.status !== 'Resolvido') {
            // Ticket ainda aberto
            tempoAtendimentoDecorrido = Math.round((agora.getTime() - new Date(ticket.data_abertura).getTime()) / 60000);
            statusSLAAtendimento = agora <= prazoResposta ? 'Em andamento' : 'Fora do SLA';
          }
        }

        // Status SLA Resolução
        if (ticket.prazo_solucao && ticket.tempo_solucao_minutos > 0) {
          const prazoSolucao = new Date(ticket.prazo_solucao);
          
          if (ticket.data_resolucao) {
            const dataResolucao = new Date(ticket.data_resolucao);
            tempoResolucaoDecorrido = Math.round((dataResolucao.getTime() - new Date(ticket.data_abertura).getTime()) / 60000);
            statusSLAResolucao = dataResolucao <= prazoSolucao ? 'Dentro do SLA' : 'Fora do SLA';
          } else if (ticket.status !== 'Fechado' && ticket.status !== 'Resolvido') {
            // Ticket ainda aberto
            tempoResolucaoDecorrido = Math.round((agora.getTime() - new Date(ticket.data_abertura).getTime()) / 60000);
            statusSLAResolucao = agora <= prazoSolucao ? 'Em andamento' : 'Fora do SLA';
          }
        }
      }

      return {
        ...ticket,
        status_sla_atendimento: statusSLAAtendimento,
        status_sla_resolucao: statusSLAResolucao,
        tempo_atendimento_decorrido: tempoAtendimentoDecorrido,
        tempo_resolucao_decorrido: tempoResolucaoDecorrido
      };
    });

    console.log('=== RELATORIO TICKETS - FIM ===');
    return c.json(ticketsComSLA);
  } catch (error) {
    console.error('=== ERRO AO GERAR RELATÓRIO ===');
    console.error('Erro completo:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    return c.json({ error: "Erro ao gerar relatório", details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

export default router;
