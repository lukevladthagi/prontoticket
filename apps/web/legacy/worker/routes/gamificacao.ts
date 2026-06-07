import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import { obterRanking, calcularPontosResolucao, obterHistoricoMensal, listarMesesDisponiveis, resetarPontosMensais } from "../services/gamificacao";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Obter ranking
router.get("/ranking", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se usuário é do setor TI
  const profile = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ setor_id: number }>();

  if (!profile || profile.setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor TI" }, 403);
  }

  const periodo = c.req.query("periodo") as 'total' | 'mes' || 'total';
  const limite = parseInt(c.req.query("limite") || "10");
  const dataInicio = c.req.query("data_inicio");
  const dataFim = c.req.query("data_fim");

  // Se tiver filtro de data personalizado, calcular ranking dinâmico
  if (dataInicio && dataFim) {
    const { results } = await c.env.DB.prepare(
      `SELECT gp.user_id, up.nome as user_nome, 
              SUM(gp.pontos) as pontos_periodo,
              gr.total_pontos, gr.mes_atual, gr.nivel
       FROM gamificacao_pontos gp
       INNER JOIN user_profiles up ON gp.user_id = up.user_id
       LEFT JOIN gamificacao_ranking gr ON gp.user_id = gr.user_id
       WHERE up.setor_id = 1 
         AND DATE(gp.created_at) >= DATE(?)
         AND DATE(gp.created_at) <= DATE(?)
       GROUP BY gp.user_id
       ORDER BY pontos_periodo DESC
       LIMIT ?`
    ).bind(dataInicio, dataFim, limite).all();

    return c.json(results.map((r: any) => ({
      user_id: r.user_id,
      user_nome: r.user_nome,
      total_pontos: r.total_pontos || 0,
      mes_atual: r.pontos_periodo || 0,
      nivel: r.nivel || 1
    })));
  }

  const ranking = await obterRanking(c.env.DB, periodo, limite);
  return c.json(ranking);
});

// Obter pontos de um usuário específico
router.get("/usuario/:userId", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se usuário é do setor TI
  const profile = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ setor_id: number }>();

  if (!profile || profile.setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor TI" }, 403);
  }

  const userId = c.req.param("userId");

  const ranking = await c.env.DB.prepare(
    "SELECT * FROM gamificacao_ranking WHERE user_id = ?"
  ).bind(userId).first();

  if (!ranking) {
    return c.json({
      user_id: userId,
      total_pontos: 0,
      mes_atual: 0,
      nivel: 1
    });
  }

  return c.json(ranking);
});

