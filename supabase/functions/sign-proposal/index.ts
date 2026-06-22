// Supabase Edge Function: "sign-proposal"
// Two jobs for the in-portal fee-proposal e-signature (see the portal app):
//   action "audit" -> returns an authoritative { ip, time, id } captured server
//                     side, so the certificate's audit trail can't be forged in
//                     the browser.
//   action "send"  -> emails the finished signed PDF (as an attachment) to the
//                     client and the studio, via Resend.
//
// Secret required (Edge Functions -> sign-proposal -> Secrets, or project-wide):
//   RESEND_API_KEY  - the same Resend key the other functions use.

const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("WELCOME_FROM") ?? "Studio Nicholas <info@studionicholas.com.au>";
const STUDIO_EMAIL = Deno.env.get("STUDIO_EMAIL") ?? "info@studionicholas.com.au";
const LOGIN_URL = "https://portal.studionicholas.com.au";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function emailHtml(o: { clientName?: string; projectName?: string; signedAtLabel?: string }) {
  const accent = "#9BACB6";
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F0EC;padding:28px 12px;font-family:Georgia,'Times New Roman',serif;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #efe7df;">
      <tr><td style="height:6px;line-height:6px;font-size:0;background:${accent};">&nbsp;</td></tr>
      <tr><td style="padding:32px 44px 0;text-align:center;">
        <img src="${LOGIN_URL}/logo.png" alt="Studio Nicholas" width="158" style="max-width:158px;height:auto;">
      </td></tr>
      <tr><td style="padding:14px 44px 0;text-align:center;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a9aa3;">${o.projectName ? String(o.projectName) : "Your project"} &nbsp;·&nbsp; Signed</p>
      </td></tr>
      <tr><td style="padding:6px 44px 0;text-align:center;">
        <h1 style="font-size:24px;font-style:italic;color:#1C1A17;margin:0;font-weight:normal;">Your signed proposal</h1>
      </td></tr>
      <tr><td style="padding:14px 44px 0;text-align:center;">
        <p style="font-size:15px;line-height:1.65;color:#57534e;margin:0;font-family:Arial,Helvetica,sans-serif;">
          Thank you${o.clientName ? ", " + String(o.clientName) : ""} — your fee proposal is signed and accepted. Your signed copy is attached to this email as a PDF, including the Certificate of Completion.${o.signedAtLabel ? " Signed " + String(o.signedAtLabel) + "." : ""}
        </p>
      </td></tr>
      <tr><td style="padding:24px 44px 4px;text-align:center;">
        <a href="${LOGIN_URL}" style="display:inline-block;background:#1C1A17;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;padding:13px 34px;border-radius:9px;">Open your portal &nbsp;&rarr;</a>
      </td></tr>
      <tr><td style="padding:16px 44px 30px;text-align:center;">
        <p style="font-size:11px;line-height:1.6;color:#b4a89d;margin:0;font-family:Arial,Helvetica,sans-serif;">You can also view or download your signed proposal any time from the Fee tab in your portal.</p>
      </td></tr>
    </table>
    <p style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:#9c958c;margin:14px 0 0;">Studio Nicholas</p>
  </td></tr>
</table>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "audit") {
      const now = new Date();
      const id = `SN-${now.getUTCFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      return json({ ip: clientIp(req), time: now.toISOString(), id });
    }

    if (action === "send") {
      const { pdfUrl, pdfBase64, fileName, clientEmail, clientName, projectName, signedAtLabel } = body;

      // Resolve the PDF bytes -> base64 (either fetched from storage or passed inline).
      let content = pdfBase64 || "";
      if (!content && pdfUrl) {
        const r = await fetch(pdfUrl);
        if (!r.ok) return json({ error: "could not fetch signed pdf" }, 400);
        content = bytesToBase64(new Uint8Array(await r.arrayBuffer()));
      }
      if (!content) return json({ error: "no pdf provided" }, 400);

      const recipients = [clientEmail, STUDIO_EMAIL].filter((e: string) => !!e);
      const attachments = [{ filename: fileName || "Signed Proposal.pdf", content }];
      const html = emailHtml({ clientName, projectName, signedAtLabel });
      const subject = `Your signed fee proposal${projectName ? " — " + projectName : ""}`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: recipients, reply_to: STUDIO_EMAIL, subject, html, attachments }),
      });
      const data = await res.json();
      return json(data, res.ok ? 200 : 400);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 400);
  }
});
