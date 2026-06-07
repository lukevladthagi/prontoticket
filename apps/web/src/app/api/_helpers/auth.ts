import { auth } from "@/lib/auth";

/**
 * Returns the better-auth session user for the incoming request, or null when
 * there is no valid session. Replaces the Mocha `authMiddleware` + `c.get("user")`
 * pattern from the original Cloudflare Worker.
 */
export async function getSessionUser(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user ?? null;
}

/** Standard 401 body used by routes that previously relied on authMiddleware. */
export function unauthorized() {
  return Response.json({ error: "Não autenticado" }, { status: 401 });
}
