import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import { calcularPrazoSLA } from "../utils/sla-calculator";

const router = new Hono<{ Bindings: Env }>();

interface UserProfile {
  id: number;
  user_id: string;
  nome: string;
  email: string;
  perfil: string;
  setor_id: number | null;
}

// Endpoint de diagnóstico para verificar tickets que precisam de correção
router.get("/diagnostico", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'gestor')) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  // Mostrar TODOS os tickets MV independente do SLA atual
  const { results: ticketsMV } = await c.env.DB.prepare(`
    SELECT 
      c.id,
      c.numero,
      c.tipo,
      c.prioridade,
      c.status,
      c.categoria_id,
      c.sla_id,
      s.tempo_solucao_minutos,
      s.nome as sla_nome
    FROM chamados c
    LEFT JOIN slas s ON c.sla_id = s.id
    WHERE c.setor_destino_id = 1 
      AND c.categoria_id = 217
  `).all<any>();

  const totalMV = ticketsMV.length;

  return c.json({
    total_tickets_mv: totalMV,
    tickets_detalhados: ticketsMV,
    mensagem: totalMV > 0 
      ? `${totalMV} tickets da categoria MV precisam ter o SLA recalculado para 72 horas`
      : "Todos os tickets MV já estão com SLA correto"
  });
});

// Endpoint para recalcular SLA de todos os tickets MV para 72 horas
router.post("/corrigir-mv", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'gestor')) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    // Buscar TODOS os tickets MV (categoria_id = 217) do setor TI
    const { results: tickets } = await c.env.DB.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.tipo,
        c.prioridade,
        c.status,
        c.data_abertura,
        c.setor_destino_id,
        c.sla_id,
        c.categoria_id
      FROM chamados c
      WHERE c.setor_destino_id = 1 
        AND c.categoria_id = 217
    `).all<any>();

    console.log(`[SLA MV] Encontrados ${tickets.length} tickets para corrigir`);

    let corrigidos = 0;
    const erros: string[] = [];

    for (const ticket of tickets) {
      try {
        console.log(`[SLA MV] Processando ticket ${ticket.numero} - Tipo: ${ticket.tipo}, Prioridade: ${ticket.prioridade}`);
        
        // Buscar qualquer SLA da categoria MV (não importa tipo/prioridade)
        const sla = await c.env.DB.prepare(`
          SELECT id, tempo_resposta_minutos, tempo_solucao_minutos
          FROM slas
          WHERE categoria_id = 217
            AND ativo = 1
          LIMIT 1
        `).first<any>();

        // Definir qual sla_id usar
        const slaIdFinal = sla ? sla.id : ticket.sla_id;
        console.log(`[SLA MV] Ticket ${ticket.numero}: Usando sla_id = ${slaIdFinal}`);

        // FORÇAR prazos fixos: 60 min resposta + 72h (4320 min) resolução
        const dataAbertura = new Date(ticket.data_abertura);
        const prazoResposta = (await calcularPrazoSLA(c.env.DB, ticket.setor_destino_id, dataAbertura, 60)).toISOString();
        const prazoSolucao = (await calcularPrazoSLA(c.env.DB, ticket.setor_destino_id, dataAbertura, 4320)).toISOString();
        
        console.log(`[SLA MV] Ticket ${ticket.numero}: FORÇANDO prazo_resposta=60min, prazo_solucao=72h`);
        console.log(`[SLA MV] Ticket ${ticket.numero}: Calculado prazo_resposta=${prazoResposta}, prazo_solucao=${prazoSolucao}`);

        // Atualizar ticket
        const dataHoraBrasil = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        const updateResult = await c.env.DB.prepare(`
          UPDATE chamados
          SET sla_id = ?,
              prazo_resposta = ?,
              prazo_solucao = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(slaIdFinal, prazoResposta, prazoSolucao, dataHoraBrasil, ticket.id).run();

        console.log(`[SLA MV] Ticket ${ticket.numero}: UPDATE executado - success: ${updateResult.success}, changes: ${updateResult.meta?.changes}`);

        // Verificar se realmente atualizou
        const ticketAtualizado = await c.env.DB.prepare(`
          SELECT sla_id, prazo_resposta, prazo_solucao 
          FROM chamados 
          WHERE id = ?
        `).bind(ticket.id).first<any>();
        
        console.log(`[SLA MV] Ticket ${ticket.numero}: Após UPDATE - sla_id: ${ticketAtualizado?.sla_id}, prazo_solucao: ${ticketAtualizado?.prazo_solucao}`);
        corrigidos++;
      } catch (error: any) {
        const msg = `Ticket ${ticket.numero}: ${error.message}`;
        console.log(`[SLA MV] ERRO - ${msg}`);
        erros.push(msg);
      }
    }

    console.log(`[SLA MV] Resultado final: ${corrigidos} corrigidos de ${tickets.length} processados`);

    return c.json({
      total_processados: tickets.length,
      corrigidos,
      erros: erros.length > 0 ? erros : undefined,
      mensagem: `${corrigidos} tickets foram recalculados com SLA de 72 horas`
    });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Rota de teste para listar todos os SLAs da categoria MV
