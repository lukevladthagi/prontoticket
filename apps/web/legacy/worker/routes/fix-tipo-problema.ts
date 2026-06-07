import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";

const router = new Hono<{
  Bindings: Env;
}>();

// Corrigir tipo_problema dos chamados existentes
// Remove a parte " (ex:...)" deixando apenas o tipo base
router.post("/corrigir", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Apenas admins podem executar
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (profile?.perfil !== 'admin') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    // Buscar todos os chamados com tipo_problema não nulo
    const chamados = await c.env.DB.prepare(
      "SELECT id, tipo_problema FROM chamados WHERE tipo_problema IS NOT NULL"
    ).all<{ id: number; tipo_problema: string }>();

    let corrigidos = 0;

    for (const chamado of chamados.results) {
      // Extrair apenas o tipo base (antes do " (ex:")
      const tipoBase = chamado.tipo_problema.split(' (ex:')[0].trim();
      
      // Atualizar apenas se for diferente
      if (tipoBase !== chamado.tipo_problema) {
        await c.env.DB.prepare(
          "UPDATE chamados SET tipo_problema = ? WHERE id = ?"
        ).bind(tipoBase, chamado.id).run();
        
        corrigidos++;
      }
    }

    return c.json({
      success: true,
      total: chamados.results.length,
      corrigidos,
      mensagem: `${corrigidos} chamados foram corrigidos de ${chamados.results.length} analisados`
    });
  } catch (error) {
    console.error("Erro ao corrigir tipo_problema:", error);
    return c.json({ error: "Erro ao corrigir dados" }, 500);
  }
});

export default router;
