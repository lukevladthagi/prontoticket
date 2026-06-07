import { Hono } from 'hono';
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const app = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

app.get('/', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;

    console.log('[diagnostico-setores] Iniciando consultas...');

    // 1. Buscar setores ativos (query simples)
    const setoresResult = await db
      .prepare('SELECT id, nome FROM setores WHERE ativo = 1 ORDER BY id')
      .all();
    
    console.log('[diagnostico-setores] Setores encontrados:', setoresResult.results?.length);

    // 2. Buscar TODOS os tickets sem filtros complexos
    const ticketsResult = await db
      .prepare(`
        SELECT 
          id,
          numero,
          titulo,
          setor_destino_id,
          status,
          tipo,
          prioridade,
          prazo_resposta,
          prazo_solucao
        FROM chamados
        WHERE setor_destino_id IS NOT NULL
        LIMIT 2000
      `)
      .all();

    console.log('[diagnostico-setores] Tickets encontrados:', ticketsResult.results?.length);

    const setoresMap = new Map((setoresResult.results as any[]).map(s => [s.id, s.nome]));
    const allTickets = ticketsResult.results as any[];

    // 3. Filtrar tickets sem SLA no código
    const tickets_sem_sla = allTickets
      .filter(t => !t.prazo_resposta || !t.prazo_solucao)
      .slice(0, 500)
      .map(ticket => ({
        id: ticket.id,
        numero: ticket.numero,
        titulo: ticket.titulo,
        setor_destino_id: ticket.setor_destino_id,
        setor_nome: setoresMap.get(ticket.setor_destino_id) || 'Desconhecido',
        status: ticket.status,
        tipo: ticket.tipo,
        prioridade: ticket.prioridade
      }));

    console.log('[diagnostico-setores] Tickets sem SLA:', tickets_sem_sla.length);

    // 4. Calcular distribuição no código
    const distribuicaoMap = new Map<number, {total: number, sem_sla: number}>();
    
    for (const ticket of allTickets) {
      const setorId = ticket.setor_destino_id;
      if (!distribuicaoMap.has(setorId)) {
        distribuicaoMap.set(setorId, { total: 0, sem_sla: 0 });
      }
      const stats = distribuicaoMap.get(setorId)!;
      stats.total++;
      if (!ticket.prazo_resposta || !ticket.prazo_solucao) {
        stats.sem_sla++;
      }
    }

    const distribuicao = Array.from(distribuicaoMap.entries())
      .filter(([_, stats]) => stats.sem_sla > 0)
      .map(([setorId, stats]) => ({
        setor_destino_id: setorId,
        setor_nome: setoresMap.get(setorId) || 'Desconhecido',
        total: stats.total,
        sem_sla: stats.sem_sla
      }))
      .sort((a, b) => b.sem_sla - a.sem_sla);

    console.log('[diagnostico-setores] Distribuição calculada:', distribuicao.length, 'setores');

    return c.json({
      setores: setoresResult.results || [],
      tickets_sem_sla: tickets_sem_sla,
      distribuicao: distribuicao,
    });
  } catch (error: any) {
    console.error('[diagnostico-setores] ERRO COMPLETO:', error);
    console.error('[diagnostico-setores] Stack:', error.stack);
    return c.json({ 
      error: error.message || 'Erro ao gerar diagnóstico',
      details: error.stack 
    }, 500);
  }
});

export default app;
