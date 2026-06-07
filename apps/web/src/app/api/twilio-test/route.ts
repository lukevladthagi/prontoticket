// GET /api/twilio-test
// Direct Twilio send test. No D1/R2 usage — ported verbatim from the Worker,
// reading config from process.env and the `phone` query param.
export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone") || "+15557903312";

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_NUMBER;

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
        Body: "✅ Teste TicketHPC",
      }),
    });

    const result = await response.json();

    return Response.json({
      ok: response.ok,
      status: response.status,
      from,
      to,
      twilio: result,
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
