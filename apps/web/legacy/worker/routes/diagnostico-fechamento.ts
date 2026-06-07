import { Hono } from "hono";
import { getDataHoraBrasil } from "../utils/timezone";

interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// Endpoint de diagnóstico
app.get("/", async (c) => {
  try {
    const db = c.env.DB;

    // Horário atual e limite (2 horas atrás)
    const horarioAtual = new Date();
    const horarioAtualBrStr = getDataHoraBrasil();
    const horarioAtualBr = new Date(horarioAtualBrStr);
    const limite2h = new Date(horarioAtual.getTime() - 2 * 60 * 60 * 1000);
    const limite2hBr = new Date(horarioAtualBr.getTime() - 2 * 60 * 60 * 1000);

    // Buscar todos os tickets em "Aguardando Avaliação" sem avaliação
    const { results: tickets } = await db
      .prepare(
        `
        SELECT 
          id,
          numero,
          titulo,
          status,
          data_resolucao,
          avaliacao_nota
        FROM chamados
        WHERE status = 'Aguardando Avaliação'
          AND avaliacao_nota IS NULL
        ORDER BY data_resolucao ASC
      `
      )
      .all();

    // Processar cada ticket para calcular se deveria ser fechado
    const ticketsProcessados = tickets.map((ticket: any) => {
      const dataResolucao = new Date(ticket.data_resolucao);
      const diferencaMs = horarioAtualBr.getTime() - dataResolucao.getTime();
      const horasDesdeResolucao = (diferencaMs / (1000 * 60 * 60)).toFixed(2);
      const deveriaSerFechado = dataResolucao < limite2hBr;

      return {
        id: ticket.id,
        numero: ticket.numero,
        titulo: ticket.titulo,
        status: ticket.status,
        data_resolucao: ticket.data_resolucao,
        data_resolucao_formatada: dataResolucao.toISOString(),
        horas_desde_resolucao: horasDesdeResolucao,
        deveria_ser_fechado: deveriaSerFechado,
        avaliacao_nota: ticket.avaliacao_nota,
      };
    });

    const ticketsParaFechar = ticketsProcessados.filter((t: any) => t.deveria_ser_fechado);

    return c.json({
      horario_atual: horarioAtual.toISOString(),
      horario_atual_br: horarioAtualBr.toISOString(),
      limite_2h: limite2h.toISOString(),
      limite_2h_br: limite2hBr.toISOString(),
      total_tickets: tickets.length,
      tickets_para_fechar: ticketsParaFechar.length,
      tickets: ticketsProcessados,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Endpoint para forçar fechamento manual
app.post("/forcar-fechamento", async (c) => {
  try {
    const db = c.env.DB;

    // Horário atual e limite (2 horas atrás)
    const horarioAtualBrStr = getDataHoraBrasil();
    const horarioAtualBr = new Date(horarioAtualBrStr);
    const limite2h = new Date(horarioAtualBr.getTime() - 2 * 60 * 60 * 1000);

    // Buscar tickets elegíveis
    const { results: tickets } = await db
      .prepare(
        `
        SELECT 
          id,
          numero,
          data_resolucao
        FROM chamados
        WHERE status = 'Aguardando Avaliação'
          AND avaliacao_nota IS NULL
      `
      )
      .all();

    let ticketsFechados = 0;

    // Processar cada ticket
    for (const ticket of tickets as any[]) {
      const dataResolucao = new Date(ticket.data_resolucao);

      // Verificar se já passou 2 horas
      if (dataResolucao < limite2h) {
        // Fechar o ticket
        await db
          .prepare(
            `
            UPDATE chamados
            SET status = 'Fechado',
                updated_at = ?
            WHERE id = ?
          `
          )
          .bind(horarioAtualBrStr, ticket.id)
          .run();

        // Registrar no histórico
        await db
          .prepare(
            `
            INSERT INTO historico (
              chamado_id,
              user_id,
              user_nome,
              tipo,
              acao,
              detalhes,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `
          )
          .bind(
            ticket.id,
            null,
            "Sistema",
            "mudanca_status",
            "Status alterado",
            "Status alterado de 'Aguardando Avaliação' para 'Fechado' automaticamente (sem avaliação após 2 horas)",
            horarioAtualBrStr
          )
          .run();

        ticketsFechados++;
      }
    }

    return c.json({
      success: true,
      tickets_fechados: ticketsFechados,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default app;
