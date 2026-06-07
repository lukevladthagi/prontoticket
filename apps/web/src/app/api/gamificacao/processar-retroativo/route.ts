import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  return Response.json({
    total_tickets: 0,
    tickets_com_pontos: 0,
    tickets_processados: 0,
    erros: ["Processamento retroativo ainda nao foi migrado para esta versao."],
  });
}
