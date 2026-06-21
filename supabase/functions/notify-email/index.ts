// Supabase Edge Function: "notify-email"
// Emails clients (who opted in) when there's a new message or update.
// Called from the app via supabase.functions.invoke("notify-email", { body: {...} }).
//
// Secret to set (Edge Functions → notify-email → Secrets):
//   RESEND_API_KEY  – your Resend API key
// Optional: WELCOME_FROM – e.g. "Studio Nicholas <studio@studionicholas.com.au>"

const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("WELCOME_FROM") ?? "Studio Nicholas <studio@studionicholas.com.au>";
const LOGIN_URL = "https://portal.studionicholas.com.au";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function emailHtml(heading: string, body: string) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F0EC;padding:32px 0;font-family:Georgia,serif;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;">
      <tr><td style="padding:36px 40px 8px;text-align:center;">
        <img src="${LOGIN_URL}/logo.png" alt="Studio Nicholas" width="170" style="max-width:170px;height:auto;">
      </td></tr>
      <tr><td style="padding:14px 40px 0;">
        <h1 style="font-size:21px;font-style:italic;color:#1C1A17;margin:0 0 10px;font-weight:normal;">${heading}</h1>
        <p style="font-size:15px;line-height:1.6;color:#57534e;margin:0 0 22px;font-family:Arial,sans-serif;">${body}</p>
      </td></tr>
      <tr><td style="padding:0 40px 28px;text-align:center;">
        <a href="${LOGIN_URL}" style="display:inline-block;background:#1C1A17;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;padding:13px 30px;border-radius:8px;">Open your portal</a>
      </td></tr>
      <tr><td style="padding:0 40px 34px;">
        <p style="font-size:11px;line-height:1.6;color:#a8a29e;margin:0;font-family:Arial,sans-serif;">You're getting this because you asked for email updates on your project. Reply in the portal, not to this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { toEmails = [], subject, heading, body } = await req.json();
    const emails = [...new Set((toEmails || []).map((e: string) => (e || "").toLowerCase()).filter(Boolean))];
    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const html = emailHtml(heading || "You have a new update", body || "");
    let sent = 0;
    await Promise.all(
      emails.map(async (to) => {
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: FROM, to: [to], subject: subject || "New activity on your project", html }),
          });
          if (r.ok) sent++;
        } catch (_e) {
          // ignore individual failures
        }
      })
    );
    return new Response(JSON.stringify({ sent }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
