import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { asNullableNumber, normalizeChamado } from "@/app/api/_helpers/normalize";

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesDateRange(chamado: any, inicio: string | null, fim: string | null) {
  if (!inicio && !fim) return true;
  const date = parseDate(chamado.data_abertura || chamado.created_at);
  if (!date) return false;
  if (inicio && date < new Date(`${inicio}T00:00:00`)) return false;
  if (fim) {
    const end = new Date(`${fim}T00:00:00`);
    end.setHours(23, 59, 59, 999);
    if (date > end) return false;
  }
  return true;
}

function applyView(chamado: any, view: string | null, user: any) {
  switch (view) {
    case "meus":
      return chamado.solicitante_id === user.id || chamado.tecnico_responsavel_id === user.id || chamado.solicitante_email === user.email;
    case "novos":
      return chamado.status === "Novo";
    case "atribuidos":
      return chamado.tecnico_responsavel_id && !["Resolvido", "Fechado", "Cancelado"].includes(chamado.status);
    case "pausados":
      return chamado.status === "Aguardando usuário" || chamado.status === "Aguardando fornecedor";
    case "em_atendimento":
      return chamado.status === "Em atendimento";
    case "resolvido":
      return chamado.status === "Resolvido";
    case "fechado":
      return chamado.status === "Fechado";
    default:
      return true;
  }
}

function nextNumero(maxNumero: string | null | undefined) {
  const match = maxNumero?.match(/TKT-(\d+)/);
  const current = match ? Number(match[1]) : 999000;
  return `TKT-${current + 1}`;
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view");
  const prioridade = searchParams.get("prioridade");
  const setorDestinoId = searchParams.get("setor_destino_id");
  const setorSolicitante = searchParams.get("setor_solicitante");
  const tipoProblema = searchParams.get("tipo_problema");
  const status = searchParams.get("status");
  const dataInicio = searchParams.get("data_inicio");
  const dataFim = searchParams.get("data_fim");
  const busca = searchParams.get("busca")?.toLowerCase().trim();
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(999, Math.max(1, Number(searchParams.get("limit") || "20")));

  const rows = await sql`
    select c.*, up.nome as tecnico_responsavel_nome
    from chamados c
    left join user_profiles up on up.user_id = c.tecnico_responsavel_id
    order by coalesce(c.data_abertura, c.created_at) desc, c.id desc
  `;

  const filtered = rows
    .map(normalizeChamado)
    .filter((c) => applyView(c, view, user))
    .filter((c) => !prioridade || c.prioridade === prioridade)
    .filter((c) => !status || c.status === status)
    .filter((c) => !setorDestinoId || Number(c.setor_destino_id) === Number(setorDestinoId))
    .filter((c) => !setorSolicitante || c.solicitante_setor === setorSolicitante)
    .filter((c) => !tipoProblema || c.tipo_problema === tipoProblema)
    .filter((c) => matchesDateRange(c, dataInicio, dataFim))
    .filter((c) => {
      if (!busca) return true;
      return [c.numero, c.titulo, c.descricao, c.solicitante_nome, c.solicitante_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(busca));
    });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const chamados = filtered.slice(start, start + limit);

  return Response.json({
    chamados,
    paginacao: {
      pagina_atual: page,
      total_paginas: Math.max(1, Math.ceil(total / limit)),
      total,
      limite: limit,
    },
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const body = await req.json();
  if (!body.titulo || !body.descricao) {
    return Response.json({ error: "Titulo e descricao sao obrigatorios" }, { status: 400 });
  }

  const profileRows = await sql`
    select up.*, s.nome as setor_nome
    from user_profiles up
    left join setores s on s.id = up.setor_id
    where up.user_id = ${user.id} or up.email = ${user.email || ""}
    order by case when up.user_id = ${user.id} then 0 else 1 end
    limit 1
  `;
  const profile = profileRows[0];
  const now = new Date().toISOString();
  const last = await sql`select numero from chamados where numero like 'TKT-%' order by numero desc limit 1`;
  const numero = nextNumero(last[0]?.numero);

  const rows = await sql`
    insert into chamados (
      numero, tipo, solicitante_id, solicitante_nome, solicitante_email,
      solicitante_telefone, solicitante_setor, unidade_id, categoria_id,
      subcategoria_id, item_id, titulo, descricao, impacto, urgencia,
      prioridade, status, ambiente, passos_reproduzir, data_abertura,
      created_at, updated_at, setor_destino_id, origem, agendado,
      afeta_paciente, tempo_pausado_minutos, tipo_problema, is_projeto,
      projeto_id, violacao_sla
    )
    values (
      ${numero},
      ${body.tipo || "Problema"},
      ${user.id},
      ${profile?.nome || user.name || user.email || "Usuario"},
      ${user.email || profile?.email || ""},
      ${profile?.telefone || null},
      ${body.setor_solicitante || profile?.setor_nome || profile?.setor || null},
      ${asNullableNumber(body.unidade_id ?? profile?.unidade_id)},
      ${asNullableNumber(body.categoria_id)},
      ${asNullableNumber(body.subcategoria_id)},
      ${asNullableNumber(body.item_id)},
      ${body.titulo},
      ${body.descricao},
      ${body.impacto ?? null},
      ${body.urgencia ?? null},
      ${body.prioridade ?? "P3"},
      ${body.status ?? "Novo"},
      ${body.ambiente ?? null},
      ${body.passos_reproduzir ?? null},
      ${now},
      ${now},
      ${now},
      ${asNullableNumber(body.setor_destino_id)},
      ${body.origem ?? "web"},
      ${body.agendado ? 1 : 0},
      ${body.afeta_paciente ? 1 : 0},
      ${0},
      ${body.tipo_problema ?? null},
      ${body.is_projeto ? 1 : 0},
      ${asNullableNumber(body.projeto_id)},
      ${0}
    )
    returning *
  `;

  return Response.json(normalizeChamado(rows[0]));
}