router.get('/listar-slas-mv', authMiddleware, async (c) => {
  const { results: slas } = await c.env.DB.prepare(`
    SELECT id, nome, tipo_chamado, prioridade, tempo_resposta_minutos, tempo_solucao_minutos, ativo
    FROM slas
    WHERE categoria_id = 217
    ORDER BY prioridade, tipo_chamado
  `).all<any>();

  return c.json({ 
    total: slas.length,
    slas 
  });
});

// Endpoint para atualizar TODOS os SLAs cadastrados da categoria Sistema MV para 72 horas
router.post("/atualizar-slas-mv", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'gestor')) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    // Buscar todos os SLAs da categoria MV antes da atualização
    const { results: slasAntes } = await c.env.DB.prepare(`
      SELECT id, nome, tempo_resposta_minutos, tempo_solucao_minutos
      FROM slas
      WHERE categoria_id = 217
      ORDER BY nome
    `).all<any>();

    console.log(`[ATUALIZAR SLAs MV] Encontrados ${slasAntes.length} SLAs para atualizar`);

    // Atualizar TODOS os SLAs da categoria 217 para 72 horas (4320 minutos)
    const resultado = await c.env.DB.prepare(`
      UPDATE slas
      SET tempo_resposta_minutos = 60,
          tempo_solucao_minutos = 4320
      WHERE categoria_id = 217
    `).run();

    console.log(`[ATUALIZAR SLAs MV] UPDATE executado - success: ${resultado.success}, changes: ${resultado.meta?.changes}`);

    // Buscar SLAs após atualização para confirmar
    const { results: slasDepois } = await c.env.DB.prepare(`
      SELECT id, nome, tempo_resposta_minutos, tempo_solucao_minutos
      FROM slas
      WHERE categoria_id = 217
      ORDER BY nome
    `).all<any>();

    return c.json({
      sucesso: true,
      total_atualizados: resultado.meta?.changes || 0,
      slas_antes: slasAntes,
      slas_depois: slasDepois,
      mensagem: `${resultado.meta?.changes || 0} SLAs foram atualizados para 60 min (resposta) + 72 horas (resolução)`
    });

  } catch (error: any) {
    console.error(`[ATUALIZAR SLAs MV] ERRO:`, error);
    return c.json({ error: error.message }, 500);
  }
});

