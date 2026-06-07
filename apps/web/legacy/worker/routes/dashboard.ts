import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { DashboardStats, UserProfile } from "../../shared/types";
import { getDataBrasil } from "../utils/timezone";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/stats", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const setorIdParam = c.req.query("setor_id");
  const periodoParam = c.req.query("periodo"); // 'mes' ou 'total'
  const dataInicioParam = c.req.query("data_inicio");
  const dataFimParam = c.req.query("data_fim");
  
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  // Para solicitantes, mostrar apenas seus chamados
  let whereClause = profile.perfil === 'solicitante' 
    ? `WHERE solicitante_id = '${user.id}'` 
    : 'WHERE 1=1';

  // Se há filtro de setor na query string, usar ele (para admins, gestores e técnicos)
  if (setorIdParam) {
    whereClause += ` AND setor_destino_id = ${parseInt(setorIdParam)}`;
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
      } else {
        whereClause += ` AND setor_destino_id IN (${setoresPermitidos.join(',')})`;
      }
    }
  }

  // Filtro de período
  let periodoClause = '';
  
  if (dataInicioParam || dataFimParam) {
    // Se o usuário especificou datas customizadas
    if (dataInicioParam) {
      periodoClause += ` AND date(data_abertura) >= '${dataInicioParam}'`;
    }
    if (dataFimParam) {
      periodoClause += ` AND date(data_abertura) <= '${dataFimParam}'`;
    }
  } else if (periodoParam === 'mes') {
    // Mês atual no horário do Brasil
    const agora = getDataBrasil();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const inicioMes = `${ano}-${mes}-01 00:00:00`;
    periodoClause = ` AND data_abertura >= '${inicioMes}'`;
  }
  // Se periodoParam === 'total' e não há datas customizadas, não adicionar filtro

  // Total de chamados
  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause}`
  ).first<{ count: number }>();

  // Chamados abertos (NOT Fechado or Resolvido)
  const abertos = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause}
     AND status NOT IN ('Fechado', 'Resolvido')`
  ).first<{ count: number }>();

  // Chamados NOVOS sem atribuição (crítico - ninguém olhou ainda)
  const novos = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause}
     AND status = 'Novo' AND tecnico_responsavel_id IS NULL`
  ).first<{ count: number }>();

  // Chamados em TRIAGEM
  const emTriagem = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause}
     AND status = 'Em triagem'`
  ).first<{ count: number }>();

  // Chamados ATRIBUÍDOS (tem técnico responsável e não está fechado/resolvido/pausado)
  const atribuidos = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause}
     AND tecnico_responsavel_id IS NOT NULL 
     AND status NOT IN ('Resolvido', 'Fechado', 'Cancelado')
     AND sla_pausado_em IS NULL`
  ).first<{ count: number }>();

  // Chamados em atendimento
  const emAtendimento = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause} AND status = 'Em atendimento'`
  ).first<{ count: number }>();

  // Chamados PAUSADOS (verificando campo sla_pausado_em ao invés do status)
  const pausados = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause}
     AND sla_pausado_em IS NOT NULL`
  ).first<{ count: number }>();

  // Chamados AGENDADOS
  const agendados = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause}
     AND (agendado = TRUE OR data_agendamento IS NOT NULL)
     AND status NOT IN ('Resolvido', 'Fechado', 'Cancelado')`
  ).first<{ count: number }>();

  // Aguardando (chamados pausados - mantido para compatibilidade)
  const aguardando = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause}
     AND sla_pausado_em IS NOT NULL`
  ).first<{ count: number }>();

  // Resolvidos no período (usando mesmos filtros que outros cards)
  const resolvidosPeriodo = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause}
     AND status IN ('Resolvido', 'Fechado')`
  ).first<{ count: number }>();

  // Satisfação média e contagem
  const satisfacao = await c.env.DB.prepare(
    `SELECT AVG(avaliacao_nota) as media, COUNT(*) as total FROM chamados ${whereClause}${periodoClause} 
     AND avaliacao_nota IS NOT NULL`
  ).first<{ media: number | null; total: number }>();

  // NPS médio e contagem
  const nps = await c.env.DB.prepare(
    `SELECT AVG(avaliacao_nps) as media, COUNT(*) as total FROM chamados ${whereClause}${periodoClause} 
     AND avaliacao_nps IS NOT NULL`
  ).first<{ media: number | null; total: number }>();

  // Tempo médio de resolução (em minutos)
  const tempoResolucao = await c.env.DB.prepare(
    `SELECT AVG((julianday(data_resolucao) - julianday(data_abertura)) * 24 * 60) as media 
     FROM chamados ${whereClause}${periodoClause} 
     AND data_resolucao IS NOT NULL`
  ).first<{ media: number | null }>();

  // Violações de SLA
  const violacoes = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM chamados ${whereClause}${periodoClause} AND violacao_sla = TRUE`
  ).first<{ count: number }>();

  // SLA de Resposta (primeiro atendimento)
  // TOTAL: TODOS os tickets com prazo_resposta configurado (respondidos ou não)
  const slaRespostaTotal = await c.env.DB.prepare(
    `SELECT COUNT(*) as count
     FROM chamados 
     ${whereClause}${periodoClause}
     AND prazo_resposta IS NOT NULL`
  ).first<{ count: number }>();

  // DENTRO DO SLA: Tickets onde:
  // - Se já foi respondido: data_primeira_resposta <= prazo_resposta
  // - Se ainda não foi respondido: CURRENT_TIMESTAMP <= prazo_resposta (ainda no prazo) OU pausado (não conta tempo)
  const slaRespostaDentro = await c.env.DB.prepare(
    `SELECT COUNT(*) as count
     FROM chamados 
     ${whereClause}${periodoClause}
     AND prazo_resposta IS NOT NULL
     AND (
       (data_primeira_resposta IS NOT NULL AND data_primeira_resposta <= prazo_resposta)
       OR
       (data_primeira_resposta IS NULL AND (CURRENT_TIMESTAMP <= prazo_resposta OR sla_pausado_em IS NOT NULL))
     )`
  ).first<{ count: number }>();

  // SLA de Resolução
  // TOTAL: TODOS os tickets com prazo_solucao configurado (resolvidos ou não)
  const slaResolucaoTotal = await c.env.DB.prepare(
    `SELECT COUNT(*) as count
     FROM chamados 
     ${whereClause}${periodoClause}
     AND prazo_solucao IS NOT NULL`
  ).first<{ count: number }>();

  // DENTRO DO SLA: Tickets onde:
  // - Se já foi resolvido: data_resolucao <= prazo_solucao
  // - Se ainda não foi resolvido: CURRENT_TIMESTAMP <= prazo_solucao (ainda no prazo) OU pausado (não conta tempo)
  const slaResolucaoDentro = await c.env.DB.prepare(
    `SELECT COUNT(*) as count
     FROM chamados 
     ${whereClause}${periodoClause}
     AND prazo_solucao IS NOT NULL
     AND (
       (data_resolucao IS NOT NULL AND data_resolucao <= prazo_solucao)
       OR
       (data_resolucao IS NULL AND (CURRENT_TIMESTAMP <= prazo_solucao OR sla_pausado_em IS NOT NULL))
     )`
  ).first<{ count: number }>();

  // Calculate percentages
  const slaRespostaPercentual = slaRespostaTotal && slaRespostaTotal.count > 0 
    ? (slaRespostaDentro!.count / slaRespostaTotal.count) * 100 
    : null;

  const slaResolucaoPercentual = slaResolucaoTotal && slaResolucaoTotal.count > 0 
    ? (slaResolucaoDentro!.count / slaResolucaoTotal.count) * 100 
    : null;

  // Chamados por prioridade
  const porPrioridade = await c.env.DB.prepare(
    `SELECT 
       COUNT(CASE WHEN prioridade = 'P1' THEN 1 END) as P1,
       COUNT(CASE WHEN prioridade = 'P2' THEN 1 END) as P2,
       COUNT(CASE WHEN prioridade = 'P3' THEN 1 END) as P3,
       COUNT(CASE WHEN prioridade = 'P4' THEN 1 END) as P4
     FROM chamados ${whereClause}${periodoClause}`
  ).first<{ P1: number; P2: number; P3: number; P4: number }>();

  // Chamados por status
  const porStatus = await c.env.DB.prepare(
    `SELECT 
       COUNT(CASE WHEN status = 'Novo' THEN 1 END) as Novo,
       COUNT(CASE WHEN status = 'Em triagem' THEN 1 END) as EmTriagem,
       COUNT(CASE WHEN status = 'Em atendimento' THEN 1 END) as EmAtendimento,
       COUNT(CASE WHEN status = 'Pausado - Usuário' THEN 1 END) as AguardandoUsuario,
       COUNT(CASE WHEN status = 'Pausado - Fornecedor' THEN 1 END) as AguardandoFornecedor,
       COUNT(CASE WHEN status = 'Resolvido' THEN 1 END) as Resolvido,
       COUNT(CASE WHEN status = 'Fechado' THEN 1 END) as Fechado,
       COUNT(CASE WHEN status = 'Cancelado' THEN 1 END) as Cancelado
     FROM chamados ${whereClause}${periodoClause}`
  ).first<any>();

  // Chamados por mês (últimos 12 meses)
  const chamadosPorMes = await c.env.DB.prepare(
    `SELECT 
       strftime('%Y-%m', data_abertura) as mes,
       COUNT(*) as total,
       COUNT(*) as novos,
       COUNT(CASE WHEN status IN ('Resolvido', 'Fechado') THEN 1 END) as resolvidos
     FROM chamados ${whereClause}
     AND data_abertura >= date('now', '-12 months')
     GROUP BY strftime('%Y-%m', data_abertura)
     ORDER BY mes ASC`
  ).all();

  // Chamados por tipo de problema
  const chamadosPorTipoProblema = await c.env.DB.prepare(
    `SELECT 
       COALESCE(tipo_problema, 'Não especificado') as tipo_problema,
       COUNT(*) as total
     FROM chamados ${whereClause}${periodoClause}
     GROUP BY tipo_problema
     ORDER BY total DESC`
  ).all();

  // Chamados por categoria (top 10)
  const chamadosPorCategoria = await c.env.DB.prepare(
    `SELECT 
       COALESCE(cat.nome, 'Sem categoria') as categoria,
       COUNT(*) as total
     FROM chamados c
     LEFT JOIN categorias cat ON c.categoria_id = cat.id
     ${whereClause}${periodoClause}
     GROUP BY cat.nome
     ORDER BY total DESC
     LIMIT 10`
  ).all();

  // Chamados por subcategoria (top 15)
  const chamadosPorSubcategoria = await c.env.DB.prepare(
    `SELECT 
       COALESCE(sub.nome, 'Sem subcategoria') as subcategoria,
       COALESCE(cat.nome, 'Sem categoria') as categoria,
       COUNT(*) as total
     FROM chamados c
     LEFT JOIN categorias sub ON c.subcategoria_id = sub.id
     LEFT JOIN categorias cat ON sub.categoria_pai_id = cat.id
     ${whereClause}${periodoClause}
     GROUP BY sub.nome, cat.nome
     ORDER BY total DESC
     LIMIT 15`
  ).all();

  // Chamados por setor solicitante (top 10)
  const chamadosPorSetorSolicitante = await c.env.DB.prepare(
    `SELECT 
       COALESCE(solicitante_setor, 'Não especificado') as setor_solicitante,
       COUNT(*) as total
     FROM chamados
     ${whereClause}${periodoClause}
     GROUP BY solicitante_setor
     ORDER BY total DESC
     LIMIT 10`
  ).all();

  const stats: DashboardStats = {
    total_chamados: total?.count || 0,
    chamados_abertos: abertos?.count || 0,
    chamados_novos: novos?.count || 0,
    chamados_em_triagem: emTriagem?.count || 0,
    chamados_atribuidos: atribuidos?.count || 0,
    chamados_em_atendimento: emAtendimento?.count || 0,
    chamados_pausados: pausados?.count || 0,
    chamados_agendados: agendados?.count || 0,
    chamados_aguardando: aguardando?.count || 0,
    chamados_resolvidos_mes: resolvidosPeriodo?.count || 0,
    satisfacao_media: satisfacao?.media || null,
    satisfacao_total_avaliacoes: satisfacao?.total || 0,
    nps_medio: nps?.media || null,
    nps_total_avaliacoes: nps?.total || 0,
    tempo_medio_resolucao: tempoResolucao?.media || null,
    violacoes_sla: violacoes?.count || 0,
    sla_resposta_percentual: slaRespostaPercentual,
    sla_resposta_dentro: slaRespostaDentro?.count || 0,
    sla_resposta_total: slaRespostaTotal?.count || 0,
    sla_resolucao_percentual: slaResolucaoPercentual,
    sla_resolucao_dentro: slaResolucaoDentro?.count || 0,
    sla_resolucao_total: slaResolucaoTotal?.count || 0,
    chamados_por_prioridade: {
      P1: porPrioridade?.P1 || 0,
      P2: porPrioridade?.P2 || 0,
      P3: porPrioridade?.P3 || 0,
      P4: porPrioridade?.P4 || 0,
    },
    chamados_por_status: {
      'Novo': porStatus?.Novo || 0,
      'Em triagem': porStatus?.EmTriagem || 0,
      'Em atendimento': porStatus?.EmAtendimento || 0,
      'Aguardando usuário': porStatus?.AguardandoUsuario || 0,
      'Aguardando fornecedor': porStatus?.AguardandoFornecedor || 0,
      'Resolvido': porStatus?.Resolvido || 0,
      'Fechado': porStatus?.Fechado || 0,
      'Cancelado': porStatus?.Cancelado || 0,
    },
    chamados_por_mes: (chamadosPorMes.results || []).map((row: any) => ({
      mes: row.mes as string,
      total: row.total as number,
      novos: row.novos as number,
      resolvidos: row.resolvidos as number
    })),
    chamados_por_tipo_problema: (chamadosPorTipoProblema.results || []).map((row: any) => ({
      tipo_problema: row.tipo_problema as string,
      total: row.total as number
    })),
    chamados_por_categoria: (chamadosPorCategoria.results || []).map((row: any) => ({
      categoria: row.categoria as string,
      total: row.total as number
    })),
    chamados_por_subcategoria: (chamadosPorSubcategoria.results || []).map((row: any) => ({
      subcategoria: row.subcategoria as string,
      categoria: row.categoria as string,
      total: row.total as number
    })),
    chamados_por_setor_solicitante: (chamadosPorSetorSolicitante.results || []).map((row: any) => ({
      setor_solicitante: row.setor_solicitante as string,
      total: row.total as number
    }))
  };

  return c.json(stats);
});

export default router;
