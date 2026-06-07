import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { normalizeCategoria } from "@/app/api/_helpers/normalize";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const rows = await sql`
    select * from categorias
    where categoria_pai_id = ${Number(id)}
      and tipo = 'subcategoria'
      and ativo = 1
    order by nome
  `;
  return Response.json(rows.map(normalizeCategoria));
}
