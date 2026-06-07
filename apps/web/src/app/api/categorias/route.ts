import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { asNullableNumber, normalizeCategoria } from "@/app/api/_helpers/normalize";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const setorId = searchParams.get("setor_id");

  const rows = setorId
    ? await sql`
        select * from categorias
        where tipo = 'categoria'
          and ativo = 1
          and (setor_id = ${Number(setorId)} or setor_id is null)
        order by nome
      `
    : await sql`
        select * from categorias
        where tipo = 'categoria' and ativo = 1
        order by nome
      `;

  return Response.json(rows.map(normalizeCategoria));
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const body = await req.json();
  const now = new Date().toISOString();
  const rows = await sql`
    insert into categorias (
      nome, descricao, categoria_pai_id, tipo, ativo, setor_id, tipo_problema,
      prioridade_automatica, created_at, updated_at
    )
    values (
      ${body.nome},
      ${body.descricao ?? null},
      ${asNullableNumber(body.categoria_pai_id)},
      ${body.tipo ?? "categoria"},
      ${body.ativo === false ? 0 : 1},
      ${asNullableNumber(body.setor_id)},
      ${body.tipo_problema ?? null},
      ${body.prioridade_automatica ?? null},
      ${now},
      ${now}
    )
    returning *
  `;
  return Response.json(normalizeCategoria(rows[0]));
}
