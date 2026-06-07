import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const rows = await sql`select * from badges order by id`;
  return Response.json(rows);
}
