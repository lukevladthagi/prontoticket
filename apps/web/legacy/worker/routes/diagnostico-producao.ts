import { Hono } from 'hono';
import { authMiddleware } from '@getmocha/users-service/backend';
import type { MochaUser } from '@getmocha/users-service/shared';

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

router.use('*', authMiddleware);

// Diagnóstico completo para verificar estado da produção
router.get('/hotelaria', async (c) => {
  const db = c.env.DB;

  try {
    // 1. Verificar categorias de Hotelaria
    const categoriasHotelaria = await db
      .prepare(`
        SELECT id, nome, setor_id, tipo, ativo
        FROM categorias
        WHERE (setor_id = 9 OR nome LIKE '%Higienização%')
        ORDER BY id
      `)
      .all();

    // 2. Verificar SLAs de Hotelaria
    const slasHotelaria = await db
      .prepare(`
        SELECT id, setor_id, tipo_chamado, prioridade, categoria_id, tempo_resposta_minutos, tempo_solucao_minutos
        FROM slas
        WHERE setor_id = 9
        ORDER BY id
      `)
      .all();

    // 3. Verificar últimos tickets de Hotelaria
    const ticketsHotelaria = await db
      .prepare(`
        SELECT 
          c.id,
          c.numero,
          c.titulo,
          c.tipo,
          c.prioridade,
          c.setor_destino_id,
          c.categoria_id,
          cat.nome as categoria_nome,
          cat.setor_id as categoria_setor_id,
          cat.tipo as categoria_tipo,
          c.sla_id,
          c.prazo_resposta,
          c.prazo_solucao,
          c.data_abertura
        FROM chamados c
        LEFT JOIN categorias cat ON c.categoria_id = cat.id
        WHERE c.setor_destino_id = 9
        ORDER BY c.id DESC
        LIMIT 10
      `)
      .all();

    // 4. Verificar setores ativos
    const setores = await db
      .prepare(`
        SELECT id, nome, ativo
        FROM setores
        WHERE id IN (9, 10)
        ORDER BY id
      `)
      .all();

    // 5. Verificar categorias antigas (31, 32, 34, 40)
    const categoriasAntigas = await db
      .prepare(`
        SELECT id, nome, setor_id, tipo, ativo
        FROM categorias
        WHERE id IN (31, 32, 34, 40)
        ORDER BY id
      `)
      .all();

    // 6. Buscar SLA específico para categoria 691
    const slaCategoria691 = await db
      .prepare(`
        SELECT *
        FROM slas
        WHERE categoria_id = 691
      `)
      .all();

    // 7. Buscar SLA para categoria 34
    const slaCategoria34 = await db
      .prepare(`
        SELECT *
        FROM slas
        WHERE categoria_id = 34
      `)
      .all();

    return c.json({
      categorias_hotelaria: categoriasHotelaria.results || [],
      slas_hotelaria: slasHotelaria.results || [],
      tickets_hotelaria: ticketsHotelaria.results || [],
      setores: setores.results || [],
      categorias_antigas: categoriasAntigas.results || [],
      sla_categoria_691: slaCategoria691.results || [],
      sla_categoria_34: slaCategoria34.results || [],
    });
  } catch (error: any) {
    console.error('Erro no diagnóstico:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default router;
