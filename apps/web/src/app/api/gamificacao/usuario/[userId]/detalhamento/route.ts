import sql from "@/app/api/utils/sql";
import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";
import { emptyDetail } from "@/app/api/gamificacao/_helpers";

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const { userId } = await params;

  const rankingRows = await sql`
    select * from gamificacao_ranking
    where user_id = ${userId}
    limit 1
  `;

  const ranking = rankingRows[0];
  const userNome = ranking?.user_nome || userId;
  const detail = emptyDetail(userId, userNome);

  if (ranking) {
    detail.tecnico = {
      user_id: ranking.user_id,
      user_nome: ranking.user_nome,
      total_pontos: Number(ranking.total_pontos || 0),
      mes_atual: Number(ranking.mes_atual || 0),
      nivel: Number(ranking.nivel || 1),
    };
  }

  const pontosRows = await sql`
    select gp.*, c.numero, c.titulo, c.prioridade, c.status, c.data_resolucao,
           c.categoria_id, cat.nome as categoria_nome
    from gamificacao_pontos gp
    left join chamados c on c.id = gp.chamado_id
    left join categorias cat on cat.id = c.categoria_id
    where gp.user_id = ${userId}
    order by gp.created_at desc
    limit 100
  `;

  detail.chamados = pontosRows
    .filter((row: any) => row.chamado_id)
    .map((row: any) => ({
      id: Number(row.chamado_id),
      numero: row.numero || "-",
      titulo: row.titulo || row.descricao || "-",
      prioridade: row.prioridade || "-",
      status: row.status || "-",
      data_resolucao: row.data_resolucao || row.created_at,
      categoria_nome: row.categoria_nome || "-",
      pontos_ganhos: Number(row.pontos || 0),
      composicao: {
        pontos_base: Number(row.pontos || 0),
        multiplicador_categoria: 1,
        tipo_categoria: row.tipo_acao || "geral",
        bonus_sla: 0,
        dentro_sla: false,
        is_auto_atendimento: false,
        multiplicador_auto: 1,
        pontos_antes_auto: Number(row.pontos || 0),
        pontos_final: Number(row.pontos || 0),
      },
    }));

  detail.estatisticas = {
    total_chamados: detail.chamados.length,
    total_avaliacoes: detail.avaliacoes.length,
    pontos_resolucao: detail.chamados.reduce((sum: number, item: any) => sum + Number(item.pontos_ganhos || 0), 0),
    pontos_avaliacoes: 0,
    pontos_total: Number(detail.tecnico.total_pontos || 0),
  };

  return Response.json(detail);
}
