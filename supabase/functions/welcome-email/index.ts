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
const FROM = Deno.env.get("WELCOME_FROM") ?? "Studio Nicholas <info@studionicholas.com.au>";
const LOGIN_URL = "https://portal.studionicholas.com.au";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function emailHtml() {
  const accent = "#9BACB6";
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F0EC;padding:28px 12px;font-family:Georgia,'Times New Roman',serif;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #efe7df;">
      <tr><td style="font-size:0;line-height:0;">
        <img src="${LOGIN_URL}/login.jpg" alt="Studio Nicholas" width="520" height="168" style="width:100%;max-width:520px;height:168px;object-fit:cover;object-position:center;display:block;">
      </td></tr>
      <tr><td style="height:4px;line-height:4px;font-size:0;background:${accent};">&nbsp;</td></tr>
      <tr><td style="padding:30px 44px 0;text-align:center;">
        <img src="${LOGIN_URL}/logo.png" alt="Studio Nicholas" width="160" style="max-width:160px;height:auto;">
      </td></tr>
      <tr><td style="padding:8px 44px 0;text-align:center;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a9aa3;">Welcome</p>
      </td></tr>
      <tr><td style="padding:6px 44px 0;text-align:center;">
        <h1 style="font-size:25px;font-style:italic;color:#1C1A17;margin:0;font-weight:normal;">You're all set</h1>
      </td></tr>
      <tr><td style="padding:14px 44px 0;text-align:center;">
        <p style="font-size:15px;line-height:1.65;color:#57534e;margin:0;font-family:Arial,Helvetica,sans-serif;">
          Your password is set and your private portal is ready. Log in any time to follow your project — updates, timeline, meetings, documents and messages, all in one place.
        </p>
      </td></tr>
      <tr><td style="padding:24px 44px 4px;text-align:center;">
        <a href="${LOGIN_URL}" style="display:inline-block;background:#1C1A17;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;padding:14px 34px;border-radius:9px;">Open your portal &nbsp;→</a>
      </td></tr>
      <tr><td style="padding:18px 44px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F0EC;border-radius:12px;">
          <tr><td style="padding:14px 18px;text-align:center;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8079;font-family:Arial,Helvetica,sans-serif;">
              Save this email for easy access. Your login: <a href="${LOGIN_URL}" style="color:#576b45;text-decoration:none;">${LOGIN_URL.replace("https://", "")}</a><br>
              Tip — add it to your home screen for one-tap access.
            </p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 44px 30px;text-align:center;">
        <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;color:#9c958c;margin:0;">Studio Nicholas</p>
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
        reply_to: "info@studionicholas.com.au",
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
