import { auth } from "@/lib/auth";

// GET /api/oauth/google/redirect_url
// Original (Mocha) returned a Google OAuth redirect URL from
// getOAuthRedirectUrl("google", ...). With better-auth we ask the social
// sign-in endpoint for the provider authorization URL and return it under the
// same `redirectUrl` key the frontend already expects.
export async function GET(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const result = await auth.api.signInSocial({
      body: {
        provider: "google",
        callbackURL: `${origin}/`,
      },
      headers: req.headers,
    });

    const redirectUrl = (result as { url?: string })?.url;
    if (!redirectUrl) {
      return Response.json(
        { error: "Não foi possível gerar a URL de autenticação" },
        { status: 500 },
      );
    }

    return Response.json({ redirectUrl }, { status: 200 });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
