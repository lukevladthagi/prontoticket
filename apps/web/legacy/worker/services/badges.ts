interface Badge {
  id: number;
  nome: string;
  descricao: string;
  icone: string;
  criterio: string;
}

import { getDataHoraBrasil } from "../utils/timezone";

// Verificar se usuário já tem o badge
async function usuarioTemBadge(
  db: D1Database,
  userId: string,
  badgeId: number
): Promise<boolean> {
  const result = await db.prepare(
    "SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?"
  ).bind(userId, badgeId).first();
  
  return !!result;
}

// Conceder badge ao usuário
export async function concederBadge(
  db: D1Database,
  userId: string,
  criterio: string
): Promise<void> {
  // Buscar badge pelo critério
  const badge = await db.prepare(
    "SELECT * FROM badges WHERE criterio = ?"
  ).bind(criterio).first<Badge>();

  if (!badge) return;

  // Verificar se já tem o badge
  const jaTemBadge = await usuarioTemBadge(db, userId, badge.id);
  if (jaTemBadge) return;

  // Conceder badge
  await db.prepare(
    "INSERT INTO user_badges (user_id, badge_id, created_at) VALUES (?, ?, ?)"
  ).bind(userId, badge.id, getDataHoraBrasil()).run();
}

// Verificar badges baseado em incidentes críticos
export async function verificarBadgeHeroiTI(
  db: D1Database,
  userId: string
): Promise<void> {
  const result = await db.prepare(
    `SELECT COUNT(*) as total FROM chamados 
     WHERE tecnico_responsavel_id = ? AND prioridade = 'P1' AND status = 'Fechado'`
  ).bind(userId).first<{ total: number }>();

  if (result && result.total >= 5) {
    await concederBadge(db, userId, 'resolver_incidente_critico');
  }
}

// Verificar badges baseado em bugs sem reincidência
export async function verificarBadgeMatadorBugs(
  db: D1Database,
  userId: string
): Promise<void> {
  const result = await db.prepare(
    `SELECT COUNT(*) as total FROM chamados 
     WHERE tecnico_responsavel_id = ? AND tipo = 'Problema' AND status = 'Fechado'`
  ).bind(userId).first<{ total: number }>();

  if (result && result.total >= 10) {
    await concederBadge(db, userId, 'resolver_bug_definitivo');
  }
}

// Verificar badge de projetos com transição completa
export async function verificarBadgeMestreProjetos(
  db: D1Database,
  userId: string
): Promise<void> {
  const result = await db.prepare(
    `SELECT COUNT(*) as total FROM gamificacao_pontos 
     WHERE user_id = ? AND tipo_acao = 'projeto_documentacao_completa'`
  ).bind(userId).first<{ total: number }>();

  if (result && result.total >= 3) {
    await concederBadge(db, userId, 'projeto_transicao_completa');
  }
}

// Verificar badge de treinamento aplicado
export async function verificarBadgeMestreEvolucao(
  db: D1Database,
  userId: string
): Promise<void> {
  const result = await db.prepare(
    `SELECT COUNT(*) as total FROM treinamento_aplicacoes 
     WHERE user_id = ? AND aprovado = TRUE`
  ).bind(userId).first<{ total: number }>();

  if (result && result.total >= 3) {
    await concederBadge(db, userId, 'treinamento_aplicado');
  }
}

// Verificar badge de compartilhar conhecimento
export async function verificarBadgeMentorTI(
  db: D1Database,
  userId: string
): Promise<void> {
  const result = await db.prepare(
    `SELECT COUNT(*) as total FROM gamificacao_pontos 
     WHERE user_id = ? AND tipo_acao = 'compartilhar_equipe'`
  ).bind(userId).first<{ total: number }>();

  if (result && result.total >= 5) {
    await concederBadge(db, userId, 'compartilhar_conhecimento');
  }
}

// Verificar todos os badges de um usuário
export async function verificarTodosBadges(
  db: D1Database,
  userId: string
): Promise<void> {
  await verificarBadgeHeroiTI(db, userId);
  await verificarBadgeMatadorBugs(db, userId);
  await verificarBadgeMestreProjetos(db, userId);
  await verificarBadgeMestreEvolucao(db, userId);
  await verificarBadgeMentorTI(db, userId);
}
