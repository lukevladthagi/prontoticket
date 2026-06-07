import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

const ADMIN_EMAILS = new Set(["lucas.marins@hospitalprontocardio.com.br"]);

function normalizeProfile(row: any) {
  if (!row) return null;
  return {
    ...row,
    ativo: row.ativo === true || row.ativo === 1,
  };
}

async function ensureUserProfile(user: { id: string; email: string; name?: string | null }) {
  const email = user.email.toLowerCase();
  const nome = user.name || user.email.split("@")[0];
  const desiredProfile = ADMIN_EMAILS.has(email) ? "admin" : "solicitante";

  const byUserId = await sql`
    SELECT * FROM user_profiles
    WHERE user_id = ${user.id}
    LIMIT 1
  `;

  if (byUserId.length > 0) {
    const current = byUserId[0];
    if (ADMIN_EMAILS.has(email) && current.perfil !== "admin") {
      const updated = await sql`
        UPDATE user_profiles
        SET perfil = 'admin',
            ativo = 1,
            updated_at = (CURRENT_TIMESTAMP)::text
        WHERE id = ${current.id}
        RETURNING *
      `;
      return normalizeProfile(updated[0]);
    }
    return normalizeProfile(current);
  }

  const byEmail = await sql`
    SELECT * FROM user_profiles
    WHERE lower(email) = lower(${user.email})
    LIMIT 1
  `;

  if (byEmail.length > 0) {
    const updated = await sql`
      UPDATE user_profiles
      SET user_id = ${user.id},
          nome = ${nome},
          perfil = ${desiredProfile},
          ativo = 1,
          updated_at = (CURRENT_TIMESTAMP)::text
      WHERE id = ${byEmail[0].id}
      RETURNING *
    `;
    return normalizeProfile(updated[0]);
  }

  const inserted = await sql`
    INSERT INTO user_profiles (user_id, email, nome, perfil, ativo)
    VALUES (${user.id}, ${user.email}, ${nome}, ${desiredProfile}, 1)
    RETURNING *
  `;

  return normalizeProfile(inserted[0]);
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const profile = await ensureUserProfile(user);
  return Response.json(profile);
}

export async function PUT(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const current = await ensureUserProfile(user);

  const updated = await sql`
    UPDATE user_profiles
    SET nome = ${body.nome ?? current.nome},
        telefone = ${body.telefone ?? current.telefone},
        setor = ${body.setor ?? current.setor},
        setor_id = ${body.setor_id ?? current.setor_id},
        unidade_id = ${body.unidade_id ?? current.unidade_id},
        updated_at = (CURRENT_TIMESTAMP)::text
    WHERE id = ${current.id}
    RETURNING *
  `;

  return Response.json(normalizeProfile(updated[0]));
}
