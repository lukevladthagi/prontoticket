import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { normalizeUserProfile } from "@/app/api/_helpers/normalize";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const perfil = searchParams.get("perfil");

  const rows = perfil
    ? await sql`
        select up.*, u.nome as unidade_nome, s.nome as setor_nome
        from user_profiles up
        left join unidades u on u.id = up.unidade_id
        left join setores s on s.id = up.setor_id
        where up.perfil = ${perfil}
        order by up.nome nulls last, up.email
      `
    : await sql`
        select up.*, u.nome as unidade_nome, s.nome as setor_nome
        from user_profiles up
        left join unidades u on u.id = up.unidade_id
        left join setores s on s.id = up.setor_id
        order by up.nome nulls last, up.email
      `;

  return Response.json(rows.map(normalizeUserProfile));
}
