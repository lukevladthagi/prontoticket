import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.get("/", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se é admin ou gestor
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'Gestor')) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    // 1. Verificar TODOS os setores Hotelaria (pode ter duplicados)
    const { results: setoresHotelaria } = await c.env.DB.prepare(
      `SELECT id, nome, ativo FROM setores WHERE nome LIKE '%Hotelaria%' ORDER BY id`
    ).all();

    // 2. Verificar SLAs configurados para CADA setor Hotelaria
    const slasInfo: Record<number, any> = {};
    for (const setor of setoresHotelaria) {
      const { results: slas } = await c.env.DB.prepare(
        `SELECT id, categoria_id, tipo_chamado, prioridade, tempo_resposta_minutos, tempo_solucao_minutos, ativo
         FROM slas WHERE setor_id = ? ORDER BY tipo_chamado, prioridade`
      ).bind((setor as any).id).all();
      slasInfo[(setor as any).id] = { setor: setor, slas: slas };
    }

    // 3. Verificar tickets por CADA setor Hotelaria
    const ticketsInfo: Record<number, any> = {};
    for (const setor of setoresHotelaria) {
      const stats = await c.env.DB.prepare(
        `SELECT COUNT(*) as total, 
                COUNT(sla_id) as com_sla,
                COUNT(CASE WHEN sla_id IS NULL THEN 1 END) as sem_sla
         FROM chamados WHERE setor_destino_id = ?`
      ).bind((setor as any).id).first();
      
      const { results: ticketsSemSLA } = await c.env.DB.prepare(
        `SELECT id, numero, tipo, prioridade, setor_destino_id, categoria_id, sla_id, status
         FROM chamados 
         WHERE setor_destino_id = ? AND (sla_id IS NULL OR prazo_solucao IS NULL)
         ORDER BY id DESC LIMIT 5`
      ).bind((setor as any).id).all();
      
      ticketsInfo[(setor as any).id] = { stats, ticketsSemSLA };
    }

    // 4. Analisar primeiros tickets sem SLA
    const ticketsSemSLA = ticketsInfo[9]?.ticketsSemSLA || ticketsInfo[10]?.ticketsSemSLA || [];

    // 3. Para cada ticket sem SLA, tentar encontrar qual SLA deveria ser aplicado
    const analiseTickets = [];
    for (const ticket of ticketsSemSLA) {
      // Tentar encontrar SLA usando a mesma lógica do código de criação
      let slaEncontrado = null;
      let metodo = '';

      // Método 1: por categoria_id
      if (ticket.categoria_id) {
        slaEncontrado = await c.env.DB.prepare(
          `SELECT * FROM slas WHERE categoria_id = ? AND ativo = TRUE LIMIT 1`
        ).bind(ticket.categoria_id).first();
        if (slaEncontrado) metodo = 'categoria_id';
      }

      // Método 2: genérico por tipo + prioridade + setor
      if (!slaEncontrado) {
        slaEncontrado = await c.env.DB.prepare(
          `SELECT * FROM slas 
           WHERE tipo_chamado = ? 
           AND prioridade = ? 
           AND (setor_id = 9 OR setor_id IS NULL)
           AND ativo = TRUE 
           ORDER BY setor_id DESC
           LIMIT 1`
        ).bind(ticket.tipo, ticket.prioridade).first();
        if (slaEncontrado) metodo = 'generico (tipo + prioridade + setor)';
      }

      analiseTickets.push({
        ticket: ticket,
        sla_encontrado: slaEncontrado || null,
        metodo_busca: metodo || 'Nenhum SLA encontrado',
        motivo_sem_sla: !slaEncontrado 
          ? `Nenhum SLA configurado para tipo="${ticket.tipo}", prioridade="${ticket.prioridade}", setor=9`
          : 'SLA existe mas não foi aplicado'
      });
    }

    return c.json({
      setores_encontrados: setoresHotelaria,
      slas_por_setor: slasInfo,
      tickets_por_setor: ticketsInfo,
      analise_tickets_sem_sla: analiseTickets,
      diagnostico: {
        problema_identificado: analiseTickets.length > 0 
          ? "Tickets sem SLA encontrados - verificar configuração"
          : "Nenhum ticket sem SLA encontrado",
        acao_recomendada: analiseTickets.length > 0
          ? "Executar ferramenta de correção de SLA em Configurações > Corrigir SLA"
          : "Sistema está OK"
      }
    });
  } catch (error) {
    console.error("Erro no diagnóstico:", error);
    return c.json({ 
      error: "Erro ao executar diagnóstico", 
      detalhes: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

export default router;
