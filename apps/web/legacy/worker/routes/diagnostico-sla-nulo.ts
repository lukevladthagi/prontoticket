import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";

const app = new Hono<{
  Bindings: {
    DB: D1Database;
  };
}>();

app.use("/*", authMiddleware);

// GET - Diagnóstico de tickets sem SLA
app.get("/", async (c) => {
  try {
    // Total de tickets
    const totalResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados`
    ).first<{ total: number }>();

    // Tickets sem prazo_resposta
    const semPrazoRespostaResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados WHERE prazo_resposta IS NULL`
    ).first<{ total: number }>();

    // Tickets sem prazo_solucao
    const semPrazoSolucaoResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados WHERE prazo_solucao IS NULL`
    ).first<{ total: number }>();

    // Tickets sem sla_id
    const semSlaIdResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados WHERE sla_id IS NULL`
    ).first<{ total: number }>();

    // Tickets por setor sem prazo_solucao
    const porSetorResult = await c.env.DB.prepare(
      `SELECT 
        s.id as setor_id,
        s.nome as setor_nome,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN c.prazo_resposta IS NULL THEN 1 ELSE 0 END) as sem_prazo_resposta,
        SUM(CASE WHEN c.prazo_solucao IS NULL THEN 1 ELSE 0 END) as sem_prazo_solucao,
        SUM(CASE WHEN c.sla_id IS NULL THEN 1 ELSE 0 END) as sem_sla_id
      FROM chamados c
      LEFT JOIN setores s ON c.setor_destino_id = s.id
      GROUP BY s.id, s.nome
      ORDER BY total_tickets DESC`
    ).all();

    return c.json({
      total_tickets: totalResult?.total || 0,
      sem_prazo_resposta: semPrazoRespostaResult?.total || 0,
      sem_prazo_solucao: semPrazoSolucaoResult?.total || 0,
      sem_sla_id: semSlaIdResult?.total || 0,
      por_setor: porSetorResult.results || [],
    });
  } catch (error: any) {
    console.error("Erro ao gerar diagnóstico:", error);
    return c.json({ error: error.message }, 500);
  }
});

