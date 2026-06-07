import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || "10")));

  const rows = await sql`
    select gp.*, c.numero as chamado_numero, c.titulo as chamado_titulo
    from gamificacao_pontos gp
    left join chamados c on c.id = gp.chamado_id
    where gp.user_id = ${userId}
    order by gp.created_at desc
    limit ${limit}
  `;

  return Response.json(rows.map((row: any) => ({
    ...row,
    pontos: Number(row.pontos || 0),
  })));
}
