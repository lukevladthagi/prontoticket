import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const app = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Get permissions for current user
app.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userId = user.id;

  try {
    // Get user profile
    const profile = await c.env.DB.prepare(`
      SELECT perfil, setor_id FROM user_profiles WHERE user_id = ?
    `).bind(userId).first();

    if (!profile) {
      return c.json({ error: "User profile not found" }, 404);
    }

    const { perfil, setor_id } = profile as { perfil: string; setor_id: number | null };

    // Get base permissions for this profile
    const basePermissions = await c.env.DB.prepare(`
      SELECT f.codigo, p.permitido
      FROM permissoes p
      JOIN funcionalidades f ON p.funcionalidade_id = f.id
      WHERE p.perfil = ?
      ORDER BY f.ordem
    `).bind(perfil).all();

    const permissions: Record<string, boolean> = {};
    
    for (const perm of basePermissions.results as any[]) {
      permissions[perm.codigo] = perm.permitido === 1;
    }

    // Special logic for non-TI technicians (Manutenção, Marketing, Comercial)
    // They only get: dashboard, tickets (criar, visualizar, atender), base_conhecimento
    if (perfil === 'tecnico' && setor_id && setor_id !== 1) {
      const allowedForNonTI = [
        'chamados_criar',
        'chamados_visualizar_todos', 
        'chamados_atender',
        'base_conhecimento'
      ];
      
      // Disable all permissions except the allowed ones
      for (const key of Object.keys(permissions)) {
        if (!allowedForNonTI.includes(key)) {
          permissions[key] = false;
        }
      }
    }

    // Enable chamados_recorrentes for TI technicians specifically
    if (perfil === 'tecnico' && setor_id === 1) {
      permissions['chamados_recorrentes'] = true;
    }

    return c.json({ permissions });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get all funcionalidades (for management UI)
app.get("/funcionalidades", async (c) => {
  try {
    const funcionalidades = await c.env.DB.prepare(`
      SELECT * FROM funcionalidades WHERE ativo = 1 ORDER BY categoria, ordem
    `).all();

    return c.json({ funcionalidades: funcionalidades.results });
  } catch (error) {
    console.error("Error fetching funcionalidades:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get all permissions grouped by category (for management UI)
app.get("/", async (c) => {
  try {
    const funcionalidades = await c.env.DB.prepare(`
      SELECT 
        f.id,
        f.codigo,
        f.nome,
        f.descricao,
        f.categoria,
        f.ordem
      FROM funcionalidades f
      WHERE f.ativo = 1
      ORDER BY f.categoria, f.ordem
    `).all();

    const permissoes = await c.env.DB.prepare(`
      SELECT 
        p.id,
        p.funcionalidade_id,
        p.perfil,
        p.permitido
      FROM permissoes p
    `).all();

    // Group funcionalidades by category with their permissions
    const categorias: Record<string, any[]> = {};
    
    for (const func of funcionalidades.results as any[]) {
      if (!categorias[func.categoria]) {
        categorias[func.categoria] = [];
      }

      const funcPermissoes = (permissoes.results as any[])
        .filter((p: any) => p.funcionalidade_id === func.id)
        .map((p: any) => ({
          id: p.id,
          perfil: p.perfil,
          permitido: p.permitido === 1
        }));

      categorias[func.categoria].push({
        ...func,
        permissoes: funcPermissoes
      });
    }

    return c.json({ categorias });
  } catch (error) {
    console.error("Error fetching permissoes:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Update a permission by funcionalidade_id and perfil
app.put("/:funcionalidadeId/:perfil", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userId = user.id;

  // Check if user is admin or gestor
  const userProfile = await c.env.DB.prepare(`
    SELECT perfil FROM user_profiles WHERE user_id = ?
  `).bind(userId).first();

  if (!userProfile || !['admin', 'gestor'].includes((userProfile as any).perfil)) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const funcionalidadeId = c.req.param("funcionalidadeId");
  const perfil = c.req.param("perfil");
  const { permitido } = await c.req.json();

  try {
    await c.env.DB.prepare(`
      UPDATE permissoes 
      SET permitido = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE funcionalidade_id = ? AND perfil = ?
    `).bind(permitido ? 1 : 0, funcionalidadeId, perfil).run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating permission:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;