// GET - Debug: Exemplos de tickets sem prazo_resposta
app.get("/debug-tickets", async (c) => {
  try {
    // 1. Tickets com prazo_resposta completamente NULL
    const ticketsNull = await c.env.DB.prepare(
      `SELECT 
        id,
        numero,
        setor_destino_id,
        data_abertura,
        prazo_resposta,
        prazo_solucao,
        sla_id,
        status,
        typeof(prazo_resposta) as tipo_prazo_resposta,
        length(prazo_resposta) as tamanho_prazo_resposta,
        'NULL' as motivo
      FROM chamados 
      WHERE prazo_resposta IS NULL
      LIMIT 20`
    ).all();

    // 2. Tickets TI com prazo_resposta NULL
    const ticketsTINull = await c.env.DB.prepare(
      `SELECT 
        id,
        numero,
        setor_destino_id,
        data_abertura,
        prazo_resposta,
        prazo_solucao,
        sla_id,
        status,
        typeof(prazo_resposta) as tipo_prazo_resposta,
        length(prazo_resposta) as tamanho_prazo_resposta,
        'NULL' as motivo
      FROM chamados 
      WHERE setor_destino_id = 1
      AND prazo_resposta IS NULL
      LIMIT 20`
    ).all();

    // 3. Tickets TI com prazo_resposta vazio (string vazia)
    const ticketsTIVazio = await c.env.DB.prepare(
      `SELECT 
        id,
        numero,
        setor_destino_id,
        data_abertura,
        prazo_resposta,
        prazo_solucao,
        sla_id,
        status,
        typeof(prazo_resposta) as tipo_prazo_resposta,
        length(prazo_resposta) as tamanho_prazo_resposta,
        'VAZIO' as motivo
      FROM chamados 
      WHERE setor_destino_id = 1
      AND prazo_resposta = ''
      LIMIT 20`
    ).all();

    // 4. Tickets TI com prazo_resposta = 'null' (texto)
    const ticketsTINullTexto = await c.env.DB.prepare(
      `SELECT 
        id,
        numero,
        setor_destino_id,
        data_abertura,
        prazo_resposta,
        prazo_solucao,
        sla_id,
        status,
        typeof(prazo_resposta) as tipo_prazo_resposta,
        length(prazo_resposta) as tamanho_prazo_resposta,
        'NULL_TEXTO' as motivo
      FROM chamados 
      WHERE setor_destino_id = 1
      AND prazo_resposta = 'null'
      LIMIT 20`
    ).all();

    // 5. Buscar tickets específicos mencionados (TKT-130170, TKT-002733, TKT-002732, TKT-002731, TKT-002730)
    const ticketsEspecificos = await c.env.DB.prepare(
      `SELECT 
        c.id,
        c.numero,
        c.setor_destino_id,
        c.data_abertura,
        c.prazo_resposta,
        c.prazo_solucao,
        c.sla_id,
        c.status,
        typeof(c.prazo_resposta) as tipo_prazo_resposta,
        length(c.prazo_resposta) as tamanho_prazo_resposta,
        c.prioridade,
        c.categoria_id,
        c.subcategoria_id,
        c.item_id,
        sla.tempo_resposta_minutos,
        sla.tempo_solucao_minutos,
        sla.nome as sla_nome,
        'ESPECIFICO' as motivo
      FROM chamados c
      LEFT JOIN slas sla ON c.sla_id = sla.id
      WHERE c.numero IN ('TKT-130170', 'TKT-002733', 'TKT-002732', 'TKT-002731', 'TKT-002730')
      ORDER BY c.numero DESC`
    ).all();

    // Combinar todos os tickets TI problemáticos
    const todosTI = [
      ...(ticketsTINull.results || []),
      ...(ticketsTIVazio.results || []),
      ...(ticketsTINullTexto.results || [])
    ];

    // Remover duplicatas baseado no ID
    const tiUnicos = Array.from(
      new Map(todosTI.map(t => [t.id, t])).values()
    );

    return c.json({
      // Geral - todos os setores
      exemplos_geral: ticketsNull.results || [],
      total_exemplos_geral: ticketsNull.results?.length || 0,
      
      // TI específico - todos os casos problemáticos
      exemplos_ti: tiUnicos,
      total_exemplos_ti: tiUnicos.length,
      
      // Detalhamento por tipo de problema
      ti_null: ticketsTINull.results || [],
      ti_vazio: ticketsTIVazio.results || [],
      ti_null_texto: ticketsTINullTexto.results || [],
      
      total_ti_null: ticketsTINull.results?.length || 0,
      total_ti_vazio: ticketsTIVazio.results?.length || 0,
      total_ti_null_texto: ticketsTINullTexto.results?.length || 0,
      
      // Tickets específicos mencionados
      tickets_especificos: ticketsEspecificos.results || [],
      total_tickets_especificos: ticketsEspecificos.results?.length || 0
    });
  } catch (error: any) {
    console.error("Erro ao buscar exemplos:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST - Corrigir SLAs de tickets sem prazo
app.post("/corrigir", async (c) => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ENDPOINT /corrigir CHAMADO - INÍCIO                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  try {
    console.log('[BACKEND] ✓ Dentro do try/catch principal');
    console.log('[BACKEND] ✓ Recebendo requisição POST /api/diagnostico-sla-nulo/corrigir');
    console.log('[BACKEND] ✓ Request headers:', JSON.stringify(c.req.header(), null, 2));
    console.log('[BACKEND] ✓ Request method:', c.req.method);
    console.log('[BACKEND] ✓ Request URL:', c.req.url);
    
    let body;
    try {
      console.log('[BACKEND] ⏳ Tentando fazer parse do JSON do body...');
      const rawBody = await c.req.text();
      console.log('[BACKEND] ✓ Raw body recebido:', rawBody);
      console.log('[BACKEND] ✓ Raw body length:', rawBody.length);
      
      if (!rawBody || rawBody.trim() === '') {
        console.log('[BACKEND] ⚠ Body vazio, usando objeto padrão');
        body = { ticket_ids: [] };
      } else {
        body = JSON.parse(rawBody);
        console.log('[BACKEND] ✓ Body parseado com sucesso:', JSON.stringify(body, null, 2));
      }
    } catch (e: any) {
      console.error('[BACKEND] ❌ ERRO ao fazer parse do JSON do body:', e);
      console.error('[BACKEND] ❌ Tipo do erro:', e.constructor.name);
      console.error('[BACKEND] ❌ Mensagem:', e.message);
      console.error('[BACKEND] ❌ Stack:', e.stack);
      return c.json({ 
        error: 'Corpo da requisição inválido', 
        detalhes: e.message,
        tipo: 'JSON_PARSE_ERROR'
      }, 400);
    }
    
    console.log('[BACKEND] ✓ Extraindo ticket_ids do body...');
    const ticketIds = body.ticket_ids as number[]; // Array de IDs específicos, ou vazio para todos
    console.log('[BACKEND] ✓ ticket_ids extraído:', ticketIds);
    console.log('[BACKEND] ✓ Tipo de ticket_ids:', Array.isArray(ticketIds) ? 'array' : typeof ticketIds);
    console.log('[BACKEND] ✓ Length:', ticketIds?.length);
    console.log('[BACKEND] ✓ É array?', Array.isArray(ticketIds));

    console.log('[BACKEND] ⏳ Verificando acesso ao banco de dados...');
    console.log('[BACKEND] ✓ c.env.DB exists?', !!c.env.DB);
    console.log('[BACKEND] ✓ c.env.DB type:', typeof c.env.DB);

    let ticketsParaCorrigir: any[] = [];
    console.log('[BACKEND] ✓ Array ticketsParaCorrigir inicializado');

    if (ticketIds && ticketIds.length > 0) {
      // Corrigir apenas tickets específicos do setor TI
      console.log(`[BACKEND] ⚡ Modo: Corrigir tickets específicos (${ticketIds.length} IDs fornecidos)`);
      
      try {
        const placeholders = ticketIds.map(() => '?').join(',');
        console.log('[BACKEND] ✓ Placeholders gerados:', placeholders);
        
        const query = `SELECT 
          c.id,
          c.numero,
          c.tipo,
          c.prioridade,
          c.setor_destino_id,
          c.categoria_id,
          c.subcategoria_id,
          c.item_id,
          c.data_abertura,
          c.afeta_paciente
        FROM chamados c
        WHERE c.id IN (${placeholders})
        AND c.setor_destino_id = 1
        AND (c.prazo_resposta IS NULL OR c.prazo_solucao IS NULL OR c.sla_id IS NULL)`;
        
        console.log('[BACKEND] ✓ Query montada:', query);
        console.log('[BACKEND] ✓ Bind values:', ticketIds);
        
        console.log('[BACKEND] ⏳ Executando query no banco de dados...');
        const stmt = c.env.DB.prepare(query);
        console.log('[BACKEND] ✓ Statement preparado');
        
        const boundStmt = stmt.bind(...ticketIds);
        console.log('[BACKEND] ✓ Statement bound com valores');
        
        const result = await boundStmt.all();
        console.log('[BACKEND] ✓ Query executada com sucesso');
        console.log('[BACKEND] ✓ Result object:', JSON.stringify(result, null, 2));
        
        ticketsParaCorrigir = result.results || [];
        console.log(`[BACKEND] ✓ Resultado: ${ticketsParaCorrigir.length} tickets encontrados`);
        
      } catch (dbError: any) {
        console.error('[BACKEND] ❌ ERRO na query específica:', dbError);
        console.error('[BACKEND] ❌ Tipo:', dbError.constructor?.name);
        console.error('[BACKEND] ❌ Mensagem:', dbError.message);
        console.error('[BACKEND] ❌ Stack:', dbError.stack);
        throw dbError;
      }
    } else {
      // Corrigir todos os tickets sem SLA do setor TI
      console.log('[BACKEND] ⚡ Modo: Corrigir TODOS os tickets do TI sem SLA');
      
      try {
        const query = `SELECT 
          c.id,
          c.numero,
          c.tipo,
          c.prioridade,
          c.setor_destino_id,
          c.categoria_id,
          c.subcategoria_id,
          c.item_id,
          c.data_abertura,
          c.afeta_paciente
        FROM chamados c
        WHERE c.setor_destino_id = 1
        AND (c.prazo_resposta IS NULL OR c.prazo_solucao IS NULL OR c.sla_id IS NULL)`;
        
        console.log('[BACKEND] ✓ Query montada:', query);
        console.log('[BACKEND] ⏳ Executando query no banco de dados...');
        
        const stmt = c.env.DB.prepare(query);
        console.log('[BACKEND] ✓ Statement preparado');
        
        const result = await stmt.all();
        console.log('[BACKEND] ✓ Query executada com sucesso');
        console.log('[BACKEND] ✓ Result meta:', { 
          success: result.success, 
          hasResults: !!result.results,
          resultsLength: result.results?.length || 0
        });
        
        ticketsParaCorrigir = result.results || [];
        console.log(`[BACKEND] ✓ Resultado: ${ticketsParaCorrigir.length} tickets encontrados`);
        
        if (ticketsParaCorrigir.length > 0) {
          console.log('[BACKEND] ✓ Primeiro ticket (exemplo):', JSON.stringify(ticketsParaCorrigir[0], null, 2));
        }
        
      } catch (dbError: any) {
        console.error('[BACKEND] ❌ ERRO na query geral:', dbError);
        console.error('[BACKEND] ❌ Tipo:', dbError.constructor?.name);
        console.error('[BACKEND] ❌ Mensagem:', dbError.message);
        console.error('[BACKEND] ❌ Stack:', dbError.stack);
        throw dbError;
      }
    }

    console.log(`\n[RESUMO INICIAL] Encontrados ${ticketsParaCorrigir.length} tickets para processar\n`);

    let corrigidos = 0;
    let erros = 0;
    const detalhes: any[] = [];

    // Função para calcular prazo SLA (simplificada - sem horário de atendimento)
    const calcularPrazo = (dataInicio: Date, minutos: number): string => {
      const prazo = new Date(dataInicio);
      prazo.setMinutes(prazo.getMinutes() + minutos);
      return prazo.toISOString();
    };

    for (const ticket of ticketsParaCorrigir) {
      try {
        let sla: any = null;
        const setorId = ticket.setor_destino_id || 1;

        console.log(`\n========== PROCESSANDO TICKET ${ticket.numero} ==========`);
        console.log('Dados do ticket:', JSON.stringify({
          id: ticket.id,
          numero: ticket.numero,
          tipo: ticket.tipo,
          prioridade: ticket.prioridade,
          setor_destino_id: ticket.setor_destino_id,
          categoria_id: ticket.categoria_id,
          subcategoria_id: ticket.subcategoria_id,
          item_id: ticket.item_id,
          data_abertura: ticket.data_abertura
        }, null, 2));

        // 1. Tentar buscar SLA pelo item_id (mais específico)
        if (ticket.item_id) {
          console.log(`[ETAPA 1] Buscando SLA por item_id=${ticket.item_id}...`);
          const query = `SELECT * FROM slas WHERE categoria_id = ? AND ativo = 1 LIMIT 1`;
          console.log(`[SQL] ${query} [BIND: ${ticket.item_id}]`);
          
          sla = await c.env.DB.prepare(query).bind(ticket.item_id).first();
          
          if (sla) {
            console.log(`[SUCESSO] SLA encontrado:`, JSON.stringify(sla, null, 2));
          } else {
            console.log(`[INFO] Nenhum SLA encontrado para item_id=${ticket.item_id}`);
          }
        }

        // 2. Se não encontrou, tentar pela subcategoria_id
        if (!sla && ticket.subcategoria_id) {
          console.log(`[ETAPA 2] Buscando SLA por subcategoria_id=${ticket.subcategoria_id}...`);
          const query = `SELECT * FROM slas WHERE categoria_id = ? AND ativo = 1 LIMIT 1`;
          console.log(`[SQL] ${query} [BIND: ${ticket.subcategoria_id}]`);
          
          sla = await c.env.DB.prepare(query).bind(ticket.subcategoria_id).first();
          
          if (sla) {
            console.log(`[SUCESSO] SLA encontrado:`, JSON.stringify(sla, null, 2));
          } else {
            console.log(`[INFO] Nenhum SLA encontrado para subcategoria_id=${ticket.subcategoria_id}`);
          }
        }

        // 3. Se não encontrou, tentar pela categoria_id
        if (!sla && ticket.categoria_id) {
          console.log(`[ETAPA 3] Buscando SLA por categoria_id=${ticket.categoria_id}...`);
          const query = `SELECT * FROM slas WHERE categoria_id = ? AND ativo = 1 LIMIT 1`;
          console.log(`[SQL] ${query} [BIND: ${ticket.categoria_id}]`);
          
          sla = await c.env.DB.prepare(query).bind(ticket.categoria_id).first();
          
          if (sla) {
            console.log(`[SUCESSO] SLA encontrado:`, JSON.stringify(sla, null, 2));
          } else {
            console.log(`[INFO] Nenhum SLA encontrado para categoria_id=${ticket.categoria_id}`);
          }
        }

        // 4. Se não encontrou, buscar SLA genérico por tipo + prioridade + setor (TI = 1)
        if (!sla) {
          console.log(`[ETAPA 4] Buscando SLA genérico para tipo=${ticket.tipo}, prioridade=${ticket.prioridade}, setor=1...`);
          const query = `SELECT * FROM slas WHERE tipo_chamado = ? AND prioridade = ? AND (categoria_id IS NULL OR categoria_id = 'null') AND setor_id = 1 AND ativo = 1 LIMIT 1`;
          console.log(`[SQL] ${query} [BIND: '${ticket.tipo}', '${ticket.prioridade}']`);
          
          sla = await c.env.DB.prepare(query).bind(ticket.tipo, ticket.prioridade).first();
          
          if (sla) {
            console.log(`[SUCESSO] SLA genérico encontrado:`, JSON.stringify(sla, null, 2));
          } else {
            console.log(`[ERRO] Nenhum SLA genérico encontrado!`);
            
            // Buscar SLAs genéricos disponíveis para debug
            const slasDisponiveis = await c.env.DB.prepare(
              `SELECT id, nome, tipo_chamado, prioridade, setor_id, categoria_id, ativo 
               FROM slas 
               WHERE (categoria_id IS NULL OR categoria_id = 'null') 
               AND setor_id = 1 
               AND ativo = 1
               ORDER BY tipo_chamado, prioridade`
            ).all();
            console.log(`[DEBUG] SLAs genéricos TI disponíveis no banco:`, JSON.stringify(slasDisponiveis.results, null, 2));
          }
        }

        if (!sla) {
          console.error(`[FALHA] Nenhum SLA encontrado para ticket ${ticket.numero}`);
          
          // Verificar se o ticket tem categoria_id definida
          if (!ticket.categoria_id && !ticket.subcategoria_id && !ticket.item_id) {
            console.log(`[DIAGNÓSTICO] Ticket sem categoria, subcategoria ou item definidos`);
            console.log(`[DIAGNÓSTICO] tipo=${ticket.tipo}, prioridade=${ticket.prioridade}`);
            
            // Tentar buscar um SLA genérico com mais flexibilidade
            console.log(`[TENTATIVA ADICIONAL] Buscando qualquer SLA genérico de TI...`);
            sla = await c.env.DB.prepare(
              `SELECT * FROM slas 
               WHERE setor_id = 1 
               AND ativo = 1 
               AND (categoria_id IS NULL OR categoria_id = 'null')
               ORDER BY 
                 CASE 
                   WHEN tipo_chamado = ? AND prioridade = ? THEN 1
                   WHEN tipo_chamado = ? THEN 2
                   WHEN prioridade = ? THEN 3
                   ELSE 4
                 END
               LIMIT 1`
            ).bind(ticket.tipo, ticket.prioridade, ticket.tipo, ticket.prioridade).first();
            
            if (sla) {
              console.log(`[SUCESSO ADICIONAL] SLA genérico encontrado com busca flexível:`, JSON.stringify(sla, null, 2));
            }
          }
          
          if (!sla) {
            erros++;
            detalhes.push({
              ticket_id: ticket.id,
              numero: ticket.numero,
              status: 'erro',
              mensagem: `SLA não encontrado. Tipo=${ticket.tipo}, Prioridade=${ticket.prioridade}, Categoria=${ticket.categoria_id || 'N/A'}, Subcategoria=${ticket.subcategoria_id || 'N/A'}, Item=${ticket.item_id || 'N/A'}`,
              categoria_id: ticket.categoria_id,
              subcategoria_id: ticket.subcategoria_id,
              item_id: ticket.item_id,
              tipo: ticket.tipo,
              prioridade: ticket.prioridade
            });
            console.log(`========== FIM DO TICKET ${ticket.numero} (ERRO - SEM SLA) ==========\n`);
            continue;
          }
        }

        // Para Manutenção/Hotelaria: se afeta paciente, ajustar SLA
        if ((setorId === 7 || setorId === 8) && ticket.afeta_paciente === 1) {
          console.log(`[INFO] Ticket afeta paciente - verificando ajuste de SLA...`);
          if (sla.tempo_solucao_minutos === 360) {
            console.log(`[AJUSTE] Reduzindo tempo de solução de 360 para 240 minutos (afeta paciente)`);
            sla = { ...sla, tempo_solucao_minutos: 240 };
          }
        }

        // Calcular prazos
        console.log(`[CÁLCULO] Calculando prazos SLA...`);
        const dataAbertura = new Date(ticket.data_abertura);
        
        // REGRA TI: Prazo de resposta SEMPRE 60 minutos (1 hora) independente do SLA
        const prazoResposta = (setorId === 1)
          ? calcularPrazo(dataAbertura, 60) // TI sempre 1 hora
          : (sla.tempo_resposta_minutos > 0)
            ? calcularPrazo(dataAbertura, sla.tempo_resposta_minutos)
            : null;
        
        // Prazo de resolução vem do SLA da categoria
        const prazoSolucao = calcularPrazo(dataAbertura, sla.tempo_solucao_minutos);

        console.log(`[PRAZOS]`, {
          data_abertura: ticket.data_abertura,
          setor_id: setorId,
          tempo_resposta_original_sla: sla.tempo_resposta_minutos,
          tempo_resposta_aplicado: setorId === 1 ? 60 : sla.tempo_resposta_minutos,
          prazo_resposta: prazoResposta,
          tempo_solucao_minutos: sla.tempo_solucao_minutos,
          prazo_solucao: prazoSolucao
        });

        // Atualizar ticket
        console.log(`[UPDATE] Atualizando ticket no banco de dados...`);
        const updateQuery = `UPDATE chamados SET sla_id = ?, prazo_resposta = ?, prazo_solucao = ? WHERE id = ?`;
        console.log(`[SQL] ${updateQuery} [BIND: ${sla.id}, ${prazoResposta}, ${prazoSolucao}, ${ticket.id}]`);
        
        await c.env.DB.prepare(updateQuery).bind(sla.id, prazoResposta, prazoSolucao, ticket.id).run();

        console.log(`[SUCESSO] Ticket ${ticket.numero} corrigido com sucesso!`);
        corrigidos++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          status: 'corrigido',
          sla_id: sla.id,
          sla_nome: sla.nome,
          tempo_resposta: sla.tempo_resposta_minutos,
          tempo_solucao: sla.tempo_solucao_minutos,
          prazo_resposta: prazoResposta,
          prazo_solucao: prazoSolucao
        });
        console.log(`========== FIM DO TICKET ${ticket.numero} (SUCESSO) ==========\n`);

      } catch (error: any) {
        console.error(`[EXCEÇÃO] Erro ao processar ticket ${ticket.numero}:`, error);
        console.error('[STACK]', error.stack);
        erros++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          status: 'erro',
          mensagem: error.message,
          stack: error.stack
        });
        console.log(`========== FIM DO TICKET ${ticket.numero} (EXCEÇÃO) ==========\n`);
      }
    }

    console.log(`\n========== RESUMO DA CORREÇÃO ==========`);
    console.log(`Total processados: ${ticketsParaCorrigir.length}`);
    console.log(`Corrigidos: ${corrigidos}`);
    console.log(`Erros: ${erros}`);
    console.log(`========================================\n`);
    
    // Listar tickets que falharam
    if (erros > 0) {
      console.log('\n❌ TICKETS QUE FALHARAM:');
      const ticketsComErro = detalhes.filter(d => d.status === 'erro');
      ticketsComErro.forEach(t => {
        console.log(`   - ${t.numero}: ${t.mensagem}`);
      });
      console.log('\n');
    }

    return c.json({
      sucesso: true,
      total_processados: ticketsParaCorrigir.length,
      tickets_corrigidos: corrigidos,
      tickets_sem_sla: erros,
      tickets_sem_categoria: detalhes.filter(d => d.status === 'erro' && !d.categoria_id && !d.subcategoria_id && !d.item_id).length,
      detalhes
    });

  } catch (error: any) {
    console.error("\n╔═══════════════════════════════════════════════════════════╗");
    console.error("║  ERRO FATAL CAPTURADO NO TRY/CATCH PRINCIPAL             ║");
    console.error("╚═══════════════════════════════════════════════════════════╝\n");
    console.error("[ERRO FATAL] ❌ Tipo do erro:", error.constructor?.name || 'Unknown');
    console.error("[ERRO FATAL] ❌ Mensagem:", error.message);
    console.error("[ERRO FATAL] ❌ Stack completo:", error.stack);
    console.error("[ERRO FATAL] ❌ Objeto erro completo:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    return c.json({ 
      sucesso: false,
      error: error.message || 'Erro desconhecido', 
      stack: error.stack,
      tipo: error.constructor?.name || 'Unknown',
      detalhes_completos: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    }, 500);
  } finally {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  ENDPOINT /corrigir FINALIZADO                            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
  }
});

