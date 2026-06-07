import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { normalizeChamado } from "@/app/api/_helpers/normalize";

const STATUS = [
  "Novo",
  "Em triagem",
  "Em atendimento",
  "Aguardando usuário",
  "Aguardando fornecedor",
  "Resolvido",
  "Fechado",
  "Cancelado",
];

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function insideRange(row: any, start: Date | null, end: Date | null) {
  const date = parseDate(row.data_abertura || row.created_at);
  if (!date) return false;
  if (start && date < start) return false;
  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (date > endOfDay) return false;
  }
  return true;
}

function increment(map: Record<string, number>, key: string | null | undefined) {
  const cleanKey = key?.trim() || "Nao informado";
  map[cleanKey] = (map[cleanKey] || 0) + 1;
}

function topEntries(map: Record<string, number>, keyName: string, limit = 10) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, total]) => ({ [keyName]: key, total }));
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const setorId = searchParams.get("setor_id");
  const periodo = searchParams.get("periodo") || "mes";
  const dataInicio = searchParams.get("data_inicio");
  const dataFim = searchParams.get("data_fim");

  let start: Date | null = dataInicio ? new Date(`${dataInicio}T00:00:00`) : null;
  let end: Date | null = dataFim ? new Date(`${dataFim}T00:00:00`) : null;

  if (!dataInicio && !dataFim && periodo === "mes") {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  const [chamadosRows, categoriasRows] = await Promise.all([
    sql`select * from chamados`,
    sql`select id, nome, categoria_pai_id, tipo from categorias`,
  ]);

  const categorias = new Map(categoriasRows.map((row: any) => [Number(row.id), row]));
  const chamados = chamadosRows
    .map(normalizeChamado)
    .filter((row) => (!setorId || Number(row.setor_destino_id) === Number(setorId)))
    .filter((row) => (!start && !end) || insideRange(row, start, end));

  const chamadosPorStatus = Object.fromEntries(STATUS.map((status) => [status, 0])) as Record<string, number>;
  const chamadosPorPrioridade = { P1: 0, P2: 0, P3: 0, P4: 0 };
  const porMes = new Map<string, { mes: string; total: number; novos: number; resolvidos: number }>();
  const porTipoProblema: Record<string, number> = {};
  const porCategoria: Record<string, number> = {};
  const porSubcategoria: Record<string, number> = {};
  const porSetorSolicitante: Record<string, number> = {};

  let slaRespostaTotal = 0;
  let slaRespostaDentro = 0;
  let slaResolucaoTotal = 0;
  let slaResolucaoDentro = 0;
  let satisfacaoTotal = 0;
  let satisfacaoSoma = 0;
  let npsTotal = 0;
  let npsSoma = 0;
  let tempoResolucaoTotal = 0;
  let tempoResolucaoCount = 0;

  for (const chamado of chamados) {
    chamadosPorStatus[chamado.status] = (chamadosPorStatus[chamado.status] || 0) + 1;
    if (chamado.prioridade && chamado.prioridade in chamadosPorPrioridade) {
      chamadosPorPrioridade[chamado.prioridade as keyof typeof chamadosPorPrioridade] += 1;
    }

    const abertura = parseDate(chamado.data_abertura || chamado.created_at);
    if (abertura) {
      const mes = `${abertura.getFullYear()}-${String(abertura.getMonth() + 1).padStart(2, "0")}`;
      const item = porMes.get(mes) || { mes, total: 0, novos: 0, resolvidos: 0 };
      item.total += 1;
      if (chamado.status === "Novo") item.novos += 1;
      if (chamado.status === "Resolvido" || chamado.status === "Fechado") item.resolvidos += 1;
      porMes.set(mes, item);
    }

    increment(porTipoProblema, chamado.tipo_problema);
    increment(porSetorSolicitante, chamado.solicitante_setor);

    const categoria = chamado.categoria_id ? categorias.get(Number(chamado.categoria_id)) : null;
    const subcategoria = chamado.subcategoria_id ? categorias.get(Number(chamado.subcategoria_id)) : null;
    increment(porCategoria, categoria?.nome);
    if (subcategoria?.nome) increment(porSubcategoria, `${subcategoria.nome}|||${categoria?.nome || "Sem categoria"}`);

    if (chamado.prazo_resposta && chamado.data_primeira_resposta) {
      slaRespostaTotal += 1;
      const prazo = parseDate(chamado.prazo_resposta);
      const primeiraResposta = parseDate(chamado.data_primeira_resposta);
      if (prazo && primeiraResposta && primeiraResposta <= prazo) slaRespostaDentro += 1;
    }

    if (chamado.prazo_solucao && (chamado.data_resolucao || chamado.data_fechamento)) {
      slaResolucaoTotal += 1;
      const prazo = parseDate(chamado.prazo_solucao);
      const conclusao = parseDate(chamado.data_resolucao || chamado.data_fechamento);
      if (prazo && conclusao && conclusao <= prazo) slaResolucaoDentro += 1;
    }

    if (typeof chamado.avaliacao_nota === "number") {
      satisfacaoTotal += 1;
      satisfacaoSoma += chamado.avaliacao_nota;
    }
    if (typeof chamado.avaliacao_nps === "number") {
      npsTotal += 1;
      npsSoma += chamado.avaliacao_nps;
    }

    const resolucao = parseDate(chamado.data_resolucao || chamado.data_fechamento);
    if (abertura && resolucao) {
      tempoResolucaoCount += 1;
      tempoResolucaoTotal += Math.max(0, resolucao.getTime() - abertura.getTime()) / 60000;
    }
  }

  const abertos = chamados.filter((c) => !["Resolvido", "Fechado", "Cancelado"].includes(c.status)).length;

  const chamadosPorSubcategoria = Object.entries(porSubcategoria)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([key, total]) => {
      const [subcategoria, categoria] = key.split("|||");
      return { subcategoria, categoria, total };
    });

  return Response.json({
    total_chamados: chamados.length,
    chamados_abertos: abertos,
    chamados_novos: chamadosPorStatus["Novo"] || 0,
    chamados_em_triagem: chamadosPorStatus["Em triagem"] || 0,
    chamados_atribuidos: chamados.filter((c) => c.tecnico_responsavel_id && !["Resolvido", "Fechado", "Cancelado"].includes(c.status)).length,
    chamados_em_atendimento: chamadosPorStatus["Em atendimento"] || 0,
    chamados_pausados: (chamadosPorStatus["Aguardando usuário"] || 0) + (chamadosPorStatus["Aguardando fornecedor"] || 0),
    chamados_agendados: chamados.filter((c) => c.agendado).length,
    chamados_aguardando: (chamadosPorStatus["Aguardando usuário"] || 0) + (chamadosPorStatus["Aguardando fornecedor"] || 0),
    chamados_resolvidos_mes: (chamadosPorStatus["Resolvido"] || 0) + (chamadosPorStatus["Fechado"] || 0),
    satisfacao_media: satisfacaoTotal ? Number((satisfacaoSoma / satisfacaoTotal).toFixed(1)) : null,
    satisfacao_total_avaliacoes: satisfacaoTotal,
    nps_medio: npsTotal ? Number((npsSoma / npsTotal).toFixed(1)) : null,
    nps_total_avaliacoes: npsTotal,
    tempo_medio_resolucao: tempoResolucaoCount ? Math.round(tempoResolucaoTotal / tempoResolucaoCount) : null,
    violacoes_sla: chamados.filter((c) => c.violacao_sla).length,
    sla_resposta_percentual: slaRespostaTotal ? Number(((slaRespostaDentro / slaRespostaTotal) * 100).toFixed(1)) : null,
    sla_resposta_dentro: slaRespostaDentro,
    sla_resposta_total: slaRespostaTotal,
    sla_resolucao_percentual: slaResolucaoTotal ? Number(((slaResolucaoDentro / slaResolucaoTotal) * 100).toFixed(1)) : null,
    sla_resolucao_dentro: slaResolucaoDentro,
    sla_resolucao_total: slaResolucaoTotal,
    chamados_por_prioridade: chamadosPorPrioridade,
    chamados_por_status: chamadosPorStatus,
    chamados_por_mes: Array.from(porMes.values()).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12),
    chamados_por_tipo_problema: topEntries(porTipoProblema, "tipo_problema"),
    chamados_por_categoria: topEntries(porCategoria, "categoria"),
    chamados_por_subcategoria: chamadosPorSubcategoria,
    chamados_por_setor_solicitante: topEntries(porSetorSolicitante, "setor_solicitante", 20),
  });
}
