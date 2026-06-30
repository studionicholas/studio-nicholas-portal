// Supabase Edge Function: "email-webhook"
// Receives Resend webhook events. When an email bounces, it records the address
// in `bounced_emails` and emails the studio a heads-up, so a bad address flags
// itself instead of needing a manual dig through Resend logs.
//
// Secrets: RESEND_API_KEY, WELCOME_FROM (optional), STUDIO_EMAIL (optional),
//          WEBHOOK_SECRET (a random string you put in the webhook URL as ?key=…).
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are provided automatically.

const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("WELCOME_FROM") ?? "Studio Nicholas <info@studionicholas.com.au>";
const STUDIO_EMAIL = Deno.env.get("STUDIO_EMAIL") ?? "info@studionicholas.com.au";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Simple shared-secret check (the webhook URL includes ?key=…).
  if (SECRET) {
    const key = new URL(req.url).searchParams.get("key");
    if (key !== SECRET) return new Response("unauthorized", { status: 401 });
  }
  try {
    const evt = await req.json();
    if (evt?.type === "email.bounced") {
      const toList = Array.isArray(evt.data?.to) ? evt.data.to : evt.data?.to ? [evt.data.to] : [];
      const to = toList.join(", ");
      const email = (toList[0] || "").toLowerCase();
      const reason = String(evt.data?.bounce?.message || evt.data?.bounce?.subType || "Address could not be reached").slice(0, 300);

      if (email && SUPABASE_URL && SERVICE_KEY) {
        await fetch(`${SUPABASE_URL}/rest/v1/bounced_emails`, {
          method: "POST",
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ email, reason, created_at: new Date().toISOString() }),
        });
      }

      if (RESEND) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM,
            to: [STUDIO_EMAIL],
            reply_to: STUDIO_EMAIL,
            subject: `⚠️ Email bounced — ${to}`,
            html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1C1A17;line-height:1.6;"><p>An email to <strong>${to}</strong> couldn't be delivered.</p><p style="color:#811618;">${reason}</p><p>Double-check the address is correct in the portal back end (Client / Builder logins), fix it if needed, and re-send the login link. The address is now flagged in your back end too.</p><p style="color:#9c958c;font-size:13px;">Studio Nicholas portal</p></div>`,
          }),
        });
      }
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    // Always 200 so Resend doesn't keep retrying a malformed event.
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