// POST - Limpar prazo_resposta de tickets com SLA de tempo_resposta = 0
app.post("/limpar-prazo-resposta-zerado", async (c) => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  LIMPAR PRAZO RESPOSTA (SLA ZERADO) - INÍCIO             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  try {
    // Buscar todos os tickets DA TI que têm prazo_resposta preenchido mas SLA com tempo_resposta_minutos = 0
    const ticketsParaLimpar = await c.env.DB.prepare(
      `SELECT 
        c.id,
        c.numero,
        c.setor_destino_id,
        c.prazo_resposta,
        c.sla_id,
        c.status,
        s.nome as sla_nome,
        s.tempo_resposta_minutos,
        setor.nome as setor_nome
      FROM chamados c
      LEFT JOIN slas s ON c.sla_id = s.id
      LEFT JOIN setores setor ON c.setor_destino_id = setor.id
      WHERE c.prazo_resposta IS NOT NULL
      AND s.tempo_resposta_minutos = 0
      AND c.setor_destino_id = 1`
    ).all<{
      id: number;
      numero: string;
      setor_destino_id: number;
      prazo_resposta: string;
      sla_id: number;
      status: string;
      sla_nome: string;
      tempo_resposta_minutos: number;
      setor_nome: string;
    }>();

    console.log(`[INFO] Encontrados ${ticketsParaLimpar.results?.length || 0} tickets com prazo_resposta preenchido mas SLA zerado`);

    const tickets = ticketsParaLimpar.results || [];
    let limpos = 0;
    let erros = 0;
    const detalhes: any[] = [];

    for (const ticket of tickets) {
      try {
        console.log(`[PROCESSANDO] Ticket ${ticket.numero}:`, {
          setor: ticket.setor_nome,
          sla_nome: ticket.sla_nome,
          tempo_resposta_minutos: ticket.tempo_resposta_minutos,
          prazo_resposta_atual: ticket.prazo_resposta
        });

        // Limpar o prazo_resposta (setar para NULL)
        await c.env.DB.prepare(
          `UPDATE chamados SET prazo_resposta = NULL WHERE id = ?`
        ).bind(ticket.id).run();

        limpos++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          setor: ticket.setor_nome,
          sla_nome: ticket.sla_nome,
          status: 'limpo',
          prazo_resposta_removido: ticket.prazo_resposta
        });

        console.log(`[SUCESSO] Ticket ${ticket.numero} - prazo_resposta removido!`);

      } catch (error: any) {
        console.error(`[ERRO] Falha ao limpar ticket ${ticket.numero}:`, error);
        erros++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          status: 'erro',
          mensagem: error.message
        });
      }
    }

    console.log(`\n[RESUMO] Total: ${tickets.length}, Limpos: ${limpos}, Erros: ${erros}\n`);

    return c.json({
      sucesso: true,
      total_processados: tickets.length,
      tickets_limpos: limpos,
      tickets_com_erro: erros,
      detalhes
    });

  } catch (error: any) {
    console.error("[ERRO FATAL]", error);
    return c.json({ 
      sucesso: false,
      error: error.message 
    }, 500);
  }
});

