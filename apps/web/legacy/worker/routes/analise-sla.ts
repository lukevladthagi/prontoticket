import { Hono } from "hono";
import { getDataHoraBrasil } from "../utils/timezone";

const app = new Hono<{ Bindings: Env }>();

// GET - Listar chamados com análise de SLA
app.get("/", async (c) => {
  const db = c.env.DB;
  const { status, setor, limite = "50", pagina = "1", busca, data_inicio, data_fim } = c.req.query();

  try {
    // Contar total de registros
    let countQuery = `
      SELECT COUNT(*) as total
      FROM chamados c
      WHERE 1=1
    `;

    const countParams: any[] = [];

    if (status) {
      countQuery += ` AND c.status = ?`;
      countParams.push(status);
    }

    if (setor) {
      countQuery += ` AND c.setor_destino_id = ?`;
      countParams.push(parseInt(setor));
    }

    if (busca) {
      countQuery += ` AND (c.numero LIKE ? OR c.titulo LIKE ? OR c.descricao LIKE ?)`;
      const buscaParam = `%${busca}%`;
      countParams.push(buscaParam, buscaParam, buscaParam);
    }

    if (data_inicio) {
      countQuery += ` AND DATE(c.data_abertura) >= DATE(?)`;
      countParams.push(data_inicio);
    }

    if (data_fim) {
      countQuery += ` AND DATE(c.data_abertura) <= DATE(?)`;
      countParams.push(data_fim);
    }

    const countResult = await db.prepare(countQuery).bind(...countParams).first();
    const totalRegistros = (countResult as any)?.total || 0;

    // Buscar registros paginados
    let query = `
      SELECT 
        c.id,
        c.numero,
        c.titulo,
        c.status,
        c.prioridade,
        c.setor_destino_id,
        c.data_abertura,
        c.data_primeira_resposta,
        c.data_resolucao,
        c.prazo_resposta,
        c.prazo_solucao,
        c.sla_id,
        c.sla_pausado_em,
        c.sla_pausado_motivo,
        s.tempo_resposta_minutos,
        s.tempo_solucao_minutos,
        s.nome as sla_descricao,
        up.nome as solicitante_nome
      FROM chamados c
      LEFT JOIN slas s ON c.sla_id = s.id
      LEFT JOIN user_profiles up ON c.solicitante_id = up.user_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status) {
      query += ` AND c.status = ?`;
      params.push(status);
    }

    if (setor) {
      query += ` AND c.setor_destino_id = ?`;
      params.push(parseInt(setor));
    }

    if (busca) {
      query += ` AND (c.numero LIKE ? OR c.titulo LIKE ? OR c.descricao LIKE ?)`;
      const buscaParam = `%${busca}%`;
      params.push(buscaParam, buscaParam, buscaParam);
    }

    if (data_inicio) {
      query += ` AND DATE(c.data_abertura) >= DATE(?)`;
      params.push(data_inicio);
    }

    if (data_fim) {
      query += ` AND DATE(c.data_abertura) <= DATE(?)`;
      params.push(data_fim);
    }

    const limiteNum = parseInt(limite);
    const paginaNum = parseInt(pagina);
    const offset = (paginaNum - 1) * limiteNum;

    query += ` ORDER BY c.data_abertura DESC LIMIT ? OFFSET ?`;
    params.push(limiteNum, offset);

    const result = await db.prepare(query).bind(...params).all();

    // Processar cada chamado para calcular status SLA
    const agora = new Date();
    const chamadosProcessados = result.results.map((chamado: any) => {
      let statusAtendimento = "N/A";
      let statusResolucao = "N/A";
      let tempoRestanteAtendimento = null;
      let tempoRestanteResolucao = null;

      // Verificar se o SLA está pausado
      const slaPausado = chamado.sla_pausado_em !== null;

      // Análise de SLA de Atendimento
      if (chamado.prazo_resposta) {
        const prazoResposta = new Date(chamado.prazo_resposta);
        
        if (chamado.data_primeira_resposta) {
          const dataResposta = new Date(chamado.data_primeira_resposta);
          statusAtendimento = dataResposta <= prazoResposta ? "Dentro" : "Fora";
        } else {
          // Ainda não respondido
          if (slaPausado) {
            statusAtendimento = "Pausado";
            tempoRestanteAtendimento = Math.floor((prazoResposta.getTime() - agora.getTime()) / 60000); // minutos
          } else if (agora <= prazoResposta) {
            statusAtendimento = "Dentro";
            tempoRestanteAtendimento = Math.floor((prazoResposta.getTime() - agora.getTime()) / 60000); // minutos
          } else {
            statusAtendimento = "Fora";
            tempoRestanteAtendimento = Math.floor((agora.getTime() - prazoResposta.getTime()) / 60000); // minutos de atraso
          }
        }
      }

      // Análise de SLA de Resolução
      if (chamado.prazo_solucao) {
        const prazoSolucao = new Date(chamado.prazo_solucao);
        
        if (chamado.data_resolucao) {
          const dataResolucao = new Date(chamado.data_resolucao);
          statusResolucao = dataResolucao <= prazoSolucao ? "Dentro" : "Fora";
        } else {
          // Ainda não resolvido
          if (slaPausado) {
            statusResolucao = "Pausado";
            tempoRestanteResolucao = Math.floor((prazoSolucao.getTime() - agora.getTime()) / 60000); // minutos
          } else if (agora <= prazoSolucao) {
            statusResolucao = "Dentro";
            tempoRestanteResolucao = Math.floor((prazoSolucao.getTime() - agora.getTime()) / 60000); // minutos
          } else {
            statusResolucao = "Fora";
            tempoRestanteResolucao = Math.floor((agora.getTime() - prazoSolucao.getTime()) / 60000); // minutos de atraso
          }
        }
      }

      return {
        ...chamado,
        status_atendimento: statusAtendimento,
        status_resolucao: statusResolucao,
        tempo_restante_atendimento: tempoRestanteAtendimento,
        tempo_restante_resolucao: tempoRestanteResolucao,
      };
    });

    return c.json({
      total: totalRegistros,
      pagina: paginaNum,
      limite: limiteNum,
      totalPaginas: Math.ceil(totalRegistros / limiteNum),
      chamados: chamadosProcessados,
    });
  } catch (error: any) {
    console.error("Erro ao listar chamados:", error);
    return c.json({ error: error.message }, 500);
  }
});

// PUT - Atualizar SLA de um chamado
app.put("/:id/sla", async (c) => {
  const db = c.env.DB;
  const chamadoId = c.req.param("id");
  const { prazo_resposta, prazo_solucao, motivo } = await c.req.json<{
    prazo_resposta?: string;
    prazo_solucao?: string;
    motivo?: string;
  }>();

  try {
    // Buscar dados atuais do chamado
    const chamado = await db
      .prepare("SELECT * FROM chamados WHERE id = ?")
      .bind(chamadoId)
      .first();

    if (!chamado) {
      return c.json({ error: "Chamado não encontrado" }, 404);
    }

    // Preparar updates
    const updates: string[] = [];
    const params: any[] = [];

    if (prazo_resposta !== undefined) {
      updates.push("prazo_resposta = ?");
      params.push(prazo_resposta || null);
    }

    if (prazo_solucao !== undefined) {
      updates.push("prazo_solucao = ?");
      params.push(prazo_solucao || null);
    }

    if (updates.length === 0) {
      return c.json({ error: "Nenhum campo para atualizar" }, 400);
    }

    updates.push("updated_at = ?");
    params.push(getDataHoraBrasil());
    params.push(chamadoId);

    // Atualizar chamado
    await db
      .prepare(`UPDATE chamados SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();

    // Registrar no histórico
    const userHeader = c.req.header("X-User-ID");
    const userData = userHeader ? JSON.parse(userHeader) : null;
    
    const detalhes = motivo || "SLA alterado manualmente";
    await db
      .prepare(
        `INSERT INTO historico (chamado_id, user_id, user_nome, acao, detalhes, tipo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        chamadoId, 
        userData?.userId || "sistema",
        userData?.name || "Sistema",
        "alteracao_sla",
        detalhes,
        "acao_tecnica",
        getDataHoraBrasil(),
        getDataHoraBrasil()
      )
      .run();

    return c.json({ success: true, message: "SLA atualizado com sucesso" });
  } catch (error: any) {
    console.error("Erro ao atualizar SLA:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /recalcular-selecionados - Recalcular SLA de múltiplos tickets selecionados
app.post("/recalcular-selecionados", async (c) => {
  const db = c.env.DB;
  const { ticket_ids } = await c.req.json<{ ticket_ids: number[] }>();

  if (!ticket_ids || ticket_ids.length === 0) {
    return c.json({ error: "Nenhum ticket selecionado" }, 400);
  }

  try {
    let ticketsAtualizados = 0;
    const userHeader = c.req.header("X-User-ID");
    const userData = userHeader ? JSON.parse(userHeader) : null;

    for (const chamadoId of ticket_ids) {
      // Buscar dados do ticket
      const ticket = await db
        .prepare(`
          SELECT 
            id,
            numero,
            tipo,
            prioridade,
            categoria_id,
            subcategoria_id,
            item_id,
            data_abertura,
            setor_destino_id
          FROM chamados
          WHERE id = ?
        `)
        .bind(chamadoId)
        .first() as any;

      if (!ticket) continue;

      // Verificar se o ticket foi reaberto - buscar a última reabertura no histórico
      const ultimaReabertura = await db
        .prepare(`
          SELECT created_at
          FROM historico
          WHERE chamado_id = ?
            AND acao = 'reabertura'
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .bind(chamadoId)
        .first() as any;

      // Se foi reaberto, usar a data da reabertura como base para o SLA
      // Caso contrário, usar a data de abertura original
      const dataBase = ultimaReabertura 
        ? new Date(ultimaReabertura.created_at)
        : new Date(ticket.data_abertura);

      // Buscar SLA apropriado
      const slaQuery = `
        SELECT id, tempo_resposta_minutos, tempo_solucao_minutos
        FROM slas
        WHERE tipo_chamado = ?
          AND prioridade = ?
          AND (
            (categoria_id = ? AND categoria_id IS NOT NULL) OR
            (categoria_id IS NULL)
          )
        ORDER BY 
          CASE 
            WHEN categoria_id IS NOT NULL THEN 1
            ELSE 2
          END
        LIMIT 1
      `;

      const sla = await db
        .prepare(slaQuery)
        .bind(
          ticket.tipo,
          ticket.prioridade,
          ticket.categoria_id
        )
        .first() as any;

      if (!sla) continue;

      // Calcular prazos a partir da data base (abertura ou reabertura)
      const dataAbertura = dataBase;
      
      let prazoResposta = null;
      if (sla.tempo_resposta_minutos && sla.tempo_resposta_minutos > 0) {
        prazoResposta = new Date(dataAbertura.getTime() + sla.tempo_resposta_minutos * 60000);
      }

      let prazoSolucao = null;
      if (sla.tempo_solucao_minutos && sla.tempo_solucao_minutos > 0) {
        prazoSolucao = new Date(dataAbertura.getTime() + sla.tempo_solucao_minutos * 60000);
      }

      // Atualizar ticket
      await db
        .prepare(`
          UPDATE chamados 
          SET sla_id = ?,
              prazo_resposta = ?,
              prazo_solucao = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .bind(
          sla.id,
          prazoResposta ? prazoResposta.toISOString().replace('Z', '').slice(0, 19) : null,
          prazoSolucao ? prazoSolucao.toISOString().replace('Z', '').slice(0, 19) : null,
          getDataHoraBrasil(),
          ticket.id
        )
        .run();

      // Registrar no histórico
      await db
        .prepare(`
          INSERT INTO historico (chamado_id, user_id, user_nome, acao, detalhes, tipo, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          ticket.id,
          userData?.userId || "sistema",
          userData?.name || "Sistema",
          "recalculo_sla",
          `SLA recalculado em lote (${sla.tempo_resposta_minutos || 0}min resp / ${sla.tempo_solucao_minutos || 0}min sol)`,
          "acao_tecnica",
          getDataHoraBrasil(),
          getDataHoraBrasil()
        )
        .run();

      ticketsAtualizados++;
    }

    return c.json({
      success: true,
      tickets_atualizados: ticketsAtualizados,
      message: `${ticketsAtualizados} ticket(s) recalculado(s) com sucesso`,
    });
  } catch (error: any) {
    console.error("Erro ao recalcular SLAs selecionados:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /:id/recalcular - Recalcular SLA de um ticket individual
app.post("/:id/recalcular", async (c) => {
  const db = c.env.DB;
  const chamadoId = c.req.param("id");

  try {
    // Buscar dados do ticket
    const ticket = await db
      .prepare(`
        SELECT 
          id,
          numero,
          tipo,
          prioridade,
          categoria_id,
          subcategoria_id,
          item_id,
          data_abertura,
          setor_destino_id
        FROM chamados
        WHERE id = ?
      `)
      .bind(chamadoId)
      .first() as any;

    if (!ticket) {
      return c.json({ error: "Ticket não encontrado" }, 404);
    }

    // Verificar se o ticket foi reaberto - buscar a última reabertura no histórico
    const ultimaReabertura = await db
      .prepare(`
        SELECT created_at
        FROM historico
        WHERE chamado_id = ?
          AND acao = 'reabertura'
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .bind(chamadoId)
      .first() as any;

    // Se foi reaberto, usar a data da reabertura como base para o SLA
    // Caso contrário, usar a data de abertura original
    const dataBase = ultimaReabertura 
      ? new Date(ultimaReabertura.created_at)
      : new Date(ticket.data_abertura);

    // Buscar SLA apropriado
    const slaQuery = `
      SELECT id, tempo_resposta_minutos, tempo_solucao_minutos
      FROM slas
      WHERE tipo_chamado = ?
        AND prioridade = ?
        AND (
          (categoria_id = ? AND categoria_id IS NOT NULL) OR
          (categoria_id IS NULL)
        )
      ORDER BY 
        CASE 
          WHEN categoria_id IS NOT NULL THEN 1
          ELSE 2
        END
      LIMIT 1
    `;

    const sla = await db
      .prepare(slaQuery)
      .bind(
        ticket.tipo,
        ticket.prioridade,
        ticket.categoria_id
      )
      .first() as any;

    if (!sla) {
      return c.json({ error: "SLA não encontrado para este ticket" }, 404);
    }

    // Calcular prazos a partir da data base (abertura ou reabertura)
    const dataAbertura = dataBase;
    
    let prazoResposta = null;
    if (sla.tempo_resposta_minutos && sla.tempo_resposta_minutos > 0) {
      prazoResposta = new Date(dataAbertura.getTime() + sla.tempo_resposta_minutos * 60000);
    }

    let prazoSolucao = null;
    if (sla.tempo_solucao_minutos && sla.tempo_solucao_minutos > 0) {
      prazoSolucao = new Date(dataAbertura.getTime() + sla.tempo_solucao_minutos * 60000);
    }

    // Atualizar ticket
    await db
      .prepare(`
        UPDATE chamados 
        SET sla_id = ?,
            prazo_resposta = ?,
            prazo_solucao = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .bind(
        sla.id,
        prazoResposta ? prazoResposta.toISOString().replace('Z', '').slice(0, 19) : null,
        prazoSolucao ? prazoSolucao.toISOString().replace('Z', '').slice(0, 19) : null,
        getDataHoraBrasil(),
        ticket.id
      )
      .run();

    // Registrar no histórico
    const userHeader = c.req.header("X-User-ID");
    const userData = userHeader ? JSON.parse(userHeader) : null;

    await db
      .prepare(`
        INSERT INTO historico (chamado_id, user_id, user_nome, acao, detalhes, tipo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        ticket.id,
        userData?.userId || "sistema",
        userData?.name || "Sistema",
        "recalculo_sla",
        `SLA recalculado (${sla.tempo_resposta_minutos || 0}min resp / ${sla.tempo_solucao_minutos || 0}min sol)`,
        "acao_tecnica",
        getDataHoraBrasil(),
        getDataHoraBrasil()
      )
      .run();

    return c.json({
      success: true,
      message: `SLA recalculado com sucesso para ${ticket.numero}`,
    });
  } catch (error: any) {
    console.error("Erro ao recalcular SLA:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /recalcular-lote - Recalcular SLA em lote
app.post("/recalcular-lote", async (c) => {
  const db = c.env.DB;
  const { setor_id, apenas_nulos } = await c.req.json<{
    setor_id?: number;
    apenas_nulos?: boolean;
  }>();

  try {
    // Buscar tickets que precisam de recálculo
    let query = `
      SELECT 
        c.id,
        c.numero,
        c.tipo,
        c.prioridade,
        c.categoria_id,
        c.subcategoria_id,
        c.item_id,
        c.data_abertura,
        c.setor_destino_id
      FROM chamados c
      WHERE 1=1
    `;

    const params: any[] = [];

    if (setor_id) {
      query += ` AND c.setor_destino_id = ?`;
      params.push(setor_id);
    }

    if (apenas_nulos) {
      query += ` AND (c.prazo_resposta IS NULL OR c.prazo_solucao IS NULL)`;
    }

    const result = await db.prepare(query).bind(...params).all();
    const tickets = result.results as any[];

    if (tickets.length === 0) {
      return c.json({
        success: true,
        tickets_atualizados: 0,
        message: "Nenhum ticket encontrado para recálculo",
      });
    }

    // Limitar a 50 tickets por vez para evitar timeout
    const ticketsParaProcessar = tickets.slice(0, 50);
    const totalEncontrado = tickets.length;

    let ticketsAtualizados = 0;

    // Processar cada ticket
    for (const ticket of ticketsParaProcessar) {
      // Verificar se o ticket foi reaberto - buscar a última reabertura no histórico
      const ultimaReabertura = await db
        .prepare(`
          SELECT created_at
          FROM historico
          WHERE chamado_id = ?
            AND acao = 'reabertura'
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .bind(ticket.id)
        .first() as any;

      // Se foi reaberto, usar a data da reabertura como base para o SLA
      // Caso contrário, usar a data de abertura original
      const dataBase = ultimaReabertura 
        ? new Date(ultimaReabertura.created_at)
        : new Date(ticket.data_abertura);

      // Buscar SLA apropriado
      const slaQuery = `
        SELECT id, tempo_resposta_minutos, tempo_solucao_minutos
        FROM slas
        WHERE tipo_chamado = ?
          AND prioridade = ?
          AND (
            (categoria_id = ? AND categoria_id IS NOT NULL) OR
            (categoria_id IS NULL)
          )
        ORDER BY 
          CASE 
            WHEN categoria_id IS NOT NULL THEN 1
            ELSE 2
          END
        LIMIT 1
      `;

      const sla = await db
        .prepare(slaQuery)
        .bind(
          ticket.tipo,
          ticket.prioridade,
          ticket.categoria_id
        )
        .first() as any;

      if (!sla) {
        continue; // Pula se não encontrar SLA
      }

      // Calcular prazos a partir da data base (abertura ou reabertura)
      const dataAbertura = dataBase;
      
      let prazoResposta = null;
      if (sla.tempo_resposta_minutos && sla.tempo_resposta_minutos > 0) {
        prazoResposta = new Date(dataAbertura.getTime() + sla.tempo_resposta_minutos * 60000);
      }

      let prazoSolucao = null;
      if (sla.tempo_solucao_minutos && sla.tempo_solucao_minutos > 0) {
        prazoSolucao = new Date(dataAbertura.getTime() + sla.tempo_solucao_minutos * 60000);
      }

      // Atualizar ticket
      await db
        .prepare(`
          UPDATE chamados 
          SET sla_id = ?,
              prazo_resposta = ?,
              prazo_solucao = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .bind(
          sla.id,
          prazoResposta ? prazoResposta.toISOString() : null,
          prazoSolucao ? prazoSolucao.toISOString() : null,
          getDataHoraBrasil(),
          ticket.id
        )
        .run();

      // Registrar no histórico
      await db
        .prepare(`
          INSERT INTO historico (chamado_id, user_id, user_nome, acao, detalhes, tipo, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          ticket.id,
          "sistema",
          "Sistema",
          "recalculo_sla",
          `SLA recalculado automaticamente (${sla.tempo_resposta_minutos || 0}min resp / ${sla.tempo_solucao_minutos || 0}min sol)`,
          "acao_tecnica",
          getDataHoraBrasil(),
          getDataHoraBrasil()
        )
        .run();

      ticketsAtualizados++;
    }

    return c.json({
      success: true,
      tickets_atualizados: ticketsAtualizados,
      total_encontrados: totalEncontrado,
      processados_agora: ticketsParaProcessar.length,
      message: totalEncontrado > 50 
        ? `${ticketsAtualizados} tickets atualizados (processados ${ticketsParaProcessar.length} de ${totalEncontrado}). Execute novamente para processar mais.`
        : `${ticketsAtualizados} tickets atualizados com sucesso`,
    });
  } catch (error: any) {
    console.error("Erro ao recalcular SLAs em lote:", error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
