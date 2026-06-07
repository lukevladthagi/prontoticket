import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  try {
    const dataInicio = c.req.query("data_inicio");
    const dataFim = c.req.query("data_fim");
    const setorDestinoId = c.req.query("setor_destino_id");

    let whereClause = "WHERE 1=1";
    const bindings: any[] = [];

    if (dataInicio) {
      whereClause += ` AND DATE(c.data_abertura) >= DATE(?)`;
      bindings.push(dataInicio);
    }

    if (dataFim) {
      whereClause += ` AND DATE(c.data_abertura) <= DATE(?)`;
      bindings.push(dataFim);
    }

    if (setorDestinoId && setorDestinoId !== 'todos') {
      whereClause += ` AND c.setor_destino_id = ?`;
      bindings.push(parseInt(setorDestinoId));
    }

    // Chamados por setor solicitante
    const porSetorSolicitante = await c.env.DB.prepare(`
      SELECT 
        COALESCE(c.solicitante_setor, 'Não especificado') as setor_solicitante,
        c.solicitante_setor,
        COUNT(*) as total,
        COUNT(CASE WHEN c.status = 'Novo' THEN 1 END) as novos,
        COUNT(CASE WHEN c.status IN ('Em triagem', 'Em atendimento') THEN 1 END) as em_andamento,
        COUNT(CASE WHEN c.status IN ('Pausado - Usuário', 'Pausado - Fornecedor') THEN 1 END) as aguardando,
        COUNT(CASE WHEN c.status = 'Resolvido' THEN 1 END) as resolvidos,
        COUNT(CASE WHEN c.status = 'Fechado' THEN 1 END) as fechados,
        COUNT(CASE WHEN c.status = 'Cancelado' THEN 1 END) as cancelados,
        COUNT(CASE WHEN c.prioridade = 'P1' THEN 1 END) as p1,
        COUNT(CASE WHEN c.prioridade = 'P2' THEN 1 END) as p2,
        COUNT(CASE WHEN c.prioridade = 'P3' THEN 1 END) as p3,
        COUNT(CASE WHEN c.prioridade = 'P4' THEN 1 END) as p4,
        ROUND(AVG(CASE 
          WHEN c.data_resolucao IS NOT NULL 
          THEN (julianday(c.data_resolucao) - julianday(c.data_abertura)) * 24 * 60 
        END), 2) as tempo_medio_resolucao_minutos,
        ROUND(AVG(CASE WHEN c.avaliacao_nota IS NOT NULL THEN c.avaliacao_nota END), 2) as satisfacao_media,
        COUNT(CASE WHEN c.avaliacao_nota IS NOT NULL THEN 1 END) as total_avaliacoes
      FROM chamados c
      ${whereClause}
      GROUP BY c.solicitante_setor
      ORDER BY total DESC
    `).bind(...bindings).all();

    // Detalhamento por setor solicitante e tipo de problema
    const porSetorETipo = await c.env.DB.prepare(`
      SELECT 
        COALESCE(c.solicitante_setor, 'Não especificado') as setor_solicitante,
        COALESCE(c.tipo_problema, 'Não especificado') as tipo_problema,
        COUNT(*) as total
      FROM chamados c
      ${whereClause}
      GROUP BY c.solicitante_setor, c.tipo_problema
      ORDER BY c.solicitante_setor, total DESC
    `).bind(...bindings).all();

    // Detalhamento por setor solicitante e prioridade
    const porSetorEPrioridade = await c.env.DB.prepare(`
      SELECT 
        COALESCE(c.solicitante_setor, 'Não especificado') as setor_solicitante,
        c.prioridade,
        COUNT(*) as total
      FROM chamados c
      ${whereClause}
      GROUP BY c.solicitante_setor, c.prioridade
      ORDER BY c.solicitante_setor, c.prioridade
    `).bind(...bindings).all();

    // Estatísticas gerais
    const estatisticas = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_chamados,
        COUNT(DISTINCT c.solicitante_setor) as total_setores,
        COUNT(CASE WHEN c.status IN ('Resolvido', 'Fechado') THEN 1 END) as total_resolvidos,
        ROUND(AVG(CASE 
          WHEN c.data_resolucao IS NOT NULL 
          THEN (julianday(c.data_resolucao) - julianday(c.data_abertura)) * 24 * 60 
        END), 2) as tempo_medio_geral
      FROM chamados c
      ${whereClause}
    `).bind(...bindings).first();

    return c.json({
      por_setor_solicitante: porSetorSolicitante.results || [],
      por_setor_e_tipo: porSetorETipo.results || [],
      por_setor_e_prioridade: porSetorEPrioridade.results || [],
      estatisticas: estatisticas || {}
    });

  } catch (error) {
    console.error('Erro ao gerar relatório de setores:', error);
    return c.json({ error: 'Erro ao gerar relatório' }, 500);
  }
});

export default router;
