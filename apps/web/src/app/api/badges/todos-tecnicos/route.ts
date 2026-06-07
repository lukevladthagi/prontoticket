import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { normalizeRanking } from "@/app/api/gamificacao/_helpers";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const rankingRows = await sql`
    select * from gamificacao_ranking
    order by mes_atual desc, total_pontos desc, user_nome asc
  `;
  const badgeRows = await sql`
    select ub.user_id, b.*, ub.data_conquista
    from user_badges ub
    join badges b on b.id = ub.badge_id
    order by ub.data_conquista desc
  `;

  const badgesByUser = new Map<string, any[]>();
  for (const row of badgeRows as any[]) {
    const list = badgesByUser.get(row.user_id) || [];
    list.push({
      id: Number(row.id),
      nome: row.nome,
      descricao: row.descricao,
      icone: row.icone,
      data_conquista: row.data_conquista,
    });
    badgesByUser.set(row.user_id, list);
  }

  return Response.json(rankingRows.map((row: any) => ({
    ...normalizeRanking(row),
    badges: badgesByUser.get(row.user_id) || [],
  })));
}
