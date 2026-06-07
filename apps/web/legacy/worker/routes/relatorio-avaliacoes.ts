import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Endpoint para gerar relatório de avaliações
router.get("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se usuário tem permissão
  const profile = await c.env.DB.prepare(
    "SELECT perfil, setor_id FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string; setor_id: number }>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  // Gestores, admins e técnicos podem gerar relatório
  if (profile.perfil !== 'gestor' && profile.perfil !== 'admin' && profile.perfil !== 'tecnico') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    const { setor_id, data_inicio, data_fim } = c.req.query();

    let query = `
      SELECT 
        c.id,
        c.numero,
        c.titulo,
        c.tipo,
        c.prioridade,
        c.status,
        c.avaliacao_nota,
        c.avaliacao_comentario,
        c.avaliacao_nps,
        c.avaliacao_resolveu,
        c.avaliacao_data,
        c.data_abertura,
        c.data_resolucao,
        c.solicitante_nome,
        c.solicitante_email,
        s.nome as setor_nome,
        up.nome as tecnico_nome
      FROM chamados c
      LEFT JOIN setores s ON c.setor_destino_id = s.id
      LEFT JOIN user_profiles up ON c.tecnico_responsavel_id = up.user_id
      WHERE c.avaliacao_nota IS NOT NULL
    `;

    const params: any[] = [];

    // Filtro por setor
    if (setor_id && setor_id !== 'todos') {
      query += ` AND c.setor_destino_id = ?`;
      params.push(parseInt(setor_id));
    }

    // Filtro por data de avaliação
    if (data_inicio) {
      query += ` AND DATE(c.avaliacao_data) >= DATE(?)`;
      params.push(data_inicio);
    }

    if (data_fim) {
      query += ` AND DATE(c.avaliacao_data) <= DATE(?)`;
      params.push(data_fim);
    }

    query += ` ORDER BY c.avaliacao_data DESC`;

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();

    return c.json(result.results || []);
  } catch (error) {
    console.error("Erro ao gerar relatório de avaliações:", error);
    return c.json({ 
      error: "Erro ao gerar relatório", 
      detalhes: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

export default router;
