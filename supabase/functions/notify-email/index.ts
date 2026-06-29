// Supabase Edge Function: "notify-email"
// Emails clients (who opted in) when there's a new message or update.
// Called from the app via supabase.functions.invoke("notify-email", { body: {...} }).
//
// Secret to set (Edge Functions → notify-email → Secrets):
//   RESEND_API_KEY  – your Resend API key
// Optional: WELCOME_FROM – e.g. "Studio Nicholas <studio@studionicholas.com.au>"

const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("WELCOME_FROM") ?? "Studio Nicholas <info@studionicholas.com.au>";
const STUDIO_EMAIL = Deno.env.get("STUDIO_EMAIL") ?? "info@studionicholas.com.au";
const LOGIN_URL = "https://portal.studionicholas.com.au";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(s: string) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function emailHtml(o: { projectName?: string; heading?: string; body?: string; senderName?: string; time?: string; kind?: string; audience?: string; setupCta?: boolean }) {
  const accent = "#9BACB6"; // brand aqua
  const isStudio = o.audience === "studio";
  const isUpdate = o.kind === "update";
  const eyebrow = isStudio
    ? `${esc(o.projectName || "Studio Nicholas")} &nbsp;·&nbsp; Studio alert`
    : `${esc(o.projectName || "Your project")} &nbsp;·&nbsp; ${isUpdate ? "New update" : "New message"}`;
  const footer = isStudio
    ? "Automated alert from your Studio Nicholas portal."
    : "You're getting this because you asked for email updates on your project. Reply to this email or message us in your portal.";
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F0EC;padding:28px 12px;font-family:Georgia,'Times New Roman',serif;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #efe7df;">
      <tr><td style="height:6px;line-height:6px;font-size:0;background:${accent};">&nbsp;</td></tr>
      <tr><td style="padding:32px 44px 0;text-align:center;">
        <img src="${LOGIN_URL}/logo.png" alt="Studio Nicholas" width="158" style="max-width:158px;height:auto;">
      </td></tr>
      <tr><td style="padding:14px 44px 0;text-align:center;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a9aa3;">${eyebrow}</p>
      </td></tr>
      <tr><td style="padding:6px 44px 0;text-align:center;">
        <h1 style="font-size:24px;font-style:italic;color:#1C1A17;margin:0;font-weight:normal;">${esc(o.heading || (isUpdate ? "New update" : "New message"))}</h1>
      </td></tr>
      <tr><td style="padding:18px 44px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F0EC;border-radius:12px;">
          <tr><td style="padding:16px 18px;border-left:3px solid ${accent};border-top-left-radius:12px;border-bottom-left-radius:12px;">
            <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#44403c;">${esc(o.body || "")}</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#a8a29e;">
              <strong style="color:#576b45;">${esc(o.senderName || "Studio Nicholas")}</strong>${o.time ? " &nbsp;·&nbsp; " + esc(o.time) : ""}
            </p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 44px 6px;text-align:center;">
        <a href="${LOGIN_URL}" style="display:inline-block;background:#1C1A17;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;padding:13px 34px;border-radius:9px;">Open your portal &nbsp;→</a>
      </td></tr>
      ${o.setupCta ? `<tr><td style="padding:6px 44px 6px;text-align:center;">
        <a href="${LOGIN_URL}" style="display:inline-block;background:#ffffff;color:#1C1A17;border:1px solid #9BACB6;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;padding:11px 28px;border-radius:9px;">First time here? Set up your login</a>
      </td></tr>` : ""}
      <tr><td style="padding:16px 44px 30px;text-align:center;">
        <p style="font-size:11px;line-height:1.6;color:#b4a89d;margin:0;font-family:Arial,Helvetica,sans-serif;">${footer}</p>
      </td></tr>
    </table>
    <p style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:#9c958c;margin:14px 0 0;">Studio Nicholas</p>
  </td></tr>
</table>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { toEmails = [], audience, subject, heading, body, projectName, senderName, time, kind, setupCta } = await req.json();
    // Studio alerts go to the studio mailbox (kept server-side); client alerts go
    // to the opted-in recipients passed in.
    const emails =
      audience === "studio"
        ? [STUDIO_EMAIL.toLowerCase()]
        : [...new Set((toEmails || []).map((e: string) => (e || "").toLowerCase()).filter(Boolean))];
    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const html = emailHtml({ projectName, heading, body, senderName, time, kind, audience, setupCta });
    let sent = 0;
    await Promise.all(
      emails.map(async (to) => {
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: FROM, to: [to], reply_to: "info@studionicholas.com.au", subject: subject || "New activity on your project", html }),
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
