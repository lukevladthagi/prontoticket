import sql from "@/app/api/utils/sql";

// GET /api/debug-recorrentes
// Debug view of recurring-ticket definitions and the tickets generated from
// them. D1 -> Postgres (Neon).
export async function GET() {
  const recorrentes = await sql`
    SELECT id, titulo, frequencia, ativo, proximo_chamado_em, created_at
    FROM chamados_recorrentes
    ORDER BY created_at DESC
  `;

  const chamados = await sql`
    SELECT id, numero, titulo, origem_recorrente_id, created_at
    FROM chamados
    WHERE origem_recorrente_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10
  `;

  return Response.json({
    total_recorrentes: recorrentes.length,
    recorrentes,
    chamados_gerados: chamados.length,
    chamados,
  });
}
