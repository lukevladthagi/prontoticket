import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

export async function GET(req: Request, { params }: { params: Promise<{ mesAno: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { mesAno } = await params;
  const { searchParams } = new URL(req.url);
  const limite = Math.max(1, Math.min(100, Number(searchParams.get("limite") || "10")));

  const rows = await sql`
    select user_id, user_nome, pontos, nivel, posicao_ranking
    from gamificacao_historico_mensal
    where mes_ano = ${mesAno}
    order by posicao_ranking asc, pontos desc
    limit ${limite}
  `;

  return Response.json(rows.map((row: any) => ({
    ...row,
    pontos: Number(row.pontos || 0),
    nivel: Number(row.nivel || 1),
  })));
}
