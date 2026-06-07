import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";

const router = new Hono<{ Bindings: Env }>();

router.get("/verificar", authMiddleware, async (c) => {
  // Verificar tickets resolvidos e seus SLAs
  const ticketsResolvidos = await c.env.DB.prepare(
    `SELECT 
       id, numero, status, 
       prazo_resposta, prazo_solucao, 
       data_primeira_resposta, data_resolucao,
       sla_id,
       setor_destino_id,
       data_abertura
     FROM chamados 
     WHERE status IN ('Resolvido', 'Fechado')
     ORDER BY id DESC
     LIMIT 20`
  ).all();

  // Verificar SLAs configurados
  const slasConfigurados = await c.env.DB.prepare(
    `SELECT id, tipo_chamado, prioridade, setor_id, 
            tempo_resposta_minutos, tempo_solucao_minutos, ativo
     FROM slas 
     WHERE ativo = TRUE
     ORDER BY setor_id, prioridade`
  ).all();

  // Calcular estatísticas
  const stats = {
    total_resolvidos: ticketsResolvidos.results.length,
    com_prazo_resposta: ticketsResolvidos.results.filter(t => t.prazo_resposta).length,
    com_prazo_solucao: ticketsResolvidos.results.filter(t => t.prazo_solucao).length,
    com_data_primeira_resposta: ticketsResolvidos.results.filter(t => t.data_primeira_resposta).length,
    com_data_resolucao: ticketsResolvidos.results.filter(t => t.data_resolucao).length,
    com_sla_id: ticketsResolvidos.results.filter(t => t.sla_id).length,
  };

  return c.json({
    stats,
    tickets: ticketsResolvidos.results,
    slas_configurados: slasConfigurados.results,
  });
});

export default router;
