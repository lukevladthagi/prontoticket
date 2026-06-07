import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { normalizeSetor } from "@/app/api/_helpers/normalize";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const rows = await sql`select * from setores where id = ${Number(id)} limit 1`;
  if (!rows[0]) return Response.json({ error: "Setor nao encontrado" }, { status: 404 });
  return Response.json(normalizeSetor(rows[0]));
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await req.json();
  const rows = await sql`
    update setores
    set
      nome = coalesce(${body.nome ?? null}, nome),
      descricao = ${body.descricao ?? null},
      email = ${body.email ?? null},
      ramal = ${body.ramal ?? null},
      ativo = ${body.ativo === false ? 0 : 1},
      atende_ticket = ${body.atende_ticket === false ? 0 : 1},
      atendimento_24x7 = ${body.atendimento_24x7 ? 1 : 0},
      updated_at = ${new Date().toISOString()}
    where id = ${Number(id)}
    returning *
  `;
  if (!rows[0]) return Response.json({ error: "Setor nao encontrado" }, { status: 404 });
  return Response.json(normalizeSetor(rows[0]));
}
