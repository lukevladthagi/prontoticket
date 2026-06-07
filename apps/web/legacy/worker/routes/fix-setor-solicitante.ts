import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Corrigir chamados sem setor_solicitante
router.post("/corrigir", authMiddleware, async (c) => {
  const user = c.get("user")!;

  // Verificar se é admin
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil !== "admin") {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    // Buscar todos os chamados que precisam de correção
    const chamadosSemSetor = await c.env.DB.prepare(
      `SELECT c.id, c.numero, c.solicitante_id, up.setor_id
       FROM chamados c
       LEFT JOIN user_profiles up ON c.solicitante_id = up.user_id
       WHERE (c.solicitante_setor IS NULL OR c.solicitante_setor = 'null')
       AND up.setor_id IS NOT NULL`
    ).all<{ id: number; numero: string; solicitante_id: string; setor_id: number }>();

    if (!chamadosSemSetor.results || chamadosSemSetor.results.length === 0) {
      return c.json({ 
        message: "Nenhum chamado precisa de correção",
        corrigidos: 0 
      });
    }

    let corrigidos = 0;
    const erros: string[] = [];

    // Processar cada chamado
    for (const chamado of chamadosSemSetor.results) {
      try {
        // Buscar nome do setor
        const setorInfo = await c.env.DB.prepare(
          "SELECT nome FROM setores WHERE id = ?"
        ).bind(chamado.setor_id).first<{ nome: string }>();

        if (setorInfo) {
          // Atualizar chamado com nome do setor
          await c.env.DB.prepare(
            "UPDATE chamados SET solicitante_setor = ? WHERE id = ?"
          ).bind(setorInfo.nome, chamado.id).run();

          corrigidos++;
        }
      } catch (error: any) {
        erros.push(`${chamado.numero}: ${error.message}`);
      }
    }

    return c.json({
      message: `Correção concluída. ${corrigidos} chamados atualizados.`,
      corrigidos,
      total_encontrados: chamadosSemSetor.results.length,
      erros: erros.length > 0 ? erros : undefined
    });
  } catch (error: any) {
    console.error("Erro ao corrigir setor solicitante:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Diagnóstico
router.get("/diagnostico", authMiddleware, async (c) => {
  const user = c.get("user")!;

  // Verificar se é admin
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || profile.perfil !== "admin") {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    // Total de chamados
    const totalChamados = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM chamados"
    ).first<{ total: number }>();

    // Chamados com setor_solicitante preenchido
    const comSetor = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados 
       WHERE solicitante_setor IS NOT NULL 
       AND solicitante_setor != 'null'`
    ).first<{ total: number }>();

    // Chamados sem setor_solicitante mas com user_profile.setor_id
    const semSetorMasComPerfil = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM chamados c
       LEFT JOIN user_profiles up ON c.solicitante_id = up.user_id
       WHERE (c.solicitante_setor IS NULL OR c.solicitante_setor = 'null')
       AND up.setor_id IS NOT NULL`
    ).first<{ total: number }>();

    // Distribuição por setor
    const distribuicao = await c.env.DB.prepare(
      `SELECT 
         COALESCE(solicitante_setor, 'Não especificado') as setor,
         COUNT(*) as total
       FROM chamados
       GROUP BY solicitante_setor
       ORDER BY total DESC`
    ).all<{ setor: string; total: number }>();

    return c.json({
      total_chamados: totalChamados?.total || 0,
      com_setor_preenchido: comSetor?.total || 0,
      sem_setor_mas_corrigivel: semSetorMasComPerfil?.total || 0,
      distribuicao: distribuicao.results || []
    });
  } catch (error: any) {
    console.error("Erro ao gerar diagnóstico:", error);
    return c.json({ error: error.message }, 500);
  }
});

export default router;
