import { auth } from "@/lib/auth";

// GET /api/logout
// Original (Mocha) deleted the session and cleared the MOCHA_SESSION_TOKEN
// cookie. With better-auth we call signOut, which both revokes the session and
// returns the Set-Cookie headers that clear the session cookie.
export async function GET(req: Request) {
  try {
    const res = await auth.api.signOut({
      headers: req.headers,
      asResponse: true,
    });
    return res;
  } catch {
    // signOut throws if there is no active session; treat as already logged out.
    return Response.json({ success: true }, { status: 200 });
  }
}
