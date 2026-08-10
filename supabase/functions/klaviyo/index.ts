// Supabase Edge Function: "klaviyo"
// Reads (server-side, with the PRIVATE Klaviyo key) who has opted in to marketing
// emails via the portal — i.e. the members of the "Portal Sign up" list. The
// private key must never ship in the browser bundle, so this function is the only
// place it lives. See [[studio-nicholas-portal]].
//
// Action (POST JSON { action }):
//   "listMembers"  -> { configured, list, members: [{ email, name, consent, since }] }
//
// Secrets (Edge Functions -> klaviyo -> Secrets):
//   KLAVIYO_PRIVATE_KEY   – Klaviyo → Settings → API keys → "Create Private API Key"
//                           (read-only "Lists" + "Profiles" scopes are enough)
//   KLAVIYO_LIST_ID       – optional; defaults to the portal sign-up list below

const PRIVATE_KEY = Deno.env.get("KLAVIYO_PRIVATE_KEY") ?? "";
const LIST_ID = Deno.env.get("KLAVIYO_LIST_ID") ?? "TKWRew"; // "Portal Sign up"
const REVISION = "2024-10-15";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function kHeaders() {
  return {
    Authorization: `Klaviyo-API-Key ${PRIVATE_KEY}`,
    accept: "application/json",
    revision: REVISION,
  };
}

// Pull every profile on the list (following pagination), newest opt-in first.
async function listMembers() {
  const members: { email: string; name: string; consent: string; since: string }[] = [];
  let url =
    `https://a.klaviyo.com/api/lists/${LIST_ID}/profiles/` +
    `?additional-fields[profile]=subscriptions&page[size]=100`;
  let guard = 0;
  while (url && guard < 20) {
    guard++;
    const r = await fetch(url, { headers: kHeaders() });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`Klaviyo ${r.status}: ${body.slice(0, 200)}`);
    }
    const data = await r.json();
    for (const p of data.data || []) {
      const a = p.attributes || {};
      const mk = a.subscriptions?.email?.marketing || {};
      const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
      members.push({
        email: a.email || "",
        name,
        consent: mk.consent || "",
        since: mk.consent_timestamp || a.joined_group_at || a.created || "",
      });
    }
    url = data.links?.next || "";
  }
  // Newest first.
  members.sort((x, y) => (y.since || "").localeCompare(x.since || ""));
  return members;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!PRIVATE_KEY) return json({ configured: false, list: LIST_ID, members: [] });
    const { action } = await req.json().catch(() => ({ action: "listMembers" }));
    if (action === "listMembers" || !action) {
      const members = await listMembers();
      return json({ configured: true, list: LIST_ID, members });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ configured: true, error: String(e?.message || e), members: [] }, 200);
  }
});