// POST - Corrigir apenas prazo_resposta dos tickets TI
app.post("/corrigir-prazo-resposta", async (c) => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  CORRIGIR PRAZO RESPOSTA TI - INÍCIO                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  try {
    // Buscar todos os tickets da TI com prazo_resposta NULL (incluindo fechados)
    const ticketsSemPrazo = await c.env.DB.prepare(
      `SELECT 
        id,
        numero,
        data_abertura,
        prazo_resposta,
        sla_id,
        status
      FROM chamados
      WHERE setor_destino_id = 1
      AND prazo_resposta IS NULL`
    ).all<{
      id: number;
      numero: string;
      data_abertura: string;
      prazo_resposta: string | null;
      sla_id: number | null;
      status: string;
    }>();

    console.log(`[INFO] Encontrados ${ticketsSemPrazo.results?.length || 0} tickets TI sem prazo_resposta`);

    const tickets = ticketsSemPrazo.results || [];
    let corrigidos = 0;
    let erros = 0;
    const detalhes: any[] = [];

    // Função para calcular prazo (60 minutos para TI)
    const calcularPrazoResposta = (dataAbertura: string): string => {
      const data = new Date(dataAbertura);
      data.setMinutes(data.getMinutes() + 60); // TI sempre 60 minutos
      return data.toISOString();
    };

    for (const ticket of tickets) {
      try {
        const prazoResposta = calcularPrazoResposta(ticket.data_abertura);
        
        console.log(`[PROCESSANDO] Ticket ${ticket.numero}:`, {
          status: ticket.status,
          data_abertura: ticket.data_abertura,
          prazo_resposta_calculado: prazoResposta
        });

        // Atualizar apenas o prazo_resposta
        await c.env.DB.prepare(
          `UPDATE chamados SET prazo_resposta = ? WHERE id = ?`
        ).bind(prazoResposta, ticket.id).run();

        corrigidos++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          ticket_status: ticket.status,
          status: 'corrigido',
          prazo_resposta_antigo: ticket.prazo_resposta,
          prazo_resposta_novo: prazoResposta
        });

        console.log(`[SUCESSO] Ticket ${ticket.numero} corrigido!`);

      } catch (error: any) {
        console.error(`[ERRO] Falha ao corrigir ticket ${ticket.numero}:`, error);
        erros++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          status: 'erro',
          mensagem: error.message
        });
      }
    }

    console.log(`\n[RESUMO] Total: ${tickets.length}, Corrigidos: ${corrigidos}, Erros: ${erros}\n`);

    return c.json({
      sucesso: true,
      total_processados: tickets.length,
      tickets_corrigidos: corrigidos,
      tickets_com_erro: erros,
      detalhes
    });

  } catch (error: any) {
    console.error("[ERRO FATAL]", error);
    return c.json({ 
      sucesso: false,
      error: error.message 
    }, 500);
  }
});

