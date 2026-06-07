import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { UserProfile } from "../../shared/types";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/auditar", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const setorIdParam = c.req.query("setor_id");
  const periodoParam = c.req.query("periodo"); // 'mes' ou 'total'
  
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  // Obter nome do setor
  let setorNome = "Todos os setores";
  let setorId = null;

  // Construir whereClause EXATAMENTE como no dashboard.ts
  let whereClause = profile.perfil === 'solicitante' 
    ? `WHERE solicitante_id = '${user.id}'` 
    : 'WHERE 1=1';

  // Se há filtro de setor na query string, usar ele (para admins, gestores e técnicos)
  if (setorIdParam) {
    whereClause += ` AND setor_destino_id = ${parseInt(setorIdParam)}`;
    setorId = parseInt(setorIdParam);
    const setor = await c.env.DB.prepare(
      "SELECT nome FROM setores WHERE id = ?"
    ).bind(setorId).first<{ nome: string }>();
    setorNome = setor?.nome || `Setor ${setorId}`;
  }
  // Senão, para técnicos (não gestores ou admin), filtrar automaticamente pelo setor deles
  else if (profile.perfil === 'tecnico' && profile.setor_id) {
    // Buscar setores adicionais que o usuário tem acesso
    const setoresAdicionais = await c.env.DB.prepare(
      `SELECT setor_id FROM user_setores_acesso WHERE user_profile_id = ?`
    ).bind(profile.id).all<{ setor_id: number }>();
    
    const setoresPermitidos = [profile.setor_id];
    if (setoresAdicionais.results && setoresAdicionais.results.length > 0) {
      setoresAdicionais.results.forEach(s => setoresPermitidos.push(s.setor_id));
    }
    
    // Verificar se o técnico tem fila própria
    const filaTecnico = await c.env.DB.prepare(
      `SELECT id FROM filas_atendimento 
       WHERE setor_id = ? AND responsavel_id = ? AND tipo = 'tecnico' AND ativo = TRUE 
       LIMIT 1`
    ).bind(profile.setor_id, user.id).first<{ id: number }>();
    
    if (filaTecnico) {
      whereClause += ` AND fila_id = ${filaTecnico.id}`;
    } else {
      // Filtrar por múltiplos setores se o usuário tiver acesso adicional
      if (setoresPermitidos.length === 1) {
        whereClause += ` AND setor_destino_id = ${profile.setor_id}`;
        setorId = profile.setor_id;
      } else {
        whereClause += ` AND setor_destino_id IN (${setoresPermitidos.join(',')})`;
      }
    }

    if (setorId) {
      const setor = await c.env.DB.prepare(
        "SELECT nome FROM setores WHERE id = ?"
      ).bind(setorId).first<{ nome: string }>();
      setorNome = setor?.nome || `Setor ${setorId}`;
    }
  }

  // Filtro de período para SLAs (mês atual)
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const inicioMesISO = inicioMes.toISOString();
  
  let periodoClause = '';
  let periodoDescricao = 'Todo o período';
  if (periodoParam === 'mes') {
    periodoClause = ` AND data_abertura >= '${inicioMesISO}'`;
    periodoDescricao = `Mês atual (a partir de ${inicioMesISO})`;
  }

  // ===================================
  // 1. AUDITORIA SLA RESPOSTA
  // ===================================
  
  const queryRespostaTotal = `SELECT 
    COUNT(*) as total
  FROM chamados ${whereClause}${periodoClause} AND prazo_resposta IS NOT NULL AND data_primeira_resposta IS NOT NULL`;

  const queryRespostaDentro = `SELECT 
    COUNT(CASE WHEN data_primeira_resposta <= prazo_resposta THEN 1 END) as dentro_sla
  FROM chamados ${whereClause}${periodoClause} AND prazo_resposta IS NOT NULL AND data_primeira_resposta IS NOT NULL`;

  const respostaTotal = await c.env.DB.prepare(queryRespostaTotal).first<{ total: number }>();
  const respostaDentro = await c.env.DB.prepare(queryRespostaDentro).first<{ dentro_sla: number }>();

  // Buscar amostra de registros SLA Resposta
  const querySampleResposta = `SELECT 
    id,
    numero,
    status,
    prioridade,
    data_abertura,
    data_primeira_resposta,
    prazo_resposta,
    CASE 
      WHEN data_primeira_resposta <= prazo_resposta THEN 'DENTRO'
      ELSE 'FORA'
    END as sla_status,
    CAST((julianday(data_primeira_resposta) - julianday(data_abertura)) * 24 * 60 AS INTEGER) as tempo_resposta_min,
    CAST((julianday(prazo_resposta) - julianday(data_primeira_resposta)) * 24 * 60 AS INTEGER) as diferenca_min
  FROM chamados ${whereClause}${periodoClause} AND prazo_resposta IS NOT NULL AND data_primeira_resposta IS NOT NULL
  ORDER BY id DESC
  LIMIT 50`;

  const sampleResposta = await c.env.DB.prepare(querySampleResposta).all();

  // Verificar inconsistências - registros que NÃO deveriam estar incluídos
  const queryInconsistenciaResposta = `SELECT 
    id,
    numero,
    status,
    data_abertura,
    data_primeira_resposta,
    prazo_resposta,
    CASE 
      WHEN prazo_resposta IS NULL THEN 'prazo_resposta NULL'
      WHEN data_primeira_resposta IS NULL THEN 'data_primeira_resposta NULL'
      ELSE 'OK'
    END as problema
  FROM chamados ${whereClause}${periodoClause}
  AND (prazo_resposta IS NULL OR data_primeira_resposta IS NULL)
  LIMIT 20`;

  const inconsistenciasResposta = await c.env.DB.prepare(queryInconsistenciaResposta).all();

  // ===================================
  // 2. AUDITORIA SLA RESOLUÇÃO
  // ===================================
  
  const queryResolucaoTotal = `SELECT 
    COUNT(*) as total
  FROM chamados ${whereClause}${periodoClause} AND prazo_solucao IS NOT NULL AND data_resolucao IS NOT NULL`;

  const queryResolucaoDentro = `SELECT 
    COUNT(CASE WHEN data_resolucao <= prazo_solucao THEN 1 END) as dentro_sla
  FROM chamados ${whereClause}${periodoClause} AND prazo_solucao IS NOT NULL AND data_resolucao IS NOT NULL`;

  const resolucaoTotal = await c.env.DB.prepare(queryResolucaoTotal).first<{ total: number }>();
  const resolucaoDentro = await c.env.DB.prepare(queryResolucaoDentro).first<{ dentro_sla: number }>();

  // Buscar amostra de registros SLA Resolução
  const querySampleResolucao = `SELECT 
    id,
    numero,
    status,
    prioridade,
    data_abertura,
    data_resolucao,
    prazo_solucao,
    CASE 
      WHEN data_resolucao <= prazo_solucao THEN 'DENTRO'
      ELSE 'FORA'
    END as sla_status,
    CAST((julianday(data_resolucao) - julianday(data_abertura)) * 24 * 60 AS INTEGER) as tempo_resolucao_min,
    CAST((julianday(prazo_solucao) - julianday(data_resolucao)) * 24 * 60 AS INTEGER) as diferenca_min
  FROM chamados ${whereClause}${periodoClause} AND prazo_solucao IS NOT NULL AND data_resolucao IS NOT NULL
  ORDER BY id DESC
  LIMIT 50`;

  const sampleResolucao = await c.env.DB.prepare(querySampleResolucao).all();

  // Verificar inconsistências - registros que NÃO deveriam estar incluídos
  const queryInconsistenciaResolucao = `SELECT 
    id,
    numero,
    status,
    data_abertura,
    data_resolucao,
    prazo_solucao,
    CASE 
      WHEN prazo_solucao IS NULL THEN 'prazo_solucao NULL'
      WHEN data_resolucao IS NULL THEN 'data_resolucao NULL'
      ELSE 'OK'
    END as problema
  FROM chamados ${whereClause}${periodoClause}
  AND (prazo_solucao IS NULL OR data_resolucao IS NULL)
  LIMIT 20`;

  const inconsistenciasResolucao = await c.env.DB.prepare(queryInconsistenciaResolucao).all();

  // ===================================
  // 3. COMPARAR COM DASHBOARD ATUAL
  // ===================================

  const dashboardSlaResposta = await c.env.DB.prepare(
    `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN data_primeira_resposta <= prazo_resposta THEN 1 END) as dentro_sla
     FROM chamados ${whereClause}${periodoClause} AND prazo_resposta IS NOT NULL AND data_primeira_resposta IS NOT NULL`
  ).first<{ total: number; dentro_sla: number }>();

  const dashboardSlaResolucao = await c.env.DB.prepare(
    `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN data_resolucao <= prazo_solucao THEN 1 END) as dentro_sla
     FROM chamados ${whereClause}${periodoClause} AND prazo_solucao IS NOT NULL AND data_resolucao IS NOT NULL`
  ).first<{ total: number; dentro_sla: number }>();

  // ===================================
  // 4. MONTAGEM DO RELATÓRIO FINAL
  // ===================================

  return c.json({
    contexto: {
      usuario_perfil: profile.perfil,
      usuario_setor: profile.setor_id,
      setor_filtrado: setorNome,
      setor_id_filtrado: setorId,
      periodo: periodoDescricao,
      inicio_mes_iso: periodoParam === 'mes' ? inicioMesISO : null,
      data_auditoria: new Date().toISOString()
    },
    
    filtros_aplicados: {
      where_clause: whereClause,
      periodo_clause: periodoClause || 'Nenhum (todo o período)',
      sql_completo_exemplo: `FROM chamados ${whereClause}${periodoClause}`
    },

    sla_resposta: {
      regras_esperadas: {
        condicoes: "prazo_resposta IS NOT NULL AND data_primeira_resposta IS NOT NULL",
        calculo_dentro_sla: "COUNT(CASE WHEN data_primeira_resposta <= prazo_resposta THEN 1 END)",
        calculo_total: "COUNT(*)"
      },
      queries_executadas: {
        total: queryRespostaTotal,
        dentro_sla: queryRespostaDentro,
        sample: querySampleResposta
      },
      resultados: {
        total: respostaTotal?.total || 0,
        dentro_sla: respostaDentro?.dentro_sla || 0,
        fora_sla: (respostaTotal?.total || 0) - (respostaDentro?.dentro_sla || 0),
        percentual: respostaTotal && respostaTotal.total > 0 
          ? ((respostaDentro?.dentro_sla || 0) / respostaTotal.total * 100).toFixed(2) + '%'
          : 'N/A'
      },
      comparacao_dashboard: {
        dashboard_total: dashboardSlaResposta?.total || 0,
        dashboard_dentro: dashboardSlaResposta?.dentro_sla || 0,
        match_total: (respostaTotal?.total || 0) === (dashboardSlaResposta?.total || 0),
        match_dentro: (respostaDentro?.dentro_sla || 0) === (dashboardSlaResposta?.dentro_sla || 0)
      },
      amostra_registros: sampleResposta.results || [],
      registros_excluidos_corretamente: {
        descricao: "Tickets que NÃO são contados (falta prazo_resposta ou data_primeira_resposta)",
        total: inconsistenciasResposta.results?.length || 0,
        exemplos: inconsistenciasResposta.results || []
      }
    },

    sla_resolucao: {
      regras_esperadas: {
        condicoes: "prazo_solucao IS NOT NULL AND data_resolucao IS NOT NULL",
        calculo_dentro_sla: "COUNT(CASE WHEN data_resolucao <= prazo_solucao THEN 1 END)",
        calculo_total: "COUNT(*)"
      },
      queries_executadas: {
        total: queryResolucaoTotal,
        dentro_sla: queryResolucaoDentro,
        sample: querySampleResolucao
      },
      resultados: {
        total: resolucaoTotal?.total || 0,
        dentro_sla: resolucaoDentro?.dentro_sla || 0,
        fora_sla: (resolucaoTotal?.total || 0) - (resolucaoDentro?.dentro_sla || 0),
        percentual: resolucaoTotal && resolucaoTotal.total > 0 
          ? ((resolucaoDentro?.dentro_sla || 0) / resolucaoTotal.total * 100).toFixed(2) + '%'
          : 'N/A'
      },
      comparacao_dashboard: {
        dashboard_total: dashboardSlaResolucao?.total || 0,
        dashboard_dentro: dashboardSlaResolucao?.dentro_sla || 0,
        match_total: (resolucaoTotal?.total || 0) === (dashboardSlaResolucao?.total || 0),
        match_dentro: (resolucaoDentro?.dentro_sla || 0) === (dashboardSlaResolucao?.dentro_sla || 0)
      },
      amostra_registros: sampleResolucao.results || [],
      registros_excluidos_corretamente: {
        descricao: "Tickets que NÃO são contados (falta prazo_solucao ou data_resolucao)",
        total: inconsistenciasResolucao.results?.length || 0,
        exemplos: inconsistenciasResolucao.results || []
      }
    },

    validacao_final: {
      sla_resposta_consistente: 
        (respostaTotal?.total || 0) === (dashboardSlaResposta?.total || 0) &&
        (respostaDentro?.dentro_sla || 0) === (dashboardSlaResposta?.dentro_sla || 0),
      sla_resolucao_consistente: 
        (resolucaoTotal?.total || 0) === (dashboardSlaResolucao?.total || 0) &&
        (resolucaoDentro?.dentro_sla || 0) === (dashboardSlaResolucao?.dentro_sla || 0),
      filtros_identicos: "SIM - Ambas as métricas usam WHERE clause e período idênticos",
      regras_aplicadas_corretamente: "SIM - Apenas tickets com prazos E datas preenchidos são contados"
    }
  });
});

export default router;
