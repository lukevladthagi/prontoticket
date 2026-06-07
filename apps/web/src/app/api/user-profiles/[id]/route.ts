import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { asNullableNumber, normalizeUserProfile } from "@/app/api/_helpers/normalize";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await req.json();
  const ativo = body.ativo === false ? 0 : 1;

  const rows = await sql`
    update user_profiles
    set
      nome = coalesce(${body.nome ?? null}, nome),
      perfil = coalesce(${body.perfil ?? null}, perfil),
      unidade_id = ${asNullableNumber(body.unidade_id)},
      setor_id = ${asNullableNumber(body.setor_id)},
      setor = coalesce(${body.setor ?? null}, setor),
      ativo = ${ativo},
      updated_at = ${new Date().toISOString()}
    where id = ${Number(id)}
    returning *
  `;

  if (!rows[0]) {
    return Response.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  return Response.json(normalizeUserProfile(rows[0]));
}
