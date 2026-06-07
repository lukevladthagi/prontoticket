import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";

const app = new Hono<{
  Bindings: {
    DB: D1Database;
  };
}>();

app.use("/*", authMiddleware);

// GET - Diagnóstico de tickets com SLA genérico mas categoria específica
app.get("/", async (c) => {
  try {
    console.log('[DIAGNÓSTICO] Verificando tickets reclassificados com SLA genérico...');
    
    // Buscar tickets que têm categoria mas SLA genérico
    const ticketsComProblema = await c.env.DB.prepare(
      `SELECT 
        c.id,
        c.numero,
        c.tipo,
        c.prioridade,
        c.categoria_id,
        c.subcategoria_id,
        c.item_id,
        c.sla_id,
        c.data_abertura,
        s.nome as sla_atual_nome,
        s.categoria_id as sla_categoria_id,
        s.tempo_resposta_minutos as sla_tempo_resposta,
        s.tempo_solucao_minutos as sla_tempo_solucao,
        cat.nome as categoria_nome
      FROM chamados c
      LEFT JOIN slas s ON c.sla_id = s.id
      LEFT JOIN categorias cat ON CAST(c.categoria_id AS TEXT) = CAST(cat.id AS TEXT)
      WHERE c.setor_destino_id = 1
      AND c.categoria_id IS NOT NULL
      AND c.categoria_id != ''
      AND c.categoria_id != 'null'
      AND c.sla_id IS NOT NULL
      AND (s.categoria_id IS NULL OR s.categoria_id = 'null')
      ORDER BY c.id DESC`
    ).all();

    console.log(`[DIAGNÓSTICO] Encontrados ${ticketsComProblema.results?.length || 0} tickets com problema`);

    return c.json({
      total_tickets_com_problema: ticketsComProblema.results?.length || 0,
      tickets: ticketsComProblema.results || [],
    });
  } catch (error: any) {
    console.error("Erro ao gerar diagnóstico:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST - Corrigir SLAs de tickets reclassificados
app.post("/corrigir", async (c) => {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  CORREÇÃO DE SLAs PARA TICKETS RECLASSIFICADOS          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    // Buscar tickets que têm categoria mas SLA genérico
    const ticketsParaCorrigir = await c.env.DB.prepare(
      `SELECT 
        c.id,
        c.numero,
        c.tipo,
        c.prioridade,
        c.categoria_id,
        c.subcategoria_id,
        c.item_id,
        c.data_abertura,
        c.sla_id as sla_antigo_id,
        s.nome as sla_antigo_nome
      FROM chamados c
      LEFT JOIN slas s ON c.sla_id = s.id
      WHERE c.setor_destino_id = 1
      AND c.categoria_id IS NOT NULL
      AND c.categoria_id != ''
      AND c.categoria_id != 'null'
      AND c.sla_id IS NOT NULL
      AND (s.categoria_id IS NULL OR s.categoria_id = 'null')`
    ).all();

    const tickets = ticketsParaCorrigir.results || [];
    console.log(`[INÍCIO] ${tickets.length} tickets para processar\n`);

    let corrigidos = 0;
    let erros = 0;
    const detalhes: any[] = [];

    // Função para calcular prazo
    const calcularPrazo = (dataInicio: Date, minutos: number): string => {
      const prazo = new Date(dataInicio);
      prazo.setMinutes(prazo.getMinutes() + minutos);
      return prazo.toISOString();
    };

    for (const ticket of tickets) {
      console.log(`\n========== PROCESSANDO ${ticket.numero} ==========`);
      console.log(`[INFO] Categoria: ${ticket.categoria_id}, Subcategoria: ${ticket.subcategoria_id}, Item: ${ticket.item_id}`);
      console.log(`[INFO] SLA atual: ${ticket.sla_antigo_nome} (genérico)`);

      try {
        // Buscar SLA específico seguindo a hierarquia: item → subcategoria → categoria
        let slaEspecifico: any = null;

        // 1. Tentar por item_id
        if (ticket.item_id) {
          console.log(`[BUSCA] Tentando SLA por item_id=${ticket.item_id}...`);
          slaEspecifico = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE CAST(categoria_id AS TEXT) = CAST(? AS TEXT)
             AND ativo = 1
             LIMIT 1`
          ).bind(ticket.item_id).first();
          
          if (slaEspecifico) {
            console.log(`[ENCONTRADO] SLA específico por item: ${slaEspecifico.nome}`);
          }
        }

        // 2. Se não encontrou, tentar por subcategoria_id
        if (!slaEspecifico && ticket.subcategoria_id) {
          console.log(`[BUSCA] Tentando SLA por subcategoria_id=${ticket.subcategoria_id}...`);
          slaEspecifico = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE CAST(categoria_id AS TEXT) = CAST(? AS TEXT)
             AND ativo = 1
             LIMIT 1`
          ).bind(ticket.subcategoria_id).first();
          
          if (slaEspecifico) {
            console.log(`[ENCONTRADO] SLA específico por subcategoria: ${slaEspecifico.nome}`);
          }
        }

        // 3. Se não encontrou, tentar por categoria_id
        if (!slaEspecifico && ticket.categoria_id) {
          console.log(`[BUSCA] Tentando SLA por categoria_id=${ticket.categoria_id}...`);
          slaEspecifico = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE CAST(categoria_id AS TEXT) = CAST(? AS TEXT)
             AND ativo = 1
             LIMIT 1`
          ).bind(ticket.categoria_id).first();
          
          if (slaEspecifico) {
            console.log(`[ENCONTRADO] SLA específico por categoria: ${slaEspecifico.nome}`);
          }
        }

        if (!slaEspecifico) {
          console.log(`[AVISO] Nenhum SLA específico encontrado para esta categoria - mantendo SLA genérico`);
          detalhes.push({
            ticket_id: ticket.id,
            numero: ticket.numero,
            status: 'sem_sla_especifico',
            mensagem: 'Nenhum SLA específico encontrado - mantido SLA genérico',
            categoria_id: ticket.categoria_id
          });
          continue;
        }

        // Verificar se já está com o SLA correto
        if (ticket.sla_antigo_id === slaEspecifico.id) {
          console.log(`[INFO] Ticket já possui o SLA correto`);
          continue;
        }

        // Calcular novos prazos com a regra: TI sempre 1 hora de resposta
        const dataAbertura = new Date(ticket.data_abertura as string);
        const prazoResposta = calcularPrazo(dataAbertura, 60); // TI sempre 1 hora
        const prazoSolucao = calcularPrazo(dataAbertura, slaEspecifico.tempo_solucao_minutos);

        console.log(`[ATUALIZAÇÃO] Novo SLA: ${slaEspecifico.nome}`);
        console.log(`[PRAZOS] Resposta: 60min (fixo TI), Solução: ${slaEspecifico.tempo_solucao_minutos}min`);

        // Atualizar ticket
        await c.env.DB.prepare(
          `UPDATE chamados 
           SET sla_id = ?, prazo_resposta = ?, prazo_solucao = ? 
           WHERE id = ?`
        ).bind(slaEspecifico.id, prazoResposta, prazoSolucao, ticket.id).run();

        console.log(`[SUCESSO] Ticket ${ticket.numero} atualizado!`);
        corrigidos++;
        
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          status: 'corrigido',
          sla_antigo: ticket.sla_antigo_nome,
          sla_novo: slaEspecifico.nome,
          sla_novo_id: slaEspecifico.id,
          tempo_solucao: slaEspecifico.tempo_solucao_minutos,
          prazo_resposta: prazoResposta,
          prazo_solucao: prazoSolucao
        });

      } catch (error: any) {
        console.error(`[ERRO] Falha ao processar ticket ${ticket.numero}:`, error);
        erros++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          status: 'erro',
          mensagem: error.message
        });
      }
    }

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log(`║  RESUMO: ${corrigidos} corrigidos, ${erros} erros`);
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    return c.json({
      sucesso: true,
      total_processados: tickets.length,
      tickets_corrigidos: corrigidos,
      tickets_com_erro: erros,
      detalhes
    });

  } catch (error: any) {
    console.error("Erro ao corrigir SLAs:", error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
