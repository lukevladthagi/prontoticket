import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";

const router = new Hono<{ Bindings: Env }>();

router.use("*", authMiddleware);

// Listar exemplos de tickets para debug
router.get("/", async (c) => {
  const tickets = await c.env.DB.prepare(
    `SELECT numero, id, status, sla_pausado_em, sla_pausado_motivo 
     FROM chamados 
     ORDER BY id DESC 
     LIMIT 20`
  ).all();

  return c.json({
    total_tickets: tickets.results.length,
    tickets: tickets.results,
    info: "Estes são os 20 tickets mais recentes para verificar o formato dos números"
  });
});

// Diagnóstico de ticket específico - verificar campos SLA pausado
router.get("/:numero", async (c) => {
  let numero = c.req.param("numero");
  
  // Remover prefixo TKT- se existir para normalizar busca
  const numeroSemPrefixo = numero.replace(/^TKT-/i, '');

  // Tentar múltiplos formatos de busca
  const ticket = await c.env.DB.prepare(
    `SELECT * FROM chamados WHERE numero = ? OR numero = ? OR numero = ? OR CAST(id as TEXT) = ?`
  ).bind(numeroSemPrefixo, numero, `TKT-${numeroSemPrefixo}`, numeroSemPrefixo).first();

  if (!ticket) {
    return c.json({ 
      error: "Ticket não encontrado",
      tentativas_busca: {
        numero_original: numero,
        numero_sem_prefixo: numeroSemPrefixo,
        numero_com_prefixo: `TKT-${numeroSemPrefixo}`,
        id: numeroSemPrefixo
      }
    }, 404);
  }

  // Verificar tipo de cada campo relacionado a SLA pausado
  const diagnostico = {
    numero: ticket.numero,
    status: ticket.status,
    campos_sla_pausado: {
      sla_pausado_em: {
        valor: ticket.sla_pausado_em,
        tipo: typeof ticket.sla_pausado_em,
        is_null: ticket.sla_pausado_em === null,
        is_undefined: ticket.sla_pausado_em === undefined,
        is_empty_string: ticket.sla_pausado_em === '',
        truthy: !!ticket.sla_pausado_em
      },
      sla_pausado_motivo: {
        valor: ticket.sla_pausado_motivo,
        tipo: typeof ticket.sla_pausado_motivo,
        is_null: ticket.sla_pausado_motivo === null
      },
      tempo_pausado_minutos: {
        valor: ticket.tempo_pausado_minutos,
        tipo: typeof ticket.tempo_pausado_minutos
      }
    },
    campos_sla: {
      prazo_resposta: {
        valor: ticket.prazo_resposta,
        tipo: typeof ticket.prazo_resposta
      },
      data_primeira_resposta: {
        valor: ticket.data_primeira_resposta,
        tipo: typeof ticket.data_primeira_resposta
      },
      prazo_solucao: {
        valor: ticket.prazo_solucao,
        tipo: typeof ticket.prazo_solucao
      },
      data_resolucao: {
        valor: ticket.data_resolucao,
        tipo: typeof ticket.data_resolucao
      }
    },
    ticket_completo: ticket
  };

  return c.json(diagnostico);
});

export default router;
