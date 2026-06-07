import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { normalizeRanking } from "@/app/api/gamificacao/_helpers";

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { userId } = await params;
  const rows = await sql`
    select * from gamificacao_ranking
    where user_id = ${userId}
    limit 1
  `;

  if (rows[0]) return Response.json(normalizeRanking(rows[0]));

  return Response.json({
    user_id: userId,
    user_nome: userId,
    total_pontos: 0,
    mes_atual: 0,
    pontos_periodo: 0,
    nivel: 1,
  });
}