// Obter histórico de pontos de um usuário
router.get("/usuario/:userId/historico", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se usuário é do setor TI
  const profile = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ setor_id: number }>();

  if (!profile || profile.setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor TI" }, 403);
  }

  const userId = c.req.param("userId");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const { results } = await c.env.DB.prepare(
    `SELECT gp.*, 
            c.numero as chamado_numero, 
            c.titulo as chamado_titulo,
            p.nome as projeto_nome
     FROM gamificacao_pontos gp
     LEFT JOIN chamados c ON gp.chamado_id = c.id
     LEFT JOIN projetos p ON gp.projeto_id = p.id
     WHERE gp.user_id = ?
     ORDER BY gp.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(userId, limit, offset).all();

  return c.json(results);
});

// Obter detalhamento completo de pontos de um técnico (para modal)
router.get("/usuario/:userId/detalhamento", authMiddleware, async (c) => {
  try {
    console.log("[DETALHAMENTO] Iniciando endpoint");
    const user = c.get("user")!;
    console.log("[DETALHAMENTO] User ID:", user.id);
    
    // Verificar se usuário é do setor TI
    const profile = await c.env.DB.prepare(
      "SELECT setor_id FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first<{ setor_id: number }>();

    console.log("[DETALHAMENTO] Profile:", profile);

    if (!profile || profile.setor_id !== 1) {
      console.log("[DETALHAMENTO] Acesso negado - setor:", profile?.setor_id);
      return c.json({ error: "Acesso restrito ao setor TI" }, 403);
    }

    const userId = c.req.param("userId");
    console.log("[DETALHAMENTO] Target userId:", userId);

    // Buscar informações do técnico
    console.log("[DETALHAMENTO] Buscando técnico no ranking...");
    const tecnico = await c.env.DB.prepare(
      "SELECT user_id, user_nome, total_pontos, mes_atual, nivel FROM gamificacao_ranking WHERE user_id = ?"
    ).bind(userId).first();

    console.log("[DETALHAMENTO] Técnico encontrado:", tecnico);

    if (!tecnico) {
      console.log("[DETALHAMENTO] Técnico não encontrado no ranking");
      return c.json({ error: "Técnico não encontrado no ranking" }, 404);
    }

    // Buscar todos os chamados resolvidos com detalhamento de pontos
    console.log("[DETALHAMENTO] Buscando chamados resolvidos...");
    const { results: chamados } = await c.env.DB.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.titulo,
        c.prioridade,
        c.status,
        c.data_resolucao,
        c.data_abertura,
        c.solicitante_id,
        c.tecnico_responsavel_id,
        cat.nome as categoria_nome,
        c.prazo_solucao,
        gp.pontos as pontos_ganhos,
        gp.descricao as descricao_pontos,
        gp.created_at as data_pontos
      FROM chamados c
      LEFT JOIN categorias cat ON c.categoria_id = cat.id
      LEFT JOIN gamificacao_pontos gp ON gp.chamado_id = c.id AND gp.tipo_acao = 'resolucao' AND gp.user_id = ?
      WHERE c.tecnico_responsavel_id = ?
        AND c.status IN ('Resolvido', 'Fechado')
        AND c.data_resolucao IS NOT NULL
        AND c.solicitante_id != c.tecnico_responsavel_id
      ORDER BY c.data_resolucao DESC
    `).bind(userId, userId).all();

    console.log("[DETALHAMENTO] Chamados encontrados:", chamados?.length || 0);
    console.log("[DETALHAMENTO] Primeiros 2 chamados:", JSON.stringify(chamados?.slice(0, 2)));

    // Buscar todas as avaliações recebidas (excluindo auto-avaliações)
    console.log("[DETALHAMENTO] Buscando avaliações...");
    const { results: avaliacoes } = await c.env.DB.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.titulo,
        c.avaliacao_nota,
        c.avaliacao_data,
        c.avaliacao_comentario,
        gp.pontos as pontos_ganhos,
        sol.nome as solicitante_nome
      FROM chamados c
      LEFT JOIN gamificacao_pontos gp ON gp.chamado_id = c.id AND gp.tipo_acao = 'feedback' AND gp.user_id = ?
      LEFT JOIN user_profiles sol ON c.solicitante_id = sol.user_id
      WHERE c.tecnico_responsavel_id = ?
        AND c.avaliacao_nota IS NOT NULL
        AND c.solicitante_id != c.tecnico_responsavel_id
      ORDER BY c.avaliacao_data DESC
    `).bind(userId, userId).all();

    console.log("[DETALHAMENTO] Avaliações encontradas:", avaliacoes?.length || 0);
    console.log("[DETALHAMENTO] Primeiras 2 avaliações:", JSON.stringify(avaliacoes?.slice(0, 2)));

    // Calcular estatísticas
    console.log("[DETALHAMENTO] Calculando estatísticas...");
    const chamadosArray = chamados || [];
    const avaliacoesArray = avaliacoes || [];
    console.log("[DETALHAMENTO] chamadosArray length:", chamadosArray.length);
    console.log("[DETALHAMENTO] avaliacoesArray length:", avaliacoesArray.length);
    
    const totalPontosResolucao = chamadosArray.reduce((sum: number, ch: any) => sum + (ch.pontos_ganhos || 0), 0);
    const totalPontosAvaliacoes = avaliacoesArray.reduce((sum: number, av: any) => sum + (av.pontos_ganhos || 0), 0);

    console.log("[DETALHAMENTO] Total pontos resolução:", totalPontosResolucao);
    console.log("[DETALHAMENTO] Total pontos avaliações:", totalPontosAvaliacoes);

    // Processar cada chamado para adicionar informações de composição dos pontos
    console.log("[DETALHAMENTO] Processando chamados detalhados...");
    const chamadosDetalhados = chamadosArray.map((ch: any) => {
      // Calcular componentes dos pontos
      let pontosBase = 10;
      switch (ch.prioridade) {
        case 'P1': pontosBase = 20; break;
        case 'P2': pontosBase = 15; break;
        case 'P3': pontosBase = 10; break;
        case 'P4': pontosBase = 5; break;
      }

      let multiplicadorCategoria = 1.0;
      let tipoCategoria = 'Outros';
      if (ch.categoria_nome) {
        const catNome = String(ch.categoria_nome);
        if (catNome.includes('BI') || 
            catNome.includes('Power BI') ||
            catNome.includes('Infraestrutura') ||
            catNome.includes('Servidor') ||
            catNome.includes('Rede') ||
            catNome.includes('Banco de Dados')) {
          multiplicadorCategoria = 3.0;
          tipoCategoria = 'Alta Complexidade';
        } else if (catNome.includes('Hardware') || 
                   catNome.includes('Software') ||
                   catNome.includes('Sistema') ||
                   catNome.includes('E-MAIL')) {
          multiplicadorCategoria = 2.0;
          tipoCategoria = 'Média Complexidade';
        }
      }

      let bonusSLA = 0;
      let dentroSLA = false;
      if (ch.prazo_solucao && ch.data_resolucao) {
        const prazo = new Date(String(ch.prazo_solucao)).getTime();
        const resolucao = new Date(String(ch.data_resolucao)).getTime();
        if (resolucao <= prazo) {
          bonusSLA = 5;
          dentroSLA = true;
        }
      }

      const isAutoAtendimento = ch.solicitante_id === ch.tecnico_responsavel_id;
      const multiplicadorAuto = isAutoAtendimento ? 0.5 : 1.0;

      return {
        ...ch,
        composicao: {
          pontos_base: pontosBase,
          multiplicador_categoria: multiplicadorCategoria,
          tipo_categoria: tipoCategoria,
          bonus_sla: bonusSLA,
          dentro_sla: dentroSLA,
          is_auto_atendimento: isAutoAtendimento,
          multiplicador_auto: multiplicadorAuto,
          pontos_antes_auto: pontosBase * multiplicadorCategoria + bonusSLA,
          pontos_final: ch.pontos_ganhos || 0
        }
      };
    });

    console.log("[DETALHAMENTO] Chamados detalhados processados:", chamadosDetalhados.length);
    console.log("[DETALHAMENTO] Preparando resposta JSON...");

    const responseData = {
      tecnico,
      chamados: chamadosDetalhados,
      avaliacoes: avaliacoesArray,
      estatisticas: {
        total_chamados: chamadosArray.length,
        total_avaliacoes: avaliacoesArray.length,
        pontos_resolucao: totalPontosResolucao,
        pontos_avaliacoes: totalPontosAvaliacoes,
        pontos_total: totalPontosResolucao + totalPontosAvaliacoes
      }
    };

    console.log("[DETALHAMENTO] Resposta preparada, enviando...");
    return c.json(responseData);
  } catch (error) {
    console.error("[DETALHAMENTO] ERRO CAPTURADO:", error);
    console.error("[DETALHAMENTO] Error stack:", error instanceof Error ? error.stack : "N/A");
    console.error("[DETALHAMENTO] Error message:", error instanceof Error ? error.message : String(error));
    console.error('Erro ao buscar detalhamento do usuario:', error);
    return c.json({ 
      error: "Erro ao buscar detalhamento",
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido'
    }, 500);
  }
});

// Obter estatísticas gerais de gamificação
router.get("/estatisticas", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se usuário é do setor TI
  const profile = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ setor_id: number }>();

  if (!profile || profile.setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor TI" }, 403);
  }

  const totalUsuarios = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM gamificacao_ranking"
  ).first<{ total: number }>();

  const totalPontos = await c.env.DB.prepare(
    "SELECT SUM(pontos) as total FROM gamificacao_pontos"
  ).first<{ total: number }>();

  const pontosMes = await c.env.DB.prepare(
    `SELECT SUM(pontos) as total FROM gamificacao_pontos 
     WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
  ).first<{ total: number }>();

  return c.json({
    total_usuarios: totalUsuarios?.total || 0,
    total_pontos_distribuidos: totalPontos?.total || 0,
    pontos_mes_atual: pontosMes?.total || 0
  });
});

