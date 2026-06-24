// Supabase Edge Function: "microsoft"
// Connects the studio's Microsoft 365 account (OAuth) and creates/cancels Teams
// meetings + calendar events via Microsoft Graph.
//
// Actions (POST JSON { action, ... }):
//   "connect"     { code }            -> exchange the OAuth code, store refresh token
//   "status"      {}                  -> { connected: bool, account }
//   "disconnect"  {}                  -> clear the stored token
//   "createEvent" { title, instant, message, attendees:[{email,name}] }
//                                     -> { id, joinUrl, webLink }
//   "deleteEvent" { id }              -> cancels the calendar event
//
// Secrets (Edge Functions -> microsoft -> Secrets):
//   MS_CLIENT_ID, MS_TENANT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI
//   (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

const CLIENT_ID = Deno.env.get("MS_CLIENT_ID") ?? "";
const TENANT = Deno.env.get("MS_TENANT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("MS_CLIENT_SECRET") ?? "";
const REDIRECT_URI = Deno.env.get("MS_REDIRECT_URI") ?? "https://portal.studionicholas.com.au";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const SCOPE = "offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite User.Read";
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// --- tiny DB layer (service role REST) ---
const dbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

async function dbGet() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/microsoft_tokens?id=eq.1&select=refresh_token,account`, { headers: dbHeaders });
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function dbSave(refresh_token: string, account: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/microsoft_tokens`, {
    method: "POST",
    headers: { ...dbHeaders, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: 1, refresh_token, account, updated_at: new Date().toISOString() }),
  });
}
async function dbClear() {
  await fetch(`${SUPABASE_URL}/rest/v1/microsoft_tokens?id=eq.1`, { method: "DELETE", headers: dbHeaders });
}

// --- Microsoft OAuth ---
async function exchange(params: Record<string, string>) {
  const body = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope: SCOPE, ...params });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  return r.json();
}

// Get a fresh access token from the stored refresh token (rotating it).
async function freshAccess(): Promise<string | null> {
  const row = await dbGet();
  if (!row?.refresh_token) return null;
  const data = await exchange({ grant_type: "refresh_token", refresh_token: row.refresh_token, redirect_uri: REDIRECT_URI });
  if (!data.access_token) return null;
  if (data.refresh_token) await dbSave(data.refresh_token, row.account || "");
  return data.access_token;
}

function eventBody(o: { title?: string; instant?: string; message?: string; attendees?: { email: string; name?: string }[] }) {
  const startMs = o.instant ? Date.parse(o.instant) : Date.now();
  const fmt = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, ""); // UTC, no millis/Z
  return {
    subject: o.title || "Studio Nicholas meeting",
    body: { contentType: "HTML", content: o.message || "" },
    start: { dateTime: fmt(startMs), timeZone: "UTC" },
    end: { dateTime: fmt(startMs + 60 * 60 * 1000), timeZone: "UTC" },
    attendees: (o.attendees || []).filter((a) => a.email).map((a) => ({ emailAddress: { address: a.email, name: a.name || a.email }, type: "required" })),
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, ...p } = await req.json();

    if (action === "connect") {
      const data = await exchange({ grant_type: "authorization_code", code: p.code, redirect_uri: REDIRECT_URI });
      if (!data.refresh_token) return json({ error: data.error_description || "Could not connect Microsoft." }, 400);
      // Read the account email (best-effort) for display.
      let account = "";
      try {
        const me = await fetch("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${data.access_token}` } }).then((r) => r.json());
        account = me.userPrincipalName || me.mail || "";
      } catch (_e) {}
      await dbSave(data.refresh_token, account);
      return json({ connected: true, account });
    }

    if (action === "status") {
      const row = await dbGet();
      return json({ connected: !!row?.refresh_token, account: row?.account || "" });
    }

    if (action === "disconnect") {
      await dbClear();
      return json({ connected: false });
    }

    if (action === "createEvent") {
      const token = await freshAccess();
      if (!token) return json({ error: "Microsoft not connected" }, 400);
      const r = await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody(p)),
      });
      const data = await r.json();
      if (!r.ok) return json({ error: data.error?.message || "Graph error" }, 400);
      return json({ id: data.id, joinUrl: data.onlineMeeting?.joinUrl || "", webLink: data.webLink || "" });
    }

    if (action === "eventStatus") {
      const token = await freshAccess();
      if (!token || !p.id) return json({ responses: [] });
      const ev = await fetch(`https://graph.microsoft.com/v1.0/me/events/${p.id}?$select=attendees`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
      const responses = (ev.attendees || []).map((a) => ({ email: (a.emailAddress?.address || "").toLowerCase(), response: a.status?.response || "none" }));
      return json({ responses });
    }

    if (action === "deleteEvent") {
      const token = await freshAccess();
      if (!token || !p.id) return json({ ok: false });
      // "cancel" emails the attendees a cancellation notice AND removes the event
      // from the organiser's calendar (moves it to Deleted Items).
      const r = await fetch(`https://graph.microsoft.com/v1.0/me/events/${p.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: p.comment || "This meeting has been cancelled." }),
      });
      // If it can't be cancelled (e.g. already gone), fall back to a plain delete.
      if (!r.ok) await fetch(`https://graph.microsoft.com/v1.0/me/events/${p.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 400);
  }
});
