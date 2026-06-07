// GET /api/processar-recorrentes-manual
// Original (Mocha) imported ./scheduled and ran processarChamadosRecorrentes(env),
// driven by the Worker's `scheduled` (cron) handler. The scheduled module is not
// part of this import, and Cloudflare cron triggers do not exist on the Next.js
// platform, so the manual trigger cannot execute the original job here.
//
// The route is preserved so callers do not 404; it reports that the recurring
// job must be wired up to a platform scheduler. See migration notes.
export async function GET() {
  return Response.json(
    {
      success: false,
      message:
        "Processamento de recorrentes indisponível: o módulo agendado (scheduled.ts) e o gatilho cron do Cloudflare não foram migrados. Configure um agendador da plataforma para executar este job.",
    },
    { status: 501 },
  );
}