// POST - Corrigir SLAs de um setor específico
app.post("/corrigir-setor", async (c) => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  CORREÇÃO POR SETOR ESPECÍFICO - INÍCIO                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  try {
    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      console.error('[ERRO] Falha ao fazer parse do JSON:', e);
      return c.json({ error: 'JSON inválido no body da requisição' }, 400);
    }
    
    console.log('[DEBUG] Body recebido:', JSON.stringify(body));
    
    const setorId = body?.setor_id;
    
    if (!setorId) {
      console.error('[ERRO] setor_id não fornecido. Body:', body);
      return c.json({ error: 'setor_id é obrigatório' }, 400);
    }
    
    console.log('[INFO] setor_id extraído:', setorId, 'tipo:', typeof setorId);

    console.log(`[INFO] Corrigindo tickets do setor ID: ${setorId}`);

    // Buscar setor para log
    const setor = await c.env.DB.prepare(
      `SELECT nome FROM setores WHERE id = ?`
    ).bind(setorId).first<{ nome: string }>();
    
    console.log(`[INFO] Setor: ${setor?.nome || 'Desconhecido'}`);

    // Buscar tickets sem SLA do setor específico
    const ticketsParaCorrigir = await c.env.DB.prepare(
      `SELECT 
        c.id,
        c.numero,
        c.tipo,
        c.prioridade,
        c.setor_destino_id,
        c.categoria_id,
        c.subcategoria_id,
        c.item_id,
        c.data_abertura,
        c.afeta_paciente
      FROM chamados c
      WHERE c.setor_destino_id = ?
      AND (c.prazo_resposta IS NULL OR c.prazo_solucao IS NULL OR c.sla_id IS NULL)`
    ).bind(setorId).all<{
      id: number;
      numero: string;
      tipo: string;
      prioridade: string;
      setor_destino_id: number;
      categoria_id: number | null;
      subcategoria_id: number | null;
      item_id: number | null;
      data_abertura: string;
      afeta_paciente: number;
    }>();

    const tickets = ticketsParaCorrigir.results || [];
    console.log(`[INFO] Encontrados ${tickets.length} tickets para corrigir`);

    let corrigidos = 0;
    let erros = 0;
    const detalhes: any[] = [];

    // Função para calcular prazo SLA
    const calcularPrazo = (dataInicio: Date, minutos: number): string => {
      const prazo = new Date(dataInicio);
      prazo.setMinutes(prazo.getMinutes() + minutos);
      return prazo.toISOString();
    };

    for (const ticket of tickets) {
      try {
        let sla: any = null;

        console.log(`\n[PROCESSANDO] Ticket ${ticket.numero}`);

        // 1. Tentar buscar SLA pelo item_id
        if (ticket.item_id) {
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas WHERE categoria_id = ? AND ativo = 1 LIMIT 1`
          ).bind(ticket.item_id).first();
          
          if (sla) console.log(`[SUCESSO] SLA encontrado por item_id`);
        }

        // 2. Se não encontrou, tentar pela subcategoria_id
        if (!sla && ticket.subcategoria_id) {
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas WHERE categoria_id = ? AND ativo = 1 LIMIT 1`
          ).bind(ticket.subcategoria_id).first();
          
          if (sla) console.log(`[SUCESSO] SLA encontrado por subcategoria_id`);
        }

        // 3. Se não encontrou, tentar pela categoria_id
        if (!sla && ticket.categoria_id) {
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas WHERE categoria_id = ? AND ativo = 1 LIMIT 1`
          ).bind(ticket.categoria_id).first();
          
          if (sla) console.log(`[SUCESSO] SLA encontrado por categoria_id`);
        }

        // 4. Se não encontrou, buscar SLA genérico por tipo + prioridade + setor
        if (!sla) {
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE tipo_chamado = ? 
             AND prioridade = ? 
             AND setor_id = ?
             AND (categoria_id IS NULL OR categoria_id = 'null') 
             AND ativo = 1 
             LIMIT 1`
          ).bind(ticket.tipo, ticket.prioridade, setorId).first();
          
          if (sla) console.log(`[SUCESSO] SLA genérico encontrado`);
        }

        if (!sla) {
          console.error(`[FALHA] SLA não encontrado para ${ticket.numero}`);
          erros++;
          detalhes.push({
            ticket_id: ticket.id,
            numero: ticket.numero,
            status: 'erro',
            mensagem: `SLA não encontrado (Tipo=${ticket.tipo}, Prioridade=${ticket.prioridade})`
          });
          continue;
        }

        // Para Manutenção/Hotelaria: se afeta paciente, ajustar SLA
        if ((setorId === 7 || setorId === 8) && ticket.afeta_paciente === 1) {
          if (sla.tempo_solucao_minutos === 360) {
            sla = { ...sla, tempo_solucao_minutos: 240 };
          }
        }

        // Calcular prazos
        const dataAbertura = new Date(ticket.data_abertura);
        
        // Prazo de resposta APENAS para TI (setor_id = 1) e se tempo_resposta_minutos > 0
        const prazoResposta = (setorId === 1 && sla.tempo_resposta_minutos > 0)
          ? calcularPrazo(dataAbertura, sla.tempo_resposta_minutos)
          : null;
        
        const prazoSolucao = calcularPrazo(dataAbertura, sla.tempo_solucao_minutos);
        
        console.log(`[SLA] Setor ${setorId === 1 ? 'TI' : 'Outro'} - Prazo Resposta: ${prazoResposta ? 'SIM' : 'NÃO'}, Prazo Solução: SIM`);

        // Atualizar ticket
        await c.env.DB.prepare(
          `UPDATE chamados SET sla_id = ?, prazo_resposta = ?, prazo_solucao = ? WHERE id = ?`
        ).bind(sla.id, prazoResposta, prazoSolucao, ticket.id).run();

        console.log(`[SUCESSO] ${ticket.numero} corrigido`);
        corrigidos++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          status: 'corrigido',
          sla_nome: sla.nome
        });

      } catch (error: any) {
        console.error(`[ERRO] ${ticket.numero}:`, error.message);
        erros++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          status: 'erro',
          mensagem: error.message
        });
      }
    }

    console.log(`\n[RESUMO] Setor: ${setor?.nome}`);
    console.log(`Total: ${tickets.length}, Corrigidos: ${corrigidos}, Erros: ${erros}\n`);

    return c.json({
      sucesso: true,
      setor_id: setorId,
      setor_nome: setor?.nome || 'Desconhecido',
      total_processados: tickets.length,
      tickets_corrigidos: corrigidos,
      tickets_com_erro: erros,
      detalhes
    });

  } catch (error: any) {
    console.error("[ERRO FATAL]", error);
    return c.json({ 
      sucesso: false,
      error: error.message 
    }, 500);
  }
});

