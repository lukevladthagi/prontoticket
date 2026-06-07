import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  return Response.json({ ok: true, message: "Recalculo completo ainda nao foi migrado para esta versao." });
}
