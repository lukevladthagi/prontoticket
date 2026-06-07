import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  try {
    const user = c.get("user")!;
    
    // Verificar se usuário é do setor TI
    const profile = await c.env.DB.prepare(
      "SELECT setor_id, perfil FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first<{ setor_id: number; perfil: string }>();

    if (!profile || profile.setor_id !== 1) {
      return c.json({ error: "Acesso restrito ao setor TI" }, 403);
    }

    const dataInicio = c.req.query("data_inicio");
    const dataFim = c.req.query("data_fim");
    const tecnicoId = c.req.query("tecnico_id");

    // 1. Ranking completo de técnicos
    let queryRanking = `
      SELECT 
        gr.user_id,
        gr.user_nome,
        SUM(COALESCE(gp.pontos, 0)) as total_pontos,
        gr.mes_atual,
        gr.nivel,
        COUNT(DISTINCT gp.chamado_id) as tickets_resolvidos,
        CAST(AVG(CASE WHEN c.avaliacao_nota IS NOT NULL THEN c.avaliacao_nota ELSE NULL END) AS REAL) as media_avaliacao,
        COUNT(CASE WHEN c.data_resolucao IS NOT NULL AND c.data_resolucao <= c.prazo_solucao THEN 1 END) as tickets_no_sla,
        COUNT(CASE WHEN c.data_resolucao IS NOT NULL THEN 1 END) as total_resolvidos
      FROM gamificacao_ranking gr
      INNER JOIN user_profiles up ON gr.user_id = up.user_id
      LEFT JOIN gamificacao_pontos gp ON gr.user_id = gp.user_id
      LEFT JOIN chamados c ON gp.chamado_id = c.id
      WHERE up.setor_id = 1
    `;

    const paramsRanking: any[] = [];
    if (dataInicio) {
      queryRanking += " AND DATE(gp.created_at) >= ?";
      paramsRanking.push(dataInicio);
    }
    if (dataFim) {
      queryRanking += " AND DATE(gp.created_at) <= ?";
      paramsRanking.push(dataFim);
    }
    if (tecnicoId) {
      queryRanking += " AND gr.user_id = ?";
      paramsRanking.push(tecnicoId);
    }

    queryRanking += `
      GROUP BY gr.user_id, gr.user_nome, gr.mes_atual, gr.nivel
      ORDER BY total_pontos DESC
    `;

    const { results: ranking } = await c.env.DB.prepare(queryRanking).bind(...paramsRanking).all();

    // 2. Detalhamento de pontos por tipo de ação
    let queryDetalhamento = `
      SELECT 
        gp.user_id,
        up.nome as tecnico_nome,
        gp.tipo_acao,
        gp.descricao,
        SUM(gp.pontos) as total_pontos,
        COUNT(*) as quantidade
      FROM gamificacao_pontos gp
      INNER JOIN user_profiles up ON gp.user_id = up.user_id
      WHERE up.setor_id = 1
    `;

    const paramsDetalhamento: any[] = [];
    if (dataInicio) {
      queryDetalhamento += " AND DATE(gp.created_at) >= ?";
      paramsDetalhamento.push(dataInicio);
    }
    if (dataFim) {
      queryDetalhamento += " AND DATE(gp.created_at) <= ?";
      paramsDetalhamento.push(dataFim);
    }
    if (tecnicoId) {
      queryDetalhamento += " AND gp.user_id = ?";
      paramsDetalhamento.push(tecnicoId);
    }

    queryDetalhamento += `
      GROUP BY gp.user_id, up.nome, gp.tipo_acao, gp.descricao
      ORDER BY gp.user_id, total_pontos DESC
    `;

    const { results: detalhamentoPorTipo } = await c.env.DB.prepare(queryDetalhamento)
      .bind(...paramsDetalhamento).all();

    // 3. Histórico completo ticket por ticket
    let queryHistorico = `
      SELECT 
        gp.id,
        gp.user_id,
        up.nome as tecnico_nome,
        gp.chamado_id,
        c.numero as chamado_numero,
        c.titulo as chamado_titulo,
        c.tipo as chamado_tipo,
        c.prioridade,
        c.data_abertura,
        c.data_resolucao,
        c.prazo_solucao,
        c.avaliacao_nota,
        c.avaliacao_comentario,
        gp.tipo_acao,
        gp.pontos,
        gp.descricao,
        gp.created_at,
        CASE 
          WHEN c.data_resolucao IS NOT NULL AND c.prazo_solucao IS NOT NULL 
            AND c.data_resolucao <= c.prazo_solucao THEN 'Dentro do SLA'
          WHEN c.data_resolucao IS NOT NULL AND c.prazo_solucao IS NOT NULL THEN 'Fora do SLA'
          ELSE 'N/A'
        END as status_sla
      FROM gamificacao_pontos gp
      INNER JOIN user_profiles up ON gp.user_id = up.user_id
      LEFT JOIN chamados c ON gp.chamado_id = c.id
      WHERE up.setor_id = 1
    `;

    const paramsHistorico: any[] = [];
    if (dataInicio) {
      queryHistorico += " AND DATE(gp.created_at) >= ?";
      paramsHistorico.push(dataInicio);
    }
    if (dataFim) {
      queryHistorico += " AND DATE(gp.created_at) <= ?";
      paramsHistorico.push(dataFim);
    }
    if (tecnicoId) {
      queryHistorico += " AND gp.user_id = ?";
      paramsHistorico.push(tecnicoId);
    }

    queryHistorico += " ORDER BY gp.created_at DESC";

    const { results: historicoCompleto } = await c.env.DB.prepare(queryHistorico)
      .bind(...paramsHistorico).all();

    // 4. Evolução de pontos ao longo do tempo (agrupado por data de resolução do chamado)
    let queryEvolucao = `
      SELECT 
        gp.user_id,
        up.nome as tecnico_nome,
        DATE(c.data_resolucao) as data,
        SUM(gp.pontos) as pontos_dia
      FROM gamificacao_pontos gp
      INNER JOIN user_profiles up ON gp.user_id = up.user_id
      LEFT JOIN chamados c ON gp.chamado_id = c.id
      WHERE up.setor_id = 1 AND c.data_resolucao IS NOT NULL
    `;

    const paramsEvolucao: any[] = [];
    if (dataInicio) {
      queryEvolucao += " AND DATE(c.data_resolucao) >= ?";
      paramsEvolucao.push(dataInicio);
    }
    if (dataFim) {
      queryEvolucao += " AND DATE(c.data_resolucao) <= ?";
      paramsEvolucao.push(dataFim);
    }
    if (tecnicoId) {
      queryEvolucao += " AND gp.user_id = ?";
      paramsEvolucao.push(tecnicoId);
    }

    queryEvolucao += `
      GROUP BY gp.user_id, up.nome, DATE(c.data_resolucao)
      ORDER BY DATE(c.data_resolucao) ASC
    `;

    const { results: evolucaoPontos } = await c.env.DB.prepare(queryEvolucao)
      .bind(...paramsEvolucao).all();

    // 5. Badges conquistadas
    let queryBadges = `
      SELECT 
        ub.user_id,
        up.nome as tecnico_nome,
        b.nome as badge_nome,
        b.descricao as badge_descricao,
        b.icone,
        ub.data_conquista
      FROM user_badges ub
      INNER JOIN user_profiles up ON ub.user_id = up.user_id
      INNER JOIN badges b ON ub.badge_id = b.id
      WHERE up.setor_id = 1
    `;

    const paramsBadges: any[] = [];
    if (dataInicio) {
      queryBadges += " AND DATE(ub.data_conquista) >= ?";
      paramsBadges.push(dataInicio);
    }
    if (dataFim) {
      queryBadges += " AND DATE(ub.data_conquista) <= ?";
      paramsBadges.push(dataFim);
    }
    if (tecnicoId) {
      queryBadges += " AND ub.user_id = ?";
      paramsBadges.push(tecnicoId);
    }

    queryBadges += " ORDER BY ub.data_conquista DESC";

    const { results: badges } = await c.env.DB.prepare(queryBadges)
      .bind(...paramsBadges).all();

    return c.json({
      ranking,
      detalhamentoPorTipo,
      historicoCompleto,
      evolucaoPontos,
      badges
    });
  } catch (error) {
    console.error("Erro ao gerar relatório de gamificação:", error);
    return c.json({ 
      error: "Erro ao gerar relatório",
      detalhes: error instanceof Error ? error.message : "Erro desconhecido"
    }, 500);
  }
});

export default router;