// GET - Diagnóstico específico de chamados recorrentes
app.get("/diagnostico-recorrentes", async (c) => {
  try {
    // Total de chamados recorrentes
    const totalRecorrentes = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados WHERE origem_recorrente_id IS NOT NULL`
    ).first<{ total: number }>();

    // Recorrentes do setor TI
    const recorrentesTI = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados WHERE origem_recorrente_id IS NOT NULL AND setor_destino_id = 1`
    ).first<{ total: number }>();

    // Recorrentes TI sem prazo_resposta
    const tiSemPrazoResposta = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados 
       WHERE origem_recorrente_id IS NOT NULL 
       AND setor_destino_id = 1 
       AND prazo_resposta IS NULL`
    ).first<{ total: number }>();

    // Recorrentes TI sem prazo_solucao
    const tiSemPrazoSolucao = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados 
       WHERE origem_recorrente_id IS NOT NULL 
       AND setor_destino_id = 1 
       AND prazo_solucao IS NULL`
    ).first<{ total: number }>();

    // Recorrentes TI sem sla_id
    const tiSemSlaId = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados 
       WHERE origem_recorrente_id IS NOT NULL 
       AND setor_destino_id = 1 
       AND sla_id IS NULL`
    ).first<{ total: number }>();

    // Recorrentes TI com SLA mas tempo_resposta = 0 (aparecem como N/A)
    const tiComSlaTempoZero = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados c
       JOIN slas s ON c.sla_id = s.id
       WHERE c.origem_recorrente_id IS NOT NULL 
       AND c.setor_destino_id = 1 
       AND s.tempo_resposta_minutos = 0`
    ).first<{ total: number }>();

    // Detalhes dos chamados recorrentes TI sem SLA completo (primeiros 50)
    const detalhes = await c.env.DB.prepare(
      `SELECT 
        c.id,
        c.numero,
        c.titulo,
        c.tipo,
        c.prioridade,
        c.setor_destino_id,
        c.categoria_id,
        c.subcategoria_id,
        c.item_id,
        c.tipo_problema,
        c.data_abertura,
        c.prazo_resposta,
        c.prazo_solucao,
        c.sla_id,
        c.origem_recorrente_id,
        c.status,
        cat.nome as categoria_nome,
        s.nome as sla_nome,
        s.tempo_resposta_minutos,
        s.tempo_solucao_minutos
      FROM chamados c
      LEFT JOIN categorias cat ON c.categoria_id = cat.id
      LEFT JOIN slas s ON c.sla_id = s.id
      WHERE c.origem_recorrente_id IS NOT NULL
      AND c.setor_destino_id = 1
      AND (c.prazo_resposta IS NULL OR c.prazo_solucao IS NULL OR c.sla_id IS NULL)
      ORDER BY c.id DESC
      LIMIT 50`
    ).all();

    // Detalhes dos chamados recorrentes com SLA mas tempo_resposta = 0 (primeiros 50)
    const detalhesTempoZero = await c.env.DB.prepare(
      `SELECT 
        c.id,
        c.numero,
        c.titulo,
        c.tipo,
        c.prioridade,
        c.setor_destino_id,
        c.categoria_id,
        c.subcategoria_id,
        c.item_id,
        c.tipo_problema,
        c.data_abertura,
        c.prazo_resposta,
        c.prazo_solucao,
        c.sla_id,
        c.origem_recorrente_id,
        c.status,
        cat.nome as categoria_nome,
        s.nome as sla_nome,
        s.tempo_resposta_minutos,
        s.tempo_solucao_minutos
      FROM chamados c
      LEFT JOIN categorias cat ON c.categoria_id = cat.id
      JOIN slas s ON c.sla_id = s.id
      WHERE c.origem_recorrente_id IS NOT NULL
      AND c.setor_destino_id = 1
      AND s.tempo_resposta_minutos = 0
      ORDER BY c.id DESC
      LIMIT 50`
    ).all();

    return c.json({
      sucesso: true,
      resumo: {
        total_recorrentes: totalRecorrentes?.total || 0,
        recorrentes_ti: recorrentesTI?.total || 0,
        ti_sem_prazo_resposta: tiSemPrazoResposta?.total || 0,
        ti_sem_prazo_solucao: tiSemPrazoSolucao?.total || 0,
        ti_sem_sla_id: tiSemSlaId?.total || 0,
        ti_com_sla_tempo_zero: tiComSlaTempoZero?.total || 0
      },
      detalhes: detalhes.results || [],
      detalhes_tempo_zero: detalhesTempoZero.results || []
    });

  } catch (error: any) {
    console.error("[ERRO DIAGNÓSTICO RECORRENTES]", error);
    return c.json({ 
      sucesso: false,
      error: error.message 
    }, 500);
  }
});

