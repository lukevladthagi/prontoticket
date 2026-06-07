import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

// GET - Listar chamados recorrentes sem setor solicitante
app.get("/diagnostico", async (c) => {
  const db = c.env.DB;

  try {
    const recorrentes = await db
      .prepare(
        `
        SELECT 
          id,
          titulo,
          descricao,
          tipo,
          frequencia,
          solicitante_setor,
          ativo,
          created_at
        FROM chamados_recorrentes
        WHERE solicitante_setor IS NULL
        ORDER BY created_at DESC
        `
      )
      .all();

    // Contar chamados gerados por cada recorrente
    const recorrentesComContagem = [];
    for (const rec of recorrentes.results) {
      const count = await db
        .prepare(
          `SELECT COUNT(*) as total FROM chamados WHERE origem_recorrente_id = ?`
        )
        .bind(rec.id)
        .first();
      
      recorrentesComContagem.push({
        ...rec,
        chamados_gerados: count?.total || 0
      });
    }

    return c.json({
      total: recorrentes.results.length,
      recorrentes: recorrentesComContagem,
    });
  } catch (error: any) {
    console.error("Erro ao buscar chamados recorrentes:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST - Corrigir setor de um chamado recorrente
app.post("/corrigir/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const { setor, corrigir_chamados_gerados } = await c.req.json();

  if (!setor) {
    return c.json({ error: "Setor é obrigatório" }, 400);
  }

  try {
    // Atualizar o template do chamado recorrente
    await db
      .prepare(
        `
        UPDATE chamados_recorrentes
        SET solicitante_setor = ?,
            updated_at = datetime('now')
        WHERE id = ?
        `
      )
      .bind(setor, id)
      .run();

    let chamadosAtualizados = 0;

    // Se solicitado, também atualizar os chamados já gerados
    if (corrigir_chamados_gerados) {
      const result = await db
        .prepare(
          `
          UPDATE chamados
          SET solicitante_setor = ?,
              updated_at = datetime('now')
          WHERE origem_recorrente_id = ?
            AND solicitante_setor IS NULL
          `
        )
        .bind(setor, id)
        .run();

      chamadosAtualizados = result.meta.changes || 0;
    }

    return c.json({ 
      success: true, 
      message: "Setor atualizado com sucesso",
      chamados_atualizados: chamadosAtualizados
    });
  } catch (error: any) {
    console.error("Erro ao atualizar setor:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST - Corrigir múltiplos chamados recorrentes de uma vez
app.post("/corrigir-lote", async (c) => {
  const db = c.env.DB;
  const { atualizacoes, corrigir_chamados_gerados } = await c.req.json<{
    atualizacoes: { id: number; setor: string }[];
    corrigir_chamados_gerados?: boolean;
  }>();

  if (!atualizacoes || !Array.isArray(atualizacoes)) {
    return c.json({ error: "Lista de atualizações inválida" }, 400);
  }

  try {
    let atualizados = 0;
    let totalChamadosAtualizados = 0;

    for (const item of atualizacoes) {
      if (item.id && item.setor) {
        // Atualizar template do recorrente
        await db
          .prepare(
            `
            UPDATE chamados_recorrentes
            SET solicitante_setor = ?,
                updated_at = datetime('now')
            WHERE id = ?
            `
          )
          .bind(item.setor, item.id)
          .run();
        atualizados++;

        // Se solicitado, atualizar também os chamados gerados
        if (corrigir_chamados_gerados) {
          const result = await db
            .prepare(
              `
              UPDATE chamados
              SET solicitante_setor = ?,
                  updated_at = datetime('now')
              WHERE origem_recorrente_id = ?
                AND solicitante_setor IS NULL
              `
            )
            .bind(item.setor, item.id)
            .run();

          totalChamadosAtualizados += result.meta.changes || 0;
        }
      }
    }

    return c.json({
      success: true,
      message: `${atualizados} chamados recorrentes atualizados com sucesso`,
      total: atualizados,
      chamados_atualizados: totalChamadosAtualizados,
    });
  } catch (error: any) {
    console.error("Erro ao atualizar chamados recorrentes:", error);
    return c.json({ error: error.message }, 500);
  }
});

// GET - Listar chamados individuais sem setor solicitante
app.get("/chamados-sem-setor", async (c) => {
  const db = c.env.DB;

  try {
    const chamados = await db
      .prepare(
        `
        SELECT 
          id,
          numero,
          titulo,
          status,
          origem,
          origem_recorrente_id,
          data_abertura
        FROM chamados
        WHERE solicitante_setor IS NULL
        ORDER BY data_abertura DESC
        LIMIT 500
        `
      )
      .all();

    return c.json({
      total: chamados.results.length,
      chamados: chamados.results,
    });
  } catch (error: any) {
    console.error("Erro ao buscar chamados sem setor:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST - Corrigir setor de chamados individuais em lote
app.post("/corrigir-chamados-lote", async (c) => {
  const db = c.env.DB;
  const { setor_padrao } = await c.req.json<{
    setor_padrao: string;
  }>();

  if (!setor_padrao) {
    return c.json({ error: "Setor padrão é obrigatório" }, 400);
  }

  try {
    const result = await db
      .prepare(
        `
        UPDATE chamados
        SET solicitante_setor = ?,
            updated_at = datetime('now')
        WHERE solicitante_setor IS NULL
        `
      )
      .bind(setor_padrao)
      .run();

    const totalAtualizados = result.meta.changes || 0;

    return c.json({
      success: true,
      message: `${totalAtualizados} chamados atualizados com sucesso`,
      total: totalAtualizados,
    });
  } catch (error: any) {
    console.error("Erro ao atualizar chamados:", error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
