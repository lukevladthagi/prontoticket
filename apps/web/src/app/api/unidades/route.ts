import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { normalizeUnidade } from "@/app/api/_helpers/normalize";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const rows = await sql`select * from unidades order by nome`;
  return Response.json(rows.map(normalizeUnidade));
}