// POST - Corrigir chamados recorrentes
app.post("/corrigir-recorrentes", async (c) => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  CORRIGIR CHAMADOS RECORRENTES - INÍCIO                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  try {
    // Buscar chamados recorrentes TI com SLA ERRADO (tempo_resposta = 0, que são SLAs de outros setores)
    const ticketsRecorrentes = await c.env.DB.prepare(
      `SELECT 
        c.id,
        c.numero,
        c.tipo,
        c.prioridade,
        c.setor_destino_id,
        c.categoria_id,
        c.subcategoria_id,
        c.item_id,
        c.data_abertura,
        c.afeta_paciente,
        c.prazo_resposta,
        c.prazo_solucao,
        c.sla_id,
        c.origem_recorrente_id,
        s.nome as sla_nome_atual,
        s.tempo_resposta_minutos as tempo_resposta_atual
      FROM chamados c
      LEFT JOIN slas s ON c.sla_id = s.id
      WHERE c.origem_recorrente_id IS NOT NULL
      AND c.setor_destino_id = 1
      AND (
        (c.sla_id IS NOT NULL AND s.tempo_resposta_minutos = 0)
        OR c.prazo_resposta IS NULL 
        OR c.prazo_solucao IS NULL 
        OR c.sla_id IS NULL
      )`
    ).all<{
      id: number;
      numero: string;
      tipo: string;
      prioridade: string;
      setor_destino_id: number;
      categoria_id: number | null;
      subcategoria_id: number | null;
      item_id: number | null;
      data_abertura: string;
      afeta_paciente: number;
      prazo_resposta: string | null;
      prazo_solucao: string | null;
      sla_id: number | null;
      origem_recorrente_id: number;
      sla_nome_atual: string | null;
      tempo_resposta_atual: number | null;
    }>();

    console.log(`[INFO] Encontrados ${ticketsRecorrentes.results?.length || 0} chamados recorrentes TI com SLA errado ou sem SLA`);

    const tickets = ticketsRecorrentes.results || [];
    let corrigidos = 0;
    let erros = 0;
    const detalhes: any[] = [];

    // Função para calcular prazo SLA
    const calcularPrazo = (dataInicio: Date, minutos: number): string => {
      const prazo = new Date(dataInicio);
      prazo.setMinutes(prazo.getMinutes() + minutos);
      return prazo.toISOString();
    };

    for (const ticket of tickets) {
      try {
        let sla: any = null;
        const setorId = ticket.setor_destino_id || 1;

        console.log(`\n========== PROCESSANDO TICKET RECORRENTE ${ticket.numero} ==========`);
        console.log('Dados:', JSON.stringify({
          id: ticket.id,
          numero: ticket.numero,
          origem_recorrente_id: ticket.origem_recorrente_id,
          sla_atual: ticket.sla_nome_atual,
          tempo_resposta_atual: ticket.tempo_resposta_atual,
          tipo: ticket.tipo,
          prioridade: ticket.prioridade,
          setor_destino_id: ticket.setor_destino_id,
          categoria_id: ticket.categoria_id,
          subcategoria_id: ticket.subcategoria_id,
          item_id: ticket.item_id
        }, null, 2));

        // 1. Tentar buscar SLA pelo item_id - VALIDANDO O SETOR
        if (ticket.item_id) {
          console.log(`[ETAPA 1] Buscando SLA por item_id=${ticket.item_id} e setor=${setorId}...`);
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE categoria_id = ? 
             AND (setor_id = ? OR setor_id IS NULL)
             AND ativo = 1 
             ORDER BY setor_id DESC
             LIMIT 1`
          ).bind(ticket.item_id, setorId).first();
          
          if (sla) {
            console.log(`[SUCESSO] SLA encontrado por item_id: ${sla.nome} (setor_id=${sla.setor_id})`);
          }
        }

        // 2. Se não encontrou, tentar pela subcategoria_id - VALIDANDO O SETOR
        if (!sla && ticket.subcategoria_id) {
          console.log(`[ETAPA 2] Buscando SLA por subcategoria_id=${ticket.subcategoria_id} e setor=${setorId}...`);
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE categoria_id = ? 
             AND (setor_id = ? OR setor_id IS NULL)
             AND ativo = 1 
             ORDER BY setor_id DESC
             LIMIT 1`
          ).bind(ticket.subcategoria_id, setorId).first();
          
          if (sla) {
            console.log(`[SUCESSO] SLA encontrado por subcategoria_id: ${sla.nome} (setor_id=${sla.setor_id})`);
          }
        }

        // 3. Se não encontrou, tentar pela categoria_id - VALIDANDO O SETOR
        if (!sla && ticket.categoria_id) {
          console.log(`[ETAPA 3] Buscando SLA por categoria_id=${ticket.categoria_id} e setor=${setorId}...`);
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE categoria_id = ? 
             AND (setor_id = ? OR setor_id IS NULL)
             AND ativo = 1 
             ORDER BY setor_id DESC
             LIMIT 1`
          ).bind(ticket.categoria_id, setorId).first();
          
          if (sla) {
            console.log(`[SUCESSO] SLA encontrado por categoria_id: ${sla.nome} (setor_id=${sla.setor_id})`);
          }
        }

        // 4. Se não encontrou, buscar SLA genérico por tipo + prioridade + setor
        if (!sla) {
          console.log(`[ETAPA 4] Buscando SLA genérico para tipo=${ticket.tipo}, prioridade=${ticket.prioridade}, setor=${setorId}...`);
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE tipo_chamado = ? 
             AND prioridade = ? 
             AND (setor_id = ? OR setor_id IS NULL)
             AND ativo = 1 
             ORDER BY setor_id DESC
             LIMIT 1`
          ).bind(ticket.tipo, ticket.prioridade, setorId).first();
          
          if (sla) {
            console.log(`[SUCESSO] SLA genérico encontrado: ${sla.nome} (setor_id=${sla.setor_id})`);
          }
        }

        if (!sla) {
          console.error(`[FALHA] Nenhum SLA encontrado para ticket recorrente ${ticket.numero}`);
          erros++;
          detalhes.push({
            ticket_id: ticket.id,
            numero: ticket.numero,
            origem_recorrente_id: ticket.origem_recorrente_id,
            status: 'erro',
            mensagem: `SLA não encontrado. Tipo=${ticket.tipo}, Prioridade=${ticket.prioridade}, Categoria=${ticket.categoria_id || 'N/A'}, Setor=${setorId}`,
            categoria_id: ticket.categoria_id,
            subcategoria_id: ticket.subcategoria_id,
            item_id: ticket.item_id,
            tipo: ticket.tipo,
            prioridade: ticket.prioridade
          });
          continue;
        }

        // Para Manutenção/Hotelaria: se afeta paciente, ajustar SLA
        if ((setorId === 7 || setorId === 8) && ticket.afeta_paciente === 1) {
          console.log(`[INFO] Ticket afeta paciente - ajustando SLA...`);
          if (sla.tempo_solucao_minutos === 360) {
            sla = { ...sla, tempo_solucao_minutos: 240 };
          }
        }

        // Calcular prazos
        console.log(`[CÁLCULO] Calculando prazos SLA...`);
        const dataAbertura = new Date(ticket.data_abertura);
        
        // Prazo de resposta SOMENTE se tempo_resposta_minutos > 0
        const prazoResposta = (sla.tempo_resposta_minutos > 0)
          ? calcularPrazo(dataAbertura, sla.tempo_resposta_minutos)
          : null;
        
        // Prazo de resolução sempre vem do SLA
        const prazoSolucao = calcularPrazo(dataAbertura, sla.tempo_solucao_minutos);

        console.log(`[PRAZOS]`, {
          sla_nome: sla.nome,
          tempo_resposta_minutos: sla.tempo_resposta_minutos,
          tempo_solucao_minutos: sla.tempo_solucao_minutos,
          prazo_resposta: prazoResposta,
          prazo_solucao: prazoSolucao
        });

        // Atualizar ticket
        console.log(`[UPDATE] Atualizando ticket recorrente no banco de dados...`);
        await c.env.DB.prepare(
          `UPDATE chamados SET sla_id = ?, prazo_resposta = ?, prazo_solucao = ? WHERE id = ?`
        ).bind(sla.id, prazoResposta, prazoSolucao, ticket.id).run();

        console.log(`[SUCESSO] Ticket recorrente ${ticket.numero} corrigido!`);
        corrigidos++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          origem_recorrente_id: ticket.origem_recorrente_id,
          status: 'corrigido',
          sla_id: sla.id,
          sla_nome: sla.nome,
          tempo_resposta: sla.tempo_resposta_minutos,
          tempo_solucao: sla.tempo_solucao_minutos,
          prazo_resposta: prazoResposta,
          prazo_solucao: prazoSolucao
        });

      } catch (error: any) {
        console.error(`[EXCEÇÃO] Erro ao processar ticket recorrente ${ticket.numero}:`, error);
        erros++;
        detalhes.push({
          ticket_id: ticket.id,
          numero: ticket.numero,
          origem_recorrente_id: ticket.origem_recorrente_id,
          status: 'erro',
          mensagem: error.message
        });
      }
    }

    console.log(`\n========== RESUMO DA CORREÇÃO DE RECORRENTES ==========`);
    console.log(`Total processados: ${tickets.length}`);
    console.log(`Corrigidos: ${corrigidos}`);
    console.log(`Erros: ${erros}`);
    console.log(`=======================================================\n`);

    return c.json({
      sucesso: true,
      total_processados: tickets.length,
      tickets_corrigidos: corrigidos,
      tickets_sem_sla: erros,
      detalhes
    });

  } catch (error: any) {
    console.error("[ERRO FATAL]", error);
    return c.json({ 
      sucesso: false,
      error: error.message 
    }, 500);
  }
});

