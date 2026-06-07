import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  try {
    const setorId = c.req.query("setor_id");
    const dataInicio = c.req.query("data_inicio");
    const dataFim = c.req.query("data_fim");

    let whereClause = "WHERE 1=1";
    const bindings: any[] = [];

    if (setorId && setorId !== 'todos') {
      whereClause += ` AND c.setor_destino_id = ?`;
      bindings.push(parseInt(setorId));
    }

    if (dataInicio) {
      whereClause += ` AND DATE(c.data_abertura) >= DATE(?)`;
      bindings.push(dataInicio);
    }

    if (dataFim) {
      whereClause += ` AND DATE(c.data_abertura) <= DATE(?)`;
      bindings.push(dataFim);
    }

    // Distribuição por Tipo de Problema
    const porTipoProblema = await c.env.DB.prepare(`
      SELECT 
        COALESCE(tipo_problema, 'Não especificado') as tipo_problema,
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('Resolvido', 'Fechado') THEN 1 END) as resolvidos,
        COUNT(CASE WHEN status NOT IN ('Resolvido', 'Fechado', 'Cancelado') THEN 1 END) as abertos
      FROM chamados c
      ${whereClause}
      GROUP BY tipo_problema
      ORDER BY total DESC
    `).bind(...bindings).all();

    // Distribuição por Categoria
    const porCategoria = await c.env.DB.prepare(`
      SELECT 
        COALESCE(cat.nome, 'Sem categoria') as categoria,
        COUNT(*) as total,
        COUNT(CASE WHEN c.status IN ('Resolvido', 'Fechado') THEN 1 END) as resolvidos,
        COUNT(CASE WHEN c.status NOT IN ('Resolvido', 'Fechado', 'Cancelado') THEN 1 END) as abertos
      FROM chamados c
      LEFT JOIN categorias cat ON c.categoria_id = cat.id AND cat.tipo = 'categoria'
      ${whereClause}
      GROUP BY cat.nome
      ORDER BY total DESC
    `).bind(...bindings).all();

    // Distribuição por Subcategoria
    const porSubcategoria = await c.env.DB.prepare(`
      SELECT 
        COALESCE(sub.nome, 'Sem subcategoria') as subcategoria,
        COALESCE(cat.nome, 'Sem categoria') as categoria,
        COUNT(*) as total,
        COUNT(CASE WHEN c.status IN ('Resolvido', 'Fechado') THEN 1 END) as resolvidos,
        COUNT(CASE WHEN c.status NOT IN ('Resolvido', 'Fechado', 'Cancelado') THEN 1 END) as abertos
      FROM chamados c
      LEFT JOIN categorias sub ON c.subcategoria_id = sub.id AND sub.tipo = 'subcategoria'
      LEFT JOIN categorias cat ON sub.categoria_pai_id = cat.id
      ${whereClause}
      GROUP BY sub.nome, cat.nome
      ORDER BY total DESC
    `).bind(...bindings).all();

    // Tickets sem classificação completa
    const semClassificacao = await c.env.DB.prepare(`
      SELECT 
        c.id,
        c.numero,
        c.titulo,
        c.tipo_problema,
        c.categoria_id,
        c.subcategoria_id,
        c.item_id,
        c.status,
        c.prioridade,
        c.data_abertura,
        s.nome as setor_nome,
        up.nome as solicitante_nome,
        cat.nome as categoria_nome,
        sub.nome as subcategoria_nome
      FROM chamados c
      LEFT JOIN setores s ON c.setor_destino_id = s.id
      LEFT JOIN user_profiles up ON c.solicitante_id = up.user_id
      LEFT JOIN categorias cat ON c.categoria_id = cat.id AND cat.tipo = 'categoria'
      LEFT JOIN categorias sub ON c.subcategoria_id = sub.id AND sub.tipo = 'subcategoria'
      ${whereClause} 
      AND (c.tipo_problema IS NULL OR c.categoria_id IS NULL)
      ORDER BY c.data_abertura DESC
      LIMIT 500
    `).bind(...bindings).all();

    // Estatísticas gerais
    const stats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN tipo_problema IS NULL THEN 1 END) as sem_tipo_problema,
        COUNT(CASE WHEN categoria_id IS NULL THEN 1 END) as sem_categoria,
        COUNT(CASE WHEN subcategoria_id IS NULL THEN 1 END) as sem_subcategoria,
        COUNT(CASE WHEN tipo_problema IS NOT NULL AND categoria_id IS NOT NULL AND subcategoria_id IS NOT NULL THEN 1 END) as totalmente_classificados
      FROM chamados c
      ${whereClause}
    `).bind(...bindings).first();

    return c.json({
      estatisticas: stats,
      por_tipo_problema: porTipoProblema.results || [],
      por_categoria: porCategoria.results || [],
      por_subcategoria: porSubcategoria.results || [],
      sem_classificacao: semClassificacao.results || []
    });
  } catch (error) {
    console.error('Erro ao gerar relatório de classificação:', error);
    return c.json({ 
      error: "Erro ao gerar relatório", 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

export default router;
