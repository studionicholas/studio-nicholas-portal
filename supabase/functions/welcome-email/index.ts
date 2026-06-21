// Supabase Edge Function: "welcome-email"
// Sends a branded "your portal is ready" email (via Resend) after a client
// finishes setting their password. Called from the app via
// supabase.functions.invoke("welcome-email", { body: { email } }).
//
// Secret to set (Edge Functions → welcome-email → Secrets):
//   RESEND_API_KEY  – your Resend API key (the same one used for SMTP)
// Optional:
//   WELCOME_FROM    – e.g. "Studio Nicholas <studio@studionicholas.com.au>"

const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("WELCOME_FROM") ?? "Studio Nicholas <studio@studionicholas.com.au>";
const LOGIN_URL = "https://portal.studionicholas.com.au";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function emailHtml() {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F0EC;padding:32px 0;font-family:Georgia,serif;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;">
      <tr><td style="padding:36px 40px 8px;text-align:center;">
        <img src="${LOGIN_URL}/logo.png" alt="Studio Nicholas" width="180" style="max-width:180px;height:auto;">
      </td></tr>
      <tr><td style="padding:16px 40px 0;">
        <h1 style="font-size:22px;font-style:italic;color:#1C1A17;margin:0 0 12px;font-weight:normal;">You're all set</h1>
        <p style="font-size:15px;line-height:1.6;color:#57534e;margin:0 0 24px;font-family:Arial,sans-serif;">
          Your password is set and your Studio Nicholas portal is ready. You can log in any time to see your project updates, timeline, meetings, documents and messages. Save this email so you always have the link handy.
        </p>
      </td></tr>
      <tr><td style="padding:0 40px 28px;text-align:center;">
        <a href="${LOGIN_URL}" style="display:inline-block;background:#1C1A17;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;padding:14px 32px;border-radius:8px;">Open your portal</a>
      </td></tr>
      <tr><td style="padding:0 40px 36px;">
        <p style="font-size:12px;line-height:1.6;color:#a8a29e;margin:0;font-family:Arial,sans-serif;">
          Your login page: <a href="${LOGIN_URL}" style="color:#B7453C;">${LOGIN_URL.replace("https://", "")}</a><br>
          Tip: add it to your home screen for one-tap access.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "no email" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: "Your Studio Nicholas portal is ready",
        html: emailHtml(),
      }),
    });
    const data = await r.json();
    return new Response(JSON.stringify(data), { status: r.ok ? 200 : 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