// Processar pontos retroativos para tickets resolvidos
router.post("/processar-retroativo", authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: "Não autenticado" }, 401);
    }

    // Verificar se é gestor ou admin
    const profile = await c.env.DB.prepare(
      "SELECT perfil FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first<{ perfil: string }>();

    if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
      return c.json({ error: "Sem permissão" }, 403);
    }

    // Buscar todos os tickets resolvidos/fechados
    const { results: tickets } = await c.env.DB.prepare(
      `SELECT * FROM chamados 
       WHERE status IN ('Resolvido', 'Fechado') 
       AND tecnico_responsavel_id IS NOT NULL`
    ).all();

    let processados = 0;
    let comPontos = 0;
    let semPontos = 0;
    const erros: string[] = [];

    for (const ticket of tickets) {
      try {
        // Verificar se já tem pontos registrados
        const pontosExistentes = await c.env.DB.prepare(
          "SELECT COUNT(*) as total FROM gamificacao_pontos WHERE chamado_id = ?"
        ).bind(ticket.id).first<{ total: number }>();

        if (pontosExistentes && pontosExistentes.total > 0) {
          comPontos++;
          continue;
        }

        // Calcular pontos
        await calcularPontosResolucao(c.env.DB, ticket as any);
        
        processados++;
        semPontos++;
      } catch (error) {
        console.error(`Erro ao processar ticket ${ticket.id}:`, error);
        erros.push(`Ticket ${ticket.numero}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }

    return c.json({
      sucesso: true,
      total_tickets: tickets.length,
      tickets_com_pontos: comPontos,
      tickets_processados: processados,
      tickets_sem_pontos: semPontos,
      erros: erros.length > 0 ? erros : undefined
    });
  } catch (error) {
    console.error('Erro ao processar retroativo:', error);
    return c.json({ 
      error: "Erro ao processar pontos retroativos",
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido'
    }, 500);
  }
});

// Listar meses disponíveis no histórico
router.get("/historico-mensal/meses", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se usuário é do setor TI
  const profile = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ setor_id: number }>();

  if (!profile || profile.setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor TI" }, 403);
  }

  const meses = await listarMesesDisponiveis(c.env.DB);
  return c.json(meses);
});

// Obter ranking de um mês específico
router.get("/historico-mensal/:mesAno", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se usuário é do setor TI
  const profile = await c.env.DB.prepare(
    "SELECT setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ setor_id: number }>();

  if (!profile || profile.setor_id !== 1) {
    return c.json({ error: "Acesso restrito ao setor TI" }, 403);
  }

  const mesAno = c.req.param("mesAno");
  const limite = parseInt(c.req.query("limite") || "10");

  const historico = await obterHistoricoMensal(c.env.DB, mesAno, limite);
  return c.json(historico);
});

// Resetar pontos mensais (apenas admin/gestor)
router.post("/resetar-mensal", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se é gestor ou admin do setor TI
  const profile = await c.env.DB.prepare(
    "SELECT perfil, setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string; setor_id: number }>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil) || profile.setor_id !== 1) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  try {
    await resetarPontosMensais(c.env.DB);
    return c.json({ sucesso: true, mensagem: "Pontos mensais resetados e histórico salvo" });
  } catch (error) {
    console.error('Erro ao resetar pontos mensais:', error);
    return c.json({ 
      error: "Erro ao resetar pontos mensais",
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido'
    }, 500);
  }
});

// Recalcular TODOS os pontos do zero (apenas admin/gestor)
router.post("/recalcular-completo", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se é gestor ou admin do setor TI
  const profile = await c.env.DB.prepare(
    "SELECT perfil, setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string; setor_id: number }>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil) || profile.setor_id !== 1) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  try {
    console.log('Iniciando recálculo completo de gamificação...');

    // 1. Limpar apenas gamificacao_pontos e gamificacao_ranking
    // NÃO limpar histórico mensal para não perder dados históricos
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM gamificacao_pontos"),
      c.env.DB.prepare("DELETE FROM gamificacao_ranking")
    ]);
    console.log('Tabelas de pontos e ranking limpas');

    // 2. Recalcular pontos usando a nova lógica - INSERT em batch para eficiência
    const { results: chamadosResolvidos } = await c.env.DB.prepare(`
      SELECT c.*, cat.nome as categoria_nome
      FROM chamados c
      INNER JOIN user_profiles up ON c.tecnico_responsavel_id = up.user_id
      LEFT JOIN categorias cat ON c.categoria_id = cat.id
      WHERE c.status IN ('Resolvido', 'Aguardando Avaliação', 'Fechado')
        AND c.tecnico_responsavel_id IS NOT NULL
        AND c.data_resolucao IS NOT NULL
        AND up.setor_id = 1
      ORDER BY c.data_resolucao ASC
    `).all();

    console.log(`Encontrados ${chamadosResolvidos.length} chamados resolvidos`);

    // Processar em batch para evitar timeout
    const batchSize = 100;
    const batches = [];
    
    for (let i = 0; i < chamadosResolvidos.length; i += batchSize) {
      const batch = chamadosResolvidos.slice(i, i + batchSize);
      const inserts = [];
      
      for (const chamado of batch) {
        const ch = chamado as any;
        
        // Pontos base por prioridade
        let pontosBase = 10;
        switch (ch.prioridade) {
          case 'P1': pontosBase = 20; break;
          case 'P2': pontosBase = 15; break;
          case 'P3': pontosBase = 10; break;
          case 'P4': pontosBase = 5; break;
        }

        // Multiplicador de categoria
        let multiplicador = 1.0;
        if (ch.categoria_nome) {
          const catNome = String(ch.categoria_nome);
          if (catNome.includes('BI') || 
              catNome.includes('Power BI') ||
              catNome.includes('Infraestrutura') ||
              catNome.includes('Servidor') ||
              catNome.includes('Rede') ||
              catNome.includes('Banco de Dados')) {
            multiplicador = 3.0;
          } else if (catNome.includes('Hardware') || 
                     catNome.includes('Software') ||
                     catNome.includes('Sistema') ||
                     catNome.includes('E-MAIL')) {
            multiplicador = 2.0;
          }
        }

        // Bônus SLA
        let bonusSLA = 0;
        if (ch.prazo_solucao && ch.data_resolucao) {
          const prazo = new Date(String(ch.prazo_solucao)).getTime();
          const resolucao = new Date(String(ch.data_resolucao)).getTime();
          if (resolucao <= prazo) {
            bonusSLA = 5;
          }
        }

        // Multiplicador auto-atendimento
        const isAuto = ch.solicitante_id === ch.tecnico_responsavel_id;
        const multiplicadorAuto = isAuto ? 0.5 : 1.0;

        // Calcular pontos finais
        const pontos = Math.round((pontosBase * multiplicador + bonusSLA) * multiplicadorAuto);

        inserts.push(
          c.env.DB.prepare(
            `INSERT INTO gamificacao_pontos (user_id, tipo_acao, pontos, descricao, chamado_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            ch.tecnico_responsavel_id,
            'resolucao',
            pontos,
            `Ticket ${ch.numero} resolvido (${ch.prioridade}${ch.categoria_nome ? ' - ' + ch.categoria_nome : ''}${isAuto ? ' - auto' : ''})`,
            ch.id,
            ch.data_resolucao
          )
        );
      }
      
      if (inserts.length > 0) {
        batches.push(c.env.DB.batch(inserts));
      }
    }

    // Executar todos os batches
    await Promise.all(batches);
    console.log(`${chamadosResolvidos.length} pontos de resolução inseridos`);

    // 3. Pontos de feedback (excluindo auto-avaliações) - nova pontuação
    await c.env.DB.prepare(`
      INSERT INTO gamificacao_pontos (user_id, tipo_acao, pontos, descricao, chamado_id, created_at)
      SELECT 
        c.tecnico_responsavel_id as user_id,
        'feedback' as tipo_acao,
        CASE 
          WHEN c.avaliacao_nota = 5 THEN 10
          WHEN c.avaliacao_nota = 4 THEN 5
          WHEN c.avaliacao_nota = 3 THEN 2
          ELSE 0
        END as pontos,
        'Avaliação ' || c.avaliacao_nota || '⭐ no ticket ' || c.numero as descricao,
        c.id as chamado_id,
        c.avaliacao_data as created_at
      FROM chamados c
      INNER JOIN user_profiles up ON c.tecnico_responsavel_id = up.user_id
      WHERE c.avaliacao_nota IS NOT NULL
        AND c.avaliacao_nota >= 3
        AND c.solicitante_id != c.tecnico_responsavel_id
        AND up.setor_id = 1
    `).run();

    console.log('Pontos de feedback inseridos');

    // 4. Contar total de chamados processados
    const totalChamados = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT chamado_id) as total
      FROM gamificacao_pontos
    `).first<{ total: number }>();

    // 5. NÃO reconstruir histórico mensal - mantém dados históricos intactos
    console.log('Histórico mensal preservado');

    // 6. Atualizar ranking atual
    const mesAtual = new Date().toISOString().slice(0, 7);
    
    await c.env.DB.prepare(`
      INSERT INTO gamificacao_ranking 
      (user_id, user_nome, total_pontos, mes_atual, nivel, created_at, updated_at)
      SELECT 
        gp.user_id,
        up.nome as user_nome,
        COALESCE(SUM(gp.pontos), 0) as total_pontos,
        COALESCE(SUM(CASE 
          WHEN strftime('%Y-%m', gp.created_at) = ? 
          THEN gp.pontos 
          ELSE 0 
        END), 0) as mes_atual,
        (COALESCE(SUM(gp.pontos), 0) / 100) + 1 as nivel,
        datetime('now') as created_at,
        datetime('now') as updated_at
      FROM gamificacao_pontos gp
      INNER JOIN user_profiles up ON gp.user_id = up.user_id
      WHERE up.setor_id = 1
      GROUP BY gp.user_id, up.nome
    `).bind(mesAtual).run();

    console.log('Ranking atualizado');

    // Contar meses e técnicos
    const mesesCount = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT mes_ano) as total
      FROM gamificacao_historico_mensal
    `).first<{ total: number }>();

    const tecnicosCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM gamificacao_ranking
    `).first<{ total: number }>();

    console.log('Recálculo completo finalizado');

    return c.json({
      sucesso: true,
      mensagem: "Recálculo completo realizado com sucesso",
      total_chamados: totalChamados?.total || 0,
      chamados_processados: totalChamados?.total || 0,
      meses_historico: (mesesCount?.total || 0) + 1, // +1 para mês atual
      tecnicos_atualizados: tecnicosCount?.total || 0
    });
  } catch (error) {
    console.error('Erro ao recalcular completo:', error);
    return c.json({ 
      error: "Erro ao recalcular pontos",
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido'
    }, 500);
  }
});

export default router;
