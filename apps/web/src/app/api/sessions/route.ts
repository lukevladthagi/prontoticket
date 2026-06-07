import { auth } from "@/lib/auth";

// POST /api/sessions
// Original (Mocha) exchanged an OAuth `code` for a session token and set the
// MOCHA_SESSION_TOKEN cookie. With better-auth the OAuth callback is handled by
// the better-auth catch-all route (/api/auth/callback/google), which sets the
// session cookie itself, so an explicit code exchange is no longer required.
//
// We preserve the route + its 400-on-missing-code contract for any frontend
// still calling it, and report whether a session is now active.
export async function POST(req: Request) {
  let body: { code?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.code) {
    return Response.json(
      { error: "Código de autorização não fornecido" },
      { status: 400 },
    );
  }

  // better-auth has already established (or not) the session via its own
  // callback. Surface the current session state instead of doing a manual
  // token exchange.
  const session = await auth.api.getSession({ headers: req.headers });
  return Response.json({ success: Boolean(session) }, { status: 200 });
}
