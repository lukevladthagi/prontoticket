import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar todos os badges disponíveis
router.get("/", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM badges ORDER BY id"
  ).all();

  return c.json(results);
});

// Listar badges do usuário
router.get("/meus", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  const { results } = await c.env.DB.prepare(
    `SELECT b.*, ub.data_conquista 
     FROM badges b
     JOIN user_badges ub ON b.id = ub.badge_id
     WHERE ub.user_id = ?
     ORDER BY ub.data_conquista DESC`
  ).bind(user.id).all();

  return c.json(results);
});

// Listar badges de um usuário específico (para gestores)
router.get("/usuario/:userId", authMiddleware, async (c) => {
  const userId = c.req.param("userId");
  
  const { results } = await c.env.DB.prepare(
    `SELECT b.*, ub.data_conquista 
     FROM badges b
     JOIN user_badges ub ON b.id = ub.badge_id
     WHERE ub.user_id = ?
     ORDER BY ub.data_conquista DESC`
  ).bind(userId).all();

  return c.json(results);
});

// Listar conquistas do mês (badges com técnicos que conquistaram)
router.get("/conquistas-mes", authMiddleware, async (c) => {
  const mesAno = c.req.query("mes_ano"); // Formato: "2024-01"
  
  let query = `
    SELECT 
      b.id as badge_id,
      b.nome as badge_nome,
      b.descricao as badge_descricao,
      b.icone,
      ub.user_id,
      up.nome as user_nome,
      ub.data_conquista,
      gr.total_pontos,
      gr.mes_atual as pontos_mes
    FROM badges b
    LEFT JOIN user_badges ub ON b.id = ub.badge_id
    LEFT JOIN user_profiles up ON ub.user_id = up.user_id
    LEFT JOIN gamificacao_ranking gr ON ub.user_id = gr.user_id
    WHERE (up.setor_id = 1 OR up.setor_id IS NULL)
  `;

  if (mesAno) {
    // Filtrar por mês específico
    query += `
    AND strftime('%Y-%m', ub.data_conquista) = ?
    `;
  }

  query += `
    ORDER BY b.id, gr.total_pontos DESC, ub.data_conquista DESC
  `;

  const { results } = mesAno 
    ? await c.env.DB.prepare(query).bind(mesAno).all()
    : await c.env.DB.prepare(query).all();

  // Agrupar por badge
  const badgesMap = new Map();
  
  for (const row of results as any[]) {
    const badgeId = row.badge_id;
    
    if (!badgesMap.has(badgeId)) {
      badgesMap.set(badgeId, {
        id: badgeId,
        nome: row.badge_nome,
        descricao: row.badge_descricao,
        icone: row.icone,
        conquistadores: []
      });
    }
    
    // Adicionar conquistador se existir (apenas técnicos da TI)
    if (row.user_id) {
      badgesMap.get(badgeId).conquistadores.push({
        user_id: row.user_id,
        user_nome: row.user_nome,
        data_conquista: row.data_conquista,
        total_pontos: row.total_pontos || 0,
        pontos_mes: row.pontos_mes || 0
      });
    }
  }

  return c.json(Array.from(badgesMap.values()));
});

