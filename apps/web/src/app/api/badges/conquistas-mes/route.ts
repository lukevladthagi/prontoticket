import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const mesAno = searchParams.get("mes_ano");
  const rows = mesAno
    ? await sql`
        select b.*, ub.user_id, ub.data_conquista, gr.user_nome, gr.total_pontos, gr.mes_atual
        from badges b
        left join user_badges ub on ub.badge_id = b.id and left(ub.data_conquista, 7) = ${mesAno}
        left join gamificacao_ranking gr on gr.user_id = ub.user_id
        order by b.id, ub.data_conquista desc
      `
    : await sql`
        select b.*, ub.user_id, ub.data_conquista, gr.user_nome, gr.total_pontos, gr.mes_atual
        from badges b
        left join user_badges ub on ub.badge_id = b.id
        left join gamificacao_ranking gr on gr.user_id = ub.user_id
        order by b.id, ub.data_conquista desc
      `;

  const grouped = new Map<number, any>();
  for (const row of rows as any[]) {
    if (!grouped.has(Number(row.id))) {
      grouped.set(Number(row.id), {
        id: Number(row.id),
        nome: row.nome,
        descricao: row.descricao,
        icone: row.icone,
        criterio: row.criterio,
        conquistadores: [],
      });
    }
    if (row.user_id) {
      grouped.get(Number(row.id)).conquistadores.push({
        user_id: row.user_id,
        user_nome: row.user_nome || row.user_id,
        data_conquista: row.data_conquista,
        total_pontos: Number(row.total_pontos || 0),
        pontos_mes: Number(row.mes_atual || 0),
      });
    }
  }

  return Response.json(Array.from(grouped.values()));
}
