import { getSessionUser, unauthorized } from "@/app/api/_helpers/auth";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  return Response.json({ categorias: {} });
}
