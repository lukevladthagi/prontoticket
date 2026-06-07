import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  solicitante: {
    chamados_criar: true,
    chamados_visualizar_proprios: true,
  },
  tecnico: {
    chamados_criar: true,
    chamados_visualizar_todos: true,
  },
  gestor: {
    chamados_criar: true,
    chamados_visualizar_todos: true,
    configuracoes: true,
  },
  admin: {},
};

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const profileRows = await sql`
    SELECT perfil
    FROM user_profiles
    WHERE user_id = ${user.id}
    LIMIT 1
  `;

  const perfil = profileRows[0]?.perfil || "solicitante";
  const permissions = { ...(DEFAULT_PERMISSIONS[perfil] || DEFAULT_PERMISSIONS.solicitante) };

  if (perfil === "admin") {
    return Response.json({ perfil, permissions: { "*": true } });
  }

  try {
    const rows = await sql`
      SELECT f.codigo, p.permitido
      FROM permissoes p
      JOIN funcionalidades f ON f.id = p.funcionalidade_id
      WHERE p.perfil = ${perfil}
        AND COALESCE(f.ativo, 1) = 1
    `;

    for (const row of rows) {
      permissions[row.codigo] = row.permitido === true || row.permitido === 1;
    }
  } catch (error) {
    console.warn("Permissões dinâmicas indisponíveis; usando permissões padrão.", error);
  }

  return Response.json({ perfil, permissions });
}
