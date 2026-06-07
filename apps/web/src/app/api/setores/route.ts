import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { normalizeSetor } from "@/app/api/_helpers/normalize";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const rows = await sql`select * from setores order by nome`;
  return Response.json(rows.map(normalizeSetor));
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const body = await req.json();
  const now = new Date().toISOString();
  const rows = await sql`
    insert into setores (nome, descricao, email, ramal, ativo, atende_ticket, atendimento_24x7, created_at, updated_at)
    values (
      ${body.nome},
      ${body.descricao ?? null},
      ${body.email ?? null},
      ${body.ramal ?? null},
      ${body.ativo === false ? 0 : 1},
      ${body.atende_ticket === false ? 0 : 1},
      ${body.atendimento_24x7 ? 1 : 0},
      ${now},
      ${now}
    )
    returning *
  `;
  return Response.json(normalizeSetor(rows[0]));
}
