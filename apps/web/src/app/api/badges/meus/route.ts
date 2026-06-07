import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const rows = await sql`
    select b.*, ub.data_conquista
    from user_badges ub
    join badges b on b.id = ub.badge_id
    where ub.user_id = ${user.id}
    order by ub.data_conquista desc
  `;
  return Response.json(rows);
}