// Listar todos os técnicos com suas badges (para admins/gestores)
router.get("/todos-tecnicos", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const dataInicio = c.req.query("data_inicio");
  const dataFim = c.req.query("data_fim");
  
  // Buscar perfil do usuário
  const { results: profileResults } = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();
  
  const perfil = (profileResults[0] as any)?.perfil;
  
  // Apenas admin e gestor podem ver todos os técnicos
  if (perfil !== 'admin' && perfil !== 'gestor') {
    return c.json({ error: 'Acesso negado' }, 403);
  }
  
  // Se tiver filtro de data, calcular pontos dinamicamente
  if (dataInicio && dataFim) {
    // Buscar pontos do período
    const { results: pontosResults } = await c.env.DB.prepare(`
      SELECT 
        user_id,
        SUM(pontos) as pontos_periodo
      FROM gamificacao_pontos
      WHERE DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
      GROUP BY user_id
    `).bind(dataInicio, dataFim).all();
    
    const pontosMap = new Map();
    for (const r of pontosResults as any[]) {
      pontosMap.set(r.user_id, r.pontos_periodo || 0);
    }
    
    // Buscar técnicos com badges do período
    const { results } = await c.env.DB.prepare(`
      SELECT 
        up.user_id,
        up.nome as user_nome,
        gr.total_pontos,
        gr.mes_atual,
        gr.nivel,
        b.id as badge_id,
        b.nome as badge_nome,
        b.descricao as badge_descricao,
        b.icone,
        ub.data_conquista
      FROM user_profiles up
      LEFT JOIN gamificacao_ranking gr ON up.user_id = gr.user_id
      LEFT JOIN user_badges ub ON up.user_id = ub.user_id 
        AND DATE(ub.data_conquista) >= DATE(?) AND DATE(ub.data_conquista) <= DATE(?)
      LEFT JOIN badges b ON ub.badge_id = b.id
      WHERE up.setor_id = 1 
        AND up.perfil = 'tecnico'
        AND up.telegram_user_id IS NULL
      ORDER BY up.nome ASC, b.id ASC
    `).bind(dataInicio, dataFim).all();

    // Agrupar por técnico
    const tecnicosMap = new Map();
    
    for (const row of results as any[]) {
      const odUserId = row.user_id;
      
      if (!tecnicosMap.has(odUserId)) {
        tecnicosMap.set(odUserId, {
          user_id: odUserId,
          user_nome: row.user_nome,
          total_pontos: row.total_pontos || 0,
          mes_atual: row.mes_atual || 0,
          pontos_periodo: pontosMap.get(odUserId) || 0,
          nivel: row.nivel || 1,
          badges: []
        });
      }
      
      // Adicionar badge se existir
      if (row.badge_id) {
        tecnicosMap.get(odUserId).badges.push({
          id: row.badge_id,
          nome: row.badge_nome,
          descricao: row.badge_descricao,
          icone: row.icone,
          data_conquista: row.data_conquista
        });
      }
    }

    // Ordenar por pontos do período
    const tecnicos = Array.from(tecnicosMap.values());
    tecnicos.sort((a: any, b: any) => (b.pontos_periodo || 0) - (a.pontos_periodo || 0));
    return c.json(tecnicos);
  }
  
  // Buscar todos os técnicos da TI com suas badges (sem filtro de data)
  const { results } = await c.env.DB.prepare(`
    SELECT 
      up.user_id,
      up.nome as user_nome,
      gr.total_pontos,
      gr.mes_atual,
      gr.nivel,
      b.id as badge_id,
      b.nome as badge_nome,
      b.descricao as badge_descricao,
      b.icone,
      ub.data_conquista
    FROM user_profiles up
    LEFT JOIN gamificacao_ranking gr ON up.user_id = gr.user_id
    LEFT JOIN user_badges ub ON up.user_id = ub.user_id
    LEFT JOIN badges b ON ub.badge_id = b.id
    WHERE up.setor_id = 1 
      AND up.perfil = 'tecnico'
      AND up.telegram_user_id IS NULL
    ORDER BY gr.total_pontos DESC NULLS LAST, up.nome ASC, b.id ASC
  `).all();

  // Agrupar por técnico
  const tecnicosMap = new Map();
  
  for (const row of results as any[]) {
    const odUserId = row.user_id;
    
    if (!tecnicosMap.has(odUserId)) {
      tecnicosMap.set(odUserId, {
        user_id: odUserId,
        user_nome: row.user_nome,
        total_pontos: row.total_pontos || 0,
        mes_atual: row.mes_atual || 0,
        nivel: row.nivel || 1,
        badges: []
      });
    }
    
    // Adicionar badge se existir
    if (row.badge_id) {
      tecnicosMap.get(odUserId).badges.push({
        id: row.badge_id,
        nome: row.badge_nome,
        descricao: row.badge_descricao,
        icone: row.icone,
        data_conquista: row.data_conquista
      });
    }
  }

  return c.json(Array.from(tecnicosMap.values()));
});

export default router;
