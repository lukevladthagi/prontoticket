import sql from "@/app/api/utils/sql";

export function normalizeRanking(row: any) {
  return {
    user_id: row.user_id,
    user_nome: row.user_nome || "Usuario",
    total_pontos: Number(row.total_pontos || 0),
    mes_atual: Number(row.mes_atual || 0),
    pontos_periodo: Number(row.pontos_periodo || row.mes_atual || 0),
    nivel: Number(row.nivel || 1),
  };
}

export async function currentProfile(userId: string, email?: string | null) {
  const rows = await sql`
    select * from user_profiles
    where user_id = ${userId} or lower(email) = lower(${email || ""})
    order by case when user_id = ${userId} then 0 else 1 end
    limit 1
  `;
  return rows[0] || null;
}

export function emptyDetail(userId: string, userNome: string): any {
  return {
    tecnico: {
      user_id: userId,
      user_nome: userNome,
      total_pontos: 0,
      mes_atual: 0,
      nivel: 1,
    },
    chamados: [],
    avaliacoes: [],
    estatisticas: {
      total_chamados: 0,
      total_avaliacoes: 0,
      pontos_resolucao: 0,
      pontos_avaliacoes: 0,
      pontos_total: 0,
    },
  };
}
