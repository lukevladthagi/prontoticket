import { Hono } from 'hono';
import { getDataHoraBrasil } from '../utils/timezone';

const router = new Hono<{ Bindings: Env }>();

// GET / - Listar todos os tickets não-TI com prazo_resposta preenchido
router.get('/', async (c) => {
  try {
    const db = c.env.DB;

    const query = `
      SELECT 
        c.id,
        c.numero,
        c.titulo,
        c.status,
        c.setor_destino_id,
        s.nome as setor_nome,
        c.prazo_resposta,
        c.prazo_solucao,
        c.data_abertura,
        c.tipo_problema
      FROM chamados c
      LEFT JOIN setores s ON c.setor_destino_id = s.id
      WHERE c.setor_destino_id != 1 
        AND c.prazo_resposta IS NOT NULL
      ORDER BY c.setor_destino_id, c.numero DESC
    `;

    const result = await db.prepare(query).all();

    // Contar por setor
    const countQuery = `
      SELECT 
        c.setor_destino_id,
        s.nome as setor_nome,
        COUNT(*) as total
      FROM chamados c
      LEFT JOIN setores s ON c.setor_destino_id = s.id
      WHERE c.setor_destino_id != 1 
        AND c.prazo_resposta IS NOT NULL
      GROUP BY c.setor_destino_id, s.nome
      ORDER BY s.nome
    `;

    const countResult = await db.prepare(countQuery).all();

    return c.json({
      tickets: result.results || [],
      resumo_por_setor: countResult.results || [],
      total: result.results?.length || 0
    });

  } catch (error: any) {
    console.error('[LIMPAR-PRAZO-RESPOSTA] Erro ao listar:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /limpar/:id - Limpar prazo_resposta de um ticket específico
router.post('/limpar/:id', async (c) => {
  try {
    const db = c.env.DB;
    const ticketId = c.req.param('id');

    // Verificar se o ticket existe e não é da TI
    const ticket = await db
      .prepare('SELECT id, numero, setor_destino_id FROM chamados WHERE id = ?')
      .bind(ticketId)
      .first();

    if (!ticket) {
      return c.json({ error: 'Ticket não encontrado' }, 404);
    }

    if (ticket.setor_destino_id === 1) {
      return c.json({ error: 'Não é permitido limpar prazo de resposta de tickets da TI' }, 400);
    }

    // Limpar prazo_resposta e data_primeira_resposta
    await db
      .prepare(`
        UPDATE chamados 
        SET prazo_resposta = NULL,
            data_primeira_resposta = NULL,
            updated_at = ?
        WHERE id = ?
      `)
      .bind(getDataHoraBrasil(), ticketId)
      .run();

    // Registrar no histórico
    await db
      .prepare(`
        INSERT INTO historico (
          chamado_id, tipo, descricao, usuario_id, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        ticketId,
        'alteracao',
        'Prazo de atendimento removido (não aplicável para este setor)',
        null,
        getDataHoraBrasil()
      )
      .run();

    return c.json({
      sucesso: true,
      ticket_numero: ticket.numero,
      mensagem: 'Prazo de atendimento removido com sucesso'
    });

  } catch (error: any) {
    console.error('[LIMPAR-PRAZO-RESPOSTA] Erro ao limpar ticket:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /limpar-setor - Limpar prazo_resposta de todos os tickets de um setor
router.post('/limpar-setor', async (c) => {
  try {
    const db = c.env.DB;
    const { setor_id } = await c.req.json();

    if (!setor_id) {
      return c.json({ error: 'setor_id é obrigatório' }, 400);
    }

    if (setor_id === 1) {
      return c.json({ error: 'Não é permitido limpar prazo de resposta de tickets da TI' }, 400);
    }

    // Buscar tickets do setor
    const tickets = await db
      .prepare(`
        SELECT id, numero 
        FROM chamados 
        WHERE setor_destino_id = ? 
          AND prazo_resposta IS NOT NULL
      `)
      .bind(setor_id)
      .all();

    if (!tickets.results || tickets.results.length === 0) {
      return c.json({
        sucesso: true,
        tickets_atualizados: 0,
        mensagem: 'Nenhum ticket encontrado para este setor'
      });
    }

    // Atualizar todos os tickets
    await db
      .prepare(`
        UPDATE chamados 
        SET prazo_resposta = NULL,
            data_primeira_resposta = NULL,
            updated_at = ?
        WHERE setor_destino_id = ? 
          AND prazo_resposta IS NOT NULL
      `)
      .bind(getDataHoraBrasil(), setor_id)
      .run();

    // Registrar no histórico de cada ticket
    for (const ticket of tickets.results as any[]) {
      await db
        .prepare(`
          INSERT INTO historico (
            chamado_id, tipo, descricao, usuario_id, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          ticket.id,
          'alteracao',
          'Prazo de atendimento removido em lote (não aplicável para este setor)',
          null,
          getDataHoraBrasil()
        )
        .run();
    }

    return c.json({
      sucesso: true,
      tickets_atualizados: tickets.results.length,
      mensagem: `${tickets.results.length} tickets atualizados com sucesso`
    });

  } catch (error: any) {
    console.error('[LIMPAR-PRAZO-RESPOSTA] Erro ao limpar setor:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /limpar-todos - Limpar prazo_resposta de todos os tickets não-TI
router.post('/limpar-todos', async (c) => {
  try {
    const db = c.env.DB;

    // Buscar todos os tickets não-TI com prazo_resposta
    const tickets = await db
      .prepare(`
        SELECT id, numero 
        FROM chamados 
        WHERE setor_destino_id != 1 
          AND prazo_resposta IS NOT NULL
      `)
      .all();

    if (!tickets.results || tickets.results.length === 0) {
      return c.json({
        sucesso: true,
        tickets_atualizados: 0,
        mensagem: 'Nenhum ticket encontrado'
      });
    }

    // Atualizar todos os tickets
    await db
      .prepare(`
        UPDATE chamados 
        SET prazo_resposta = NULL,
            data_primeira_resposta = NULL,
            updated_at = ?
        WHERE setor_destino_id != 1 
          AND prazo_resposta IS NOT NULL
      `)
      .bind(getDataHoraBrasil())
      .run();

    // Registrar no histórico de cada ticket
    for (const ticket of tickets.results as any[]) {
      await db
        .prepare(`
          INSERT INTO historico (
            chamado_id, tipo, descricao, usuario_id, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          ticket.id,
          'alteracao',
          'Prazo de atendimento removido em lote (não aplicável para este setor)',
          null,
          getDataHoraBrasil()
        )
        .run();
    }

    return c.json({
      sucesso: true,
      tickets_atualizados: tickets.results.length,
      mensagem: `${tickets.results.length} tickets atualizados com sucesso`
    });

  } catch (error: any) {
    console.error('[LIMPAR-PRAZO-RESPOSTA] Erro ao limpar todos:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default router;