// Endpoint de teste para atualizar um ticket específico manualmente
router.post("/teste-update/:numero", authMiddleware, async (c) => {
  const numero = c.req.param("numero");
  const user = c.get("user")!;
  
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'gestor')) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    // Buscar ticket
    const ticket = await c.env.DB.prepare(`
      SELECT c.*, s.nome as sla_nome_atual, s.tempo_solucao_minutos as tempo_atual
      FROM chamados c
      LEFT JOIN slas s ON c.sla_id = s.id
      WHERE c.numero = ?
    `).bind(numero).first<any>();

    if (!ticket) {
      return c.json({ error: "Ticket não encontrado" }, 404);
    }

    // Buscar qualquer SLA da categoria MV (não importa tipo/prioridade)
    const sla = await c.env.DB.prepare(`
      SELECT id, nome, tempo_resposta_minutos, tempo_solucao_minutos
      FROM slas
      WHERE categoria_id = 217
        AND ativo = 1
      LIMIT 1
    `).first<any>();

    // Definir qual sla_id usar
    const slaIdFinal = sla ? sla.id : ticket.sla_id;
    const slaNomeFinal = sla ? sla.nome : ticket.sla_nome_atual;
    console.log(`[TESTE] Usando sla_id = ${slaIdFinal}, nome = ${slaNomeFinal}`);

    // FORÇAR prazos fixos: 60 min resposta + 72h (4320 min) resolução
    const dataAbertura = new Date(ticket.data_abertura);
    const prazoResposta = (await calcularPrazoSLA(c.env.DB, ticket.setor_destino_id, dataAbertura, 60)).toISOString();
    const prazoSolucao = (await calcularPrazoSLA(c.env.DB, ticket.setor_destino_id, dataAbertura, 4320)).toISOString();
    
    console.log(`[TESTE] FORÇANDO prazo_resposta=60min, prazo_solucao=72h`);

    // Log detalhado antes do UPDATE
    console.log(`[TESTE] Ticket ${numero}:`, {
      sla_id_atual: ticket.sla_id,
      sla_id_novo: slaIdFinal,
      sla_nome_atual: ticket.sla_nome_atual,
      sla_nome_novo: slaNomeFinal,
      prazo_solucao_atual: ticket.prazo_solucao,
      prazo_solucao_novo: prazoSolucao,
      prazo_resposta_novo: prazoResposta
    });

    // Executar UPDATE
    const dataHoraBrasil = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const resultado = await c.env.DB.prepare(`
      UPDATE chamados
      SET sla_id = ?,
          prazo_resposta = ?,
          prazo_solucao = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(slaIdFinal, prazoResposta, prazoSolucao, dataHoraBrasil, ticket.id).run();
    
    console.log(`[TESTE] UPDATE resultado:`, resultado);

    // Verificar se atualizou
    const ticketAtualizado = await c.env.DB.prepare(`
      SELECT c.*, s.nome as novo_sla_nome, s.tempo_solucao_minutos as novo_tempo
      FROM chamados c
      LEFT JOIN slas s ON c.sla_id = s.id
      WHERE c.id = ?
    `).bind(ticket.id).first<any>();

    console.log(`[TESTE] Ticket depois do UPDATE:`, ticketAtualizado);

    return c.json({
      sucesso: resultado.success,
      changes: resultado.meta?.changes || 0,
      comparacao_sla_ids: {
        sla_id_antes: ticket.sla_id,
        sla_id_usado: slaIdFinal,
        sla_id_depois: ticketAtualizado.sla_id,
        eram_iguais_antes: ticket.sla_id === slaIdFinal
      },
      ticket_antes: {
        sla_id: ticket.sla_id,
        sla_nome: ticket.sla_nome_atual,
        tempo_solucao: ticket.tempo_atual,
        prazo_solucao: ticket.prazo_solucao
      },
      sla_encontrado: {
        sla_id: slaIdFinal,
        sla_nome: slaNomeFinal,
        prazos_forcados: "60min resposta + 72h resolução"
      },
      novos_valores_calculados: {
        sla_id: slaIdFinal,
        prazo_resposta: prazoResposta,
        prazo_solucao: prazoSolucao
      },
      ticket_depois: {
        sla_id: ticketAtualizado.sla_id,
        sla_nome: ticketAtualizado.novo_sla_nome,
        tempo_solucao: ticketAtualizado.novo_tempo,
        prazo_solucao: ticketAtualizado.prazo_solucao
      }
    });

  } catch (error: any) {
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

// Endpoint para corrigir SLA de um ticket específico baseado em sua categoria
router.post("/corrigir-ticket/:numero", authMiddleware, async (c) => {
  const numero = c.req.param("numero");
  const user = c.get("user")!;
  
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'gestor')) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    // Buscar ticket completo
    const ticket = await c.env.DB.prepare(`
      SELECT c.*, s.nome as sla_nome_atual
      FROM chamados c
      LEFT JOIN slas s ON c.sla_id = s.id
      WHERE c.numero = ?
    `).bind(numero).first<any>();

    if (!ticket) {
      return c.json({ error: "Ticket não encontrado" }, 404);
    }

    console.log(`[CORRIGIR TICKET] ${numero} - Categoria: ${ticket.categoria_id}, Subcategoria: ${ticket.subcategoria_id}, Item: ${ticket.item_id}`);

    // Buscar SLA correto usando a mesma lógica da criação de tickets
    // Prioridade: item_id → subcategoria_id → categoria_id → genérico
    let sla = null;

    // 1. Tentar por item_id
    if (ticket.item_id) {
      sla = await c.env.DB.prepare(`
        SELECT id, nome, tempo_resposta_minutos, tempo_solucao_minutos
        FROM slas
        WHERE item_id = ?
          AND tipo_chamado = ?
          AND prioridade = ?
          AND ativo = 1
        LIMIT 1
      `).bind(ticket.item_id, ticket.tipo, ticket.prioridade).first<any>();
      
      if (sla) console.log(`[CORRIGIR TICKET] SLA encontrado por item_id: ${sla.nome}`);
    }

    // 2. Tentar por subcategoria_id
    if (!sla && ticket.subcategoria_id) {
      sla = await c.env.DB.prepare(`
        SELECT id, nome, tempo_resposta_minutos, tempo_solucao_minutos
        FROM slas
        WHERE subcategoria_id = ?
          AND tipo_chamado = ?
          AND prioridade = ?
          AND ativo = 1
        LIMIT 1
      `).bind(ticket.subcategoria_id, ticket.tipo, ticket.prioridade).first<any>();
      
      if (sla) console.log(`[CORRIGIR TICKET] SLA encontrado por subcategoria_id: ${sla.nome}`);
    }

    // 3. Tentar por categoria_id
    if (!sla && ticket.categoria_id) {
      sla = await c.env.DB.prepare(`
        SELECT id, nome, tempo_resposta_minutos, tempo_solucao_minutos
        FROM slas
        WHERE categoria_id = ?
          AND tipo_chamado = ?
          AND prioridade = ?
          AND ativo = 1
        LIMIT 1
      `).bind(ticket.categoria_id, ticket.tipo, ticket.prioridade).first<any>();
      
      if (sla) console.log(`[CORRIGIR TICKET] SLA encontrado por categoria_id: ${sla.nome}`);
    }

    // 4. SLA genérico (sem categoria)
    if (!sla) {
      sla = await c.env.DB.prepare(`
        SELECT id, nome, tempo_resposta_minutos, tempo_solucao_minutos
        FROM slas
        WHERE setor_id = ?
          AND tipo_chamado = ?
          AND prioridade = ?
          AND categoria_id IS NULL
          AND ativo = 1
        LIMIT 1
      `).bind(ticket.setor_destino_id, ticket.tipo, ticket.prioridade).first<any>();
      
      if (sla) console.log(`[CORRIGIR TICKET] SLA genérico encontrado: ${sla.nome}`);
    }

    if (!sla) {
      return c.json({ 
        error: "SLA não encontrado",
        detalhes: {
          setor: ticket.setor_destino_id,
          tipo: ticket.tipo,
          prioridade: ticket.prioridade,
          categoria: ticket.categoria_id,
          subcategoria: ticket.subcategoria_id,
          item: ticket.item_id
        }
      }, 404);
    }

    // Calcular novos prazos
    const dataAbertura = new Date(ticket.data_abertura);
    let prazoResposta = null;
    let prazoSolucao = null;

    if (sla.tempo_resposta_minutos > 0) {
      prazoResposta = (await calcularPrazoSLA(c.env.DB, ticket.setor_destino_id, dataAbertura, sla.tempo_resposta_minutos)).toISOString();
    }

    if (sla.tempo_solucao_minutos > 0) {
      prazoSolucao = (await calcularPrazoSLA(c.env.DB, ticket.setor_destino_id, dataAbertura, sla.tempo_solucao_minutos)).toISOString();
    }

    // Atualizar ticket
    const dataHoraBrasil = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const resultado = await c.env.DB.prepare(`
      UPDATE chamados
      SET sla_id = ?,
          prazo_resposta = ?,
          prazo_solucao = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(sla.id, prazoResposta, prazoSolucao, dataHoraBrasil, ticket.id).run();

    console.log(`[CORRIGIR TICKET] UPDATE executado - success: ${resultado.success}, changes: ${resultado.meta?.changes}`);

    // Buscar ticket atualizado
    const ticketAtualizado = await c.env.DB.prepare(`
      SELECT c.*, s.nome as sla_nome_novo
      FROM chamados c
      LEFT JOIN slas s ON c.sla_id = s.id
      WHERE c.id = ?
    `).bind(ticket.id).first<any>();

    return c.json({
      sucesso: true,
      ticket: numero,
      correcao: {
        sla_antes: {
          id: ticket.sla_id,
          nome: ticket.sla_nome_atual
        },
        sla_depois: {
          id: ticketAtualizado.sla_id,
          nome: ticketAtualizado.sla_nome_novo,
          tempo_resposta: sla.tempo_resposta_minutos,
          tempo_solucao: sla.tempo_solucao_minutos
        },
        prazos: {
          prazo_resposta: prazoResposta,
          prazo_solucao: prazoSolucao
        }
      }
    });

  } catch (error: any) {
    console.error(`[CORRIGIR TICKET] ERRO:`, error);
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

export default router;
