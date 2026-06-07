// GET /api/test-twilio
// Simple Twilio send test requiring a `phone` query param. No D1/R2 usage —
// ported verbatim from the Worker, reading config from process.env.
export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone");

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!phone)
      return Response.json({ error: "Adicione ?phone=+5511999999999" });
    if (!accountSid)
      return Response.json({ error: "TWILIO_ACCOUNT_SID não configurado" });
    if (!authToken)
      return Response.json({ error: "TWILIO_AUTH_TOKEN não configurado" });
    if (!from)
      return Response.json({ error: "TWILIO_WHATSAPP_NUMBER não configurado" });

    const to = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: "✅ Teste do TicketHPC - funcionando!",
      }),
    });

    const result = await response.json();

    return Response.json({
      success: response.ok,
      status: response.status,
      from,
      to,
      result,
    });
  } catch (error) {
    return Response.json(
      {
        error: String(error),
        message: error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}
