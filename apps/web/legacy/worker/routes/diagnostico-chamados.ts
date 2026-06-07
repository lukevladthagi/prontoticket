import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { UserProfile } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  try {
    const user = c.get("user")!;
    const setorIdParam = c.req.query("setor_id");
    
    console.log('[DIAGNOSTICO] Usuario:', user.id, 'Setor param:', setorIdParam);
    
    const profile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first<UserProfile>();

    if (!profile) {
      console.log('[DIAGNOSTICO] Perfil não encontrado');
      return c.json({ error: "Perfil não encontrado" }, 404);
    }

    console.log('[DIAGNOSTICO] Perfil:', profile.perfil, 'Setor ID:', profile.setor_id);

    // Apenas admin e gestor podem acessar
    if (profile.perfil !== 'admin' && profile.perfil !== 'gestor') {
      console.log('[DIAGNOSTICO] Sem permissão');
      return c.json({ error: "Sem permissão" }, 403);
    }

    // Construir o mesmo WHERE clause do dashboard
    let whereClause = 'WHERE 1=1';

    if (setorIdParam) {
      whereClause += ` AND setor_destino_id = ${parseInt(setorIdParam)}`;
    } else if (profile.perfil !== 'admin' && profile.setor_id) {
      whereClause += ` AND setor_destino_id = ${profile.setor_id}`;
    }

    console.log('[DIAGNOSTICO] WHERE clause:', whereClause);

    // Buscar chamados abertos
    const query1 = `SELECT 
      id, 
      numero, 
      titulo, 
      status, 
      prioridade, 
      setor_destino_id,
      solicitante_id,
      fila_id,
      data_abertura
    FROM chamados 
    ${whereClause} 
    AND status IN ('Novo', 'Em triagem', 'Em atendimento', 'Pausado - Usuário', 'Pausado - Fornecedor')
    ORDER BY data_abertura DESC`;
    
    console.log('[DIAGNOSTICO] Query abertos:', query1);
    const abertos = await c.env.DB.prepare(query1).all();

    // Buscar chamados em atendimento
    const query2 = `SELECT 
      id, 
      numero, 
      titulo, 
      status, 
      prioridade, 
      setor_destino_id,
      solicitante_id,
      fila_id,
      data_abertura
    FROM chamados 
    ${whereClause} 
    AND status = 'Em atendimento'
    ORDER BY data_abertura DESC`;
    
    console.log('[DIAGNOSTICO] Query em atendimento:', query2);
    const emAtendimento = await c.env.DB.prepare(query2).all();

    // Buscar informações do setor
    const setorInfo = setorIdParam ? await c.env.DB.prepare(
      "SELECT * FROM setores WHERE id = ?"
    ).bind(parseInt(setorIdParam)).first() : null;

    // Buscar filas do setor
    const filas = setorIdParam ? await c.env.DB.prepare(
      "SELECT * FROM filas_atendimento WHERE setor_id = ?"
    ).bind(parseInt(setorIdParam)).all() : null;

    return c.json({
      usuario: {
        id: user.id,
        email: user.email,
        perfil: profile.perfil,
        setor_id: profile.setor_id
      },
      filtro: {
        setor_id: setorIdParam,
        whereClause
      },
      setor_info: setorInfo,
      filas: filas?.results || [],
      chamados_abertos: {
        total: abertos.results?.length || 0,
        chamados: abertos.results || []
      },
      chamados_em_atendimento: {
        total: emAtendimento.results?.length || 0,
        chamados: emAtendimento.results || []
      }
    });
  } catch (error) {
    console.error('[DIAGNOSTICO] Erro:', error);
    return c.json({ 
      error: "Erro ao buscar diagnóstico",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default router;