// POST - Limpar prazo_resposta de setores que não são TI
app.post("/limpar-prazo-resposta-nao-ti", async (c) => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  LIMPANDO PRAZO_RESPOSTA DE SETORES NÃO-TI               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Apenas TI (setor_id = 1) deve ter prazo_resposta
    // Todos os outros setores devem ter prazo_resposta = NULL
    
    const result = await c.env.DB.prepare(
      `UPDATE chamados 
       SET prazo_resposta = NULL, 
           data_primeira_resposta = NULL
       WHERE setor_destino_id != 1 
       AND prazo_resposta IS NOT NULL`
    ).run();

    console.log(`[SUCESSO] ${result.meta.changes} tickets atualizados`);
    console.log(`[INFO] Prazo de resposta removido de todos os setores exceto TI\n`);

    return c.json({
      sucesso: true,
      tickets_atualizados: result.meta.changes,
      mensagem: "Prazo de resposta removido com sucesso de todos os setores exceto TI"
    });

  } catch (error: any) {
    console.error("[ERRO FATAL]", error);
    return c.json({ 
      sucesso: false,
      error: error.message 
    }, 500);
  }
});

// GET - Diagnóstico de tickets específicos
app.get("/diagnostico-tickets-especificos", async (c) => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  DIAGNÓSTICO TICKETS ESPECÍFICOS                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  try {
    const numeros = c.req.query("numeros") || "";
    const numerosArray = numeros.split(",").map(n => n.trim()).filter(n => n);
    
    console.log(`[INFO] Buscando tickets:`, numerosArray);

    const tickets: any[] = [];
    
    for (const numero of numerosArray) {
      const result = await c.env.DB.prepare(
        `SELECT 
          c.id,
          c.numero,
          c.titulo,
          c.tipo,
          c.prioridade,
          c.status,
          c.setor_destino_id,
          c.categoria_id,
          c.subcategoria_id,
          c.item_id,
          c.sla_id,
          c.data_abertura,
          c.data_primeira_resposta,
          c.data_resolucao,
          c.prazo_resposta,
          c.prazo_solucao,
          c.origem_recorrente_id,
          LENGTH(c.prazo_resposta) as tamanho_prazo_resposta,
          TYPEOF(c.prazo_resposta) as tipo_prazo_resposta,
          s.nome as setor_nome,
          sla.nome as sla_nome,
          sla.tempo_resposta_minutos,
          sla.tempo_solucao_minutos,
          cat.nome as categoria_nome,
          sub.nome as subcategoria_nome,
          item.nome as item_nome
        FROM chamados c
        LEFT JOIN setores s ON c.setor_destino_id = s.id
        LEFT JOIN slas sla ON c.sla_id = sla.id
        LEFT JOIN categorias cat ON c.categoria_id = cat.id AND cat.tipo = 'categoria'
        LEFT JOIN categorias sub ON c.subcategoria_id = sub.id AND sub.tipo = 'subcategoria'
        LEFT JOIN categorias item ON c.item_id = item.id AND item.tipo = 'item'
        WHERE c.numero = ?`
      ).bind(numero).first();
      
      if (result) {
        tickets.push(result);
        console.log(`[ENCONTRADO] ${numero}:`, {
          prazo_resposta: result.prazo_resposta,
          tipo: result.tipo_prazo_resposta,
          tamanho: result.tamanho_prazo_resposta,
          tempo_resposta_minutos: result.tempo_resposta_minutos
        });
      } else {
        console.log(`[NÃO ENCONTRADO] ${numero}`);
      }
    }

    console.log(`\n[RESUMO] Encontrados ${tickets.length} de ${numerosArray.length} tickets\n`);

    return c.json({
      sucesso: true,
      total_buscados: numerosArray.length,
      total_encontrados: tickets.length,
      tickets
    });

  } catch (error: any) {
    console.error("[ERRO FATAL]", error);
    return c.json({ 
      sucesso: false,
      error: error.message 
    }, 500);
  }
});

export default app;
