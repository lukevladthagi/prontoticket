import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import { calcularPrazoSLA } from "../utils/sla-calculator";
import { getDataHoraBrasil } from "../utils/timezone";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Endpoint para corrigir SLAs de tickets existentes (versão completa com priorização de categorias)
router.post("/corrigir", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se é admin ou gestor
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'Gestor')) {
    return c.json({ error: "Acesso negado. Apenas administradores e gestores podem executar esta ação." }, 403);
  }

  try {
    // Buscar todos os chamados sem SLA configurado
    const { results: chamados } = await c.env.DB.prepare(
      `SELECT id, numero, tipo, prioridade, setor_destino_id, data_abertura,
              categoria_id, subcategoria_id, item_id
       FROM chamados 
       WHERE sla_id IS NULL OR prazo_solucao IS NULL`
    ).all<any>();

    let analisados = 0;
    let corrigidos = 0;
    let semSla = 0;
    const detalhes: string[] = [];

    for (const chamado of chamados) {
      analisados++;
      
      try {
        let sla = null;

        // 1. Tentar buscar SLA pelo item_id (usando categoria_id = item_id)
        if (chamado.item_id) {
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE categoria_id = ? 
             AND ativo = TRUE 
             LIMIT 1`
          ).bind(chamado.item_id).first<any>();
        }

        // 2. Se não encontrou, tentar pela subcategoria_id (usando categoria_id = subcategoria_id)
        if (!sla && chamado.subcategoria_id) {
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE categoria_id = ? 
             AND ativo = TRUE 
             LIMIT 1`
          ).bind(chamado.subcategoria_id).first<any>();
        }

        // 3. Se não encontrou, tentar pela categoria_id
        if (!sla && chamado.categoria_id) {
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE categoria_id = ? 
             AND ativo = TRUE 
             LIMIT 1`
          ).bind(chamado.categoria_id).first<any>();
        }

        // 4. Se não encontrou, buscar SLA genérico por tipo + prioridade + setor
        if (!sla) {
          sla = await c.env.DB.prepare(
            `SELECT * FROM slas 
             WHERE tipo_chamado = ? 
             AND prioridade = ? 
             AND (setor_id = ? OR setor_id IS NULL)
             AND ativo = TRUE 
             ORDER BY setor_id DESC
             LIMIT 1`
          ).bind(chamado.tipo, chamado.prioridade, chamado.setor_destino_id).first<any>();
        }

        if (sla) {
          const dataAbertura = new Date(chamado.data_abertura);
          
          // Apenas calcular prazo de resposta se o SLA tiver tempo_resposta_minutos > 0
          const prazoResposta = (sla.tempo_resposta_minutos > 0)
            ? (await calcularPrazoSLA(c.env.DB, chamado.setor_destino_id, dataAbertura, sla.tempo_resposta_minutos)).toISOString()
            : null;
          
          const prazoSolucao = (await calcularPrazoSLA(c.env.DB, chamado.setor_destino_id, dataAbertura, sla.tempo_solucao_minutos)).toISOString();

          // Atualizar o chamado
          await c.env.DB.prepare(
            `UPDATE chamados 
             SET sla_id = ?, prazo_resposta = ?, prazo_solucao = ?, updated_at = ?
             WHERE id = ?`
          ).bind(sla.id, prazoResposta, prazoSolucao, getDataHoraBrasil(), chamado.id).run();

          corrigidos++;
          detalhes.push(`${chamado.numero}: SLA aplicado - Resp: ${sla.tempo_resposta_minutos || 0}min, Sol: ${sla.tempo_solucao_minutos}min`);
        } else {
          semSla++;
          detalhes.push(`${chamado.numero}: Nenhum SLA disponível para tipo=${chamado.tipo}, prioridade=${chamado.prioridade}, setor=${chamado.setor_destino_id}`);
        }
      } catch (error) {
        console.error(`Erro ao processar chamado ${chamado.id}:`, error);
        semSla++;
        detalhes.push(`${chamado.numero}: Erro ao processar - ${error}`);
      }
    }

    return c.json({
      sucesso: true,
      analisados,
      corrigidos,
      sem_sla: semSla,
      detalhes
    });
  } catch (error) {
    console.error("Erro ao executar correção:", error);
    return c.json({ error: "Erro ao executar correção de SLAs" }, 500);
  }
});

// Endpoint legado (mantido para compatibilidade)
router.post("/backfill", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se é admin
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (profile?.perfil !== 'admin') {
    return c.json({ error: "Acesso negado. Apenas administradores podem executar esta ação." }, 403);
  }

  try {
    // Buscar todos os chamados sem SLA
    const { results: chamados } = await c.env.DB.prepare(
      `SELECT id, tipo, prioridade, setor_destino_id, data_abertura 
       FROM chamados 
       WHERE sla_id IS NULL OR prazo_solucao IS NULL`
    ).all<any>();

    let atualizados = 0;
    let erros = 0;

    for (const chamado of chamados) {
      try {
        // Buscar SLA apropriado
        const sla = await c.env.DB.prepare(
          `SELECT * FROM slas 
           WHERE tipo_chamado = ? 
           AND prioridade = ? 
           AND (setor_id = ? OR setor_id IS NULL)
           AND ativo = 1
           ORDER BY setor_id DESC
           LIMIT 1`
        ).bind(chamado.tipo, chamado.prioridade, chamado.setor_destino_id).first<any>();

        if (sla) {
          const dataAbertura = new Date(chamado.data_abertura);
          
          const prazoResposta = sla.tempo_resposta_minutos > 0
            ? (await calcularPrazoSLA(c.env.DB, chamado.setor_destino_id, dataAbertura, sla.tempo_resposta_minutos)).toISOString()
            : null;
          
          const prazoSolucao = (await calcularPrazoSLA(c.env.DB, chamado.setor_destino_id, dataAbertura, sla.tempo_solucao_minutos)).toISOString();

          // Atualizar o chamado
          await c.env.DB.prepare(
            `UPDATE chamados 
             SET sla_id = ?, prazo_resposta = ?, prazo_solucao = ?, updated_at = ?
             WHERE id = ?`
          ).bind(sla.id, prazoResposta, prazoSolucao, getDataHoraBrasil(), chamado.id).run();

          atualizados++;
        } else {
          console.log(`Nenhum SLA encontrado para chamado ${chamado.id} (tipo: ${chamado.tipo}, prioridade: ${chamado.prioridade})`);
          erros++;
        }
      } catch (error) {
        console.error(`Erro ao processar chamado ${chamado.id}:`, error);
        erros++;
      }
    }

    return c.json({
      mensagem: "Backfill de SLAs concluído",
      total_chamados: chamados.length,
      atualizados,
      erros
    });
  } catch (error) {
    console.error("Erro ao executar backfill:", error);
    return c.json({ error: "Erro ao executar backfill de SLAs" }, 500);
  }
});

export default router;
