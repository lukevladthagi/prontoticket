import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const app = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

app.get("/verificar", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  // Buscar o setor do usuário
  const userProfile = await c.env.DB.prepare(
    `SELECT setor_id FROM user_profiles WHERE user_id = ?`
  ).bind(user.id).first<{ setor_id: number }>();

  const setorId = userProfile?.setor_id || 1;

  // Buscar nome do setor
  const setor = await c.env.DB.prepare(
    `SELECT nome FROM setores WHERE id = ?`
  ).bind(setorId).first<{ nome: string }>();

  // Início do mês atual
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const inicioMesISO = inicioMes.toISOString();

  // Query 1: Total de tickets
  const totalQuery = `SELECT COUNT(*) as count FROM chamados WHERE setor_destino_id = ? AND data_abertura >= ?`;
  const total = await c.env.DB.prepare(totalQuery).bind(setorId, inicioMesISO).first<{ count: number }>();

  // Query 2: Chamados abertos (NOT Fechado/Resolvido)
  const abertosQuery = `SELECT COUNT(*) as count FROM chamados WHERE setor_destino_id = ? AND data_abertura >= ? AND status NOT IN ('Fechado', 'Resolvido')`;
  const abertos = await c.env.DB.prepare(abertosQuery).bind(setorId, inicioMesISO).first<{ count: number }>();

  // Query 3: Em atendimento
  const emAtendimentoQuery = `SELECT COUNT(*) as count FROM chamados WHERE setor_destino_id = ? AND data_abertura >= ? AND status = 'Em atendimento'`;
  const emAtendimento = await c.env.DB.prepare(emAtendimentoQuery).bind(setorId, inicioMesISO).first<{ count: number }>();

  // Query 4: Resolvidos (Fechado + Resolvido)
  const resolvidosQuery = `SELECT COUNT(*) as count FROM chamados WHERE setor_destino_id = ? AND data_abertura >= ? AND status IN ('Resolvido', 'Fechado')`;
  const resolvidos = await c.env.DB.prepare(resolvidosQuery).bind(setorId, inicioMesISO).first<{ count: number }>();

  // Query 5: SLA Resposta (TOTAL: todos os tickets com prazo_resposta, dentro: respondidos no prazo OU ainda no prazo)
  const slaRespostaQueryText = `
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN (data_primeira_resposta IS NOT NULL AND data_primeira_resposta <= prazo_resposta) OR (data_primeira_resposta IS NULL AND CURRENT_TIMESTAMP <= prazo_resposta) THEN 1 END) as dentro_sla
    FROM chamados 
    WHERE setor_destino_id = ? 
      AND data_abertura >= ?
      AND prazo_resposta IS NOT NULL`;
  const slaResposta = await c.env.DB.prepare(slaRespostaQueryText).bind(setorId, inicioMesISO).first<{ total: number; dentro_sla: number }>();

  // Query 6: SLA Resolução (TOTAL: todos os tickets com prazo_solucao, dentro: resolvidos no prazo OU ainda no prazo)
  const slaResolucaoQueryText = `
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN (data_resolucao IS NOT NULL AND data_resolucao <= prazo_solucao) OR (data_resolucao IS NULL AND CURRENT_TIMESTAMP <= prazo_solucao) THEN 1 END) as dentro_sla
    FROM chamados 
    WHERE setor_destino_id = ? 
      AND data_abertura >= ?
      AND prazo_solucao IS NOT NULL`;
  const slaResolucao = await c.env.DB.prepare(slaResolucaoQueryText).bind(setorId, inicioMesISO).first<{ total: number; dentro_sla: number }>();

  // Listar alguns tickets abertos para debug
  const ticketsAbertos = await c.env.DB.prepare(`
    SELECT numero, status, data_abertura 
    FROM chamados 
    WHERE setor_destino_id = ? 
      AND data_abertura >= ?
      AND status NOT IN ('Fechado', 'Resolvido')
    ORDER BY numero DESC
    LIMIT 50
  `).bind(setorId, inicioMesISO).all();

  // Listar tickets em atendimento
  const ticketsEmAtendimento = await c.env.DB.prepare(`
    SELECT numero, status, data_abertura 
    FROM chamados 
    WHERE setor_destino_id = ? 
      AND data_abertura >= ?
      AND status = 'Em atendimento'
    ORDER BY numero DESC
    LIMIT 50
  `).bind(setorId, inicioMesISO).all();

  const slaRespostaPerc = slaResposta && slaResposta.total > 0 
    ? ((slaResposta.dentro_sla / slaResposta.total) * 100).toFixed(1)
    : '0.0';

  const slaResolucaoPerc = slaResolucao && slaResolucao.total > 0 
    ? ((slaResolucao.dentro_sla / slaResolucao.total) * 100).toFixed(1)
    : '0.0';

  return c.json({
    setor_id: setorId,
    setor_nome: setor?.nome || 'Desconhecido',
    inicio_mes_filtro: inicioMesISO,
    valores_encontrados: {
      total: total?.count || 0,
      abertos: abertos?.count || 0,
      em_atendimento: emAtendimento?.count || 0,
      resolvidos: resolvidos?.count || 0,
      sla_resposta: `${slaRespostaPerc}% (${slaResposta?.dentro_sla || 0}/${slaResposta?.total || 0})`,
      sla_resolucao: `${slaResolucaoPerc}% (${slaResolucao?.dentro_sla || 0}/${slaResolucao?.total || 0})`
    },
    queries_executadas: {
      total: totalQuery + ` [setorId=${setorId}, inicioMes=${inicioMesISO}]`,
      abertos: abertosQuery + ` [setorId=${setorId}, inicioMes=${inicioMesISO}]`,
      em_atendimento: emAtendimentoQuery + ` [setorId=${setorId}, inicioMes=${inicioMesISO}]`,
      resolvidos: resolvidosQuery + ` [setorId=${setorId}, inicioMes=${inicioMesISO}]`,
      sla_resposta: slaRespostaQueryText + ` [setorId=${setorId}, inicioMes=${inicioMesISO}]`,
      sla_resolucao: slaResolucaoQueryText + ` [setorId=${setorId}, inicioMes=${inicioMesISO}]`
    },
    tickets_abertos_lista: ticketsAbertos.results || [],
    tickets_em_atendimento_lista: ticketsEmAtendimento.results || []
  });
});

export default app;
