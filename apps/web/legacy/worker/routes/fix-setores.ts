import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import { getDataHoraBrasil } from "../utils/timezone";

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Endpoint para migrar tickets de setores inativos para ativos
router.post("/migrar-setores", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se é admin ou gestor
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'Gestor')) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    const detalhes: string[] = [];
    
    // Mapeamento de setores inativos → ativos
    const mapeamento = [
      { inativo: 8, ativo: 7, nome: 'Manutenção' },
      { inativo: 10, ativo: 9, nome: 'Hotelaria' },
      { inativo: 12, ativo: 13, nome: 'Rouparia' }
    ];

    let totalMigrados = 0;

    for (const map of mapeamento) {
      // Contar tickets no setor inativo
      const count = await c.env.DB.prepare(
        `SELECT COUNT(*) as total FROM chamados WHERE setor_destino_id = ?`
      ).bind(map.inativo).first<{ total: number }>();

      if (count && count.total > 0) {
        // Migrar tickets
        await c.env.DB.prepare(
          `UPDATE chamados 
           SET setor_destino_id = ?, updated_at = ?
           WHERE setor_destino_id = ?`
        ).bind(map.ativo, getDataHoraBrasil(), map.inativo).run();

        totalMigrados += count.total;
        detalhes.push(`${map.nome}: ${count.total} tickets migrados do setor ${map.inativo} → ${map.ativo}`);
      } else {
        detalhes.push(`${map.nome}: Nenhum ticket encontrado no setor inativo ${map.inativo}`);
      }
    }

    return c.json({
      sucesso: true,
      total_migrados: totalMigrados,
      detalhes
    });
  } catch (error) {
    console.error("Erro ao migrar setores:", error);
    return c.json({ 
      error: "Erro ao migrar setores", 
      detalhes: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Endpoint para DESFAZER a migração de setores
router.post("/desfazer-migracao", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se é admin ou gestor
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'Gestor')) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    const detalhes: string[] = [];
    
    // Mapeamento REVERSO: ativo → inativo (desfazer migração)
    const mapeamento = [
      { ativo: 7, inativo: 8, nome: 'Manutenção' },
      { ativo: 9, inativo: 10, nome: 'Hotelaria' },
      { ativo: 13, inativo: 12, nome: 'Rouparia' }
    ];

    let totalRestaurados = 0;

    for (const map of mapeamento) {
      // Contar tickets no setor ativo
      const count = await c.env.DB.prepare(
        `SELECT COUNT(*) as total FROM chamados WHERE setor_destino_id = ?`
      ).bind(map.ativo).first<{ total: number }>();

      if (count && count.total > 0) {
        // Restaurar tickets para setor original
        await c.env.DB.prepare(
          `UPDATE chamados 
           SET setor_destino_id = ?, updated_at = ?
           WHERE setor_destino_id = ?`
        ).bind(map.inativo, getDataHoraBrasil(), map.ativo).run();

        totalRestaurados += count.total;
        detalhes.push(`${map.nome}: ${count.total} tickets restaurados do setor ${map.ativo} → ${map.inativo}`);
      } else {
        detalhes.push(`${map.nome}: Nenhum ticket encontrado no setor ${map.ativo}`);
      }
    }

    return c.json({
      sucesso: true,
      total_restaurados: totalRestaurados,
      detalhes
    });
  } catch (error) {
    console.error("Erro ao desfazer migração:", error);
    return c.json({ 
      error: "Erro ao desfazer migração", 
      detalhes: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Endpoint para mover tickets manualmente para o setor correto
router.post("/mover-tickets", authMiddleware, async (c) => {
  const user = c.get("user")!;
  
  // Verificar se é admin ou gestor
  const profile = await c.env.DB.prepare(
    "SELECT perfil FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<{ perfil: string }>();

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'Gestor')) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    const body = await c.req.json();
    const { ticket_ids, setor_destino_id } = body;

    if (!ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return c.json({ error: "Informe os IDs dos tickets" }, 400);
    }

    if (!setor_destino_id) {
      return c.json({ error: "Informe o setor de destino" }, 400);
    }

    // Verificar se o setor existe
    const setor = await c.env.DB.prepare(
      "SELECT id, nome FROM setores WHERE id = ?"
    ).bind(setor_destino_id).first<{ id: number; nome: string }>();

    if (!setor) {
      return c.json({ error: "Setor não encontrado" }, 404);
    }

    let totalMovidos = 0;

    // Mover cada ticket
    for (const ticketId of ticket_ids) {
      // Buscar informações do ticket antes de mover
      const ticket = await c.env.DB.prepare(
        `SELECT numero, setor_destino_id FROM chamados WHERE id = ?`
      ).bind(ticketId).first<{ numero: string; setor_destino_id: number }>();

      if (ticket) {
        // Atualizar o setor do ticket
        await c.env.DB.prepare(
          `UPDATE chamados 
           SET setor_destino_id = ?, updated_at = ?
           WHERE id = ?`
        ).bind(setor_destino_id, getDataHoraBrasil(), ticketId).run();

        // Registrar no histórico
        await c.env.DB.prepare(
          `INSERT INTO historico (chamado_id, user_id, user_nome, acao, detalhes, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          ticketId,
          user.id,
          user.email,
          'Transferência de setor',
          `Ticket movido manualmente do setor ${ticket.setor_destino_id} para setor ${setor_destino_id} (${setor.nome})`,
          getDataHoraBrasil()
        ).run();

        totalMovidos++;
      }
    }

    return c.json({
      sucesso: true,
      total_movidos: totalMovidos,
      setor_destino: setor.nome
    });
  } catch (error) {
    console.error("Erro ao mover tickets:", error);
    return c.json({ 
      error: "Erro ao mover tickets", 
      detalhes: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

export default router;
