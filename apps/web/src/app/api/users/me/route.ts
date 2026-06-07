import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

// GET /api/users/me
// Returns the current user and lazily creates/links the matching user_profiles
// row, mirroring the original Mocha handler. D1 -> Postgres (Neon); Mocha auth
// -> better-auth. `google_user_data` is no longer available, so the display
// name falls back to the better-auth user's `name` then the email local-part.
export async function GET(req: Request) {
  const user = await getSessionUser(req);

  if (!user) {
    return unauthorized();
  }

  try {
    const nome =
      (typeof user.name === "string" && user.name) ||
      user.email.split("@")[0];

    const existingProfile =
      await sql`SELECT id FROM user_profiles WHERE user_id = ${user.id}`;

    if (existingProfile.length === 0) {
      // Existing profile created via Telegram/WhatsApp (no user_id yet)?
      const profileByEmail =
        await sql`SELECT id, perfil FROM user_profiles WHERE email = ${user.email} AND user_id IS NULL`;

      if (profileByEmail.length > 0) {
        await sql`
          UPDATE user_profiles
          SET user_id = ${user.id},
              nome = ${nome},
              updated_at = (CURRENT_TIMESTAMP)::text
          WHERE id = ${profileByEmail[0].id}
        `;
      } else {
        await sql`
          INSERT INTO user_profiles (user_id, email, nome, perfil, ativo)
          VALUES (${user.id}, ${user.email}, ${nome}, 'solicitante', 1)
        `;
      }
    }
  } catch (error) {
    console.error("Erro ao criar perfil do usuário:", error);
  }

  return Response.json(user);
}
