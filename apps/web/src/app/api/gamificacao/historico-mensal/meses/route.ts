import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const rows = await sql`
    select distinct mes_ano from gamificacao_historico_mensal
    where mes_ano is not null
    order by mes_ano desc
  `;
  return Response.json(rows.map((row: any) => row.mes_ano));
}
