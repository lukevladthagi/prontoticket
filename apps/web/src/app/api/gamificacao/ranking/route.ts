import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { normalizeRanking } from "@/app/api/gamificacao/_helpers";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const limite = Math.max(1, Math.min(100, Number(searchParams.get("limite") || "10")));

  const rows = await sql`
    select * from gamificacao_ranking
    order by mes_atual desc, total_pontos desc, user_nome asc
    limit ${limite}
  `;

  return Response.json(rows.map(normalizeRanking));
}
