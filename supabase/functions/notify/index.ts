// Supabase Edge Function: "notify"
// Sends a web-push notification to the studio and/or specific client emails.
// Called from the app via supabase.functions.invoke("notify", { body: {...} }).
//
// Secrets to set (Edge Functions → notify → Secrets):
//   VAPID_PUBLIC_KEY   – the public VAPID key (same one in src/lib/api.js)
//   VAPID_PRIVATE_KEY  – the private VAPID key (keep secret!)
//   VAPID_SUBJECT      – e.g. mailto:info@studionicholas.com.au
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@studionicholas.com.au";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { toEmails = [], toStudio = false, title, body, url } = await req.json();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let emails: string[] = (toEmails || []).map((e: string) => (e || "").toLowerCase());
    if (toStudio) {
      const { data: admins } = await admin.from("admins").select("email");
      emails = emails.concat((admins || []).map((a: { email: string }) => (a.email || "").toLowerCase()));
    }
    emails = [...new Set(emails.filter(Boolean))];
    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: subs } = await admin.from("push_subscriptions").select("endpoint, subscription").in("email", emails);
    const payload = JSON.stringify({ title: title || "Studio Nicholas", body: body || "", url: url || "/" });

    let sent = 0;
    await Promise.all(
      (subs || []).map(async (s: { endpoint: string; subscription: unknown }) => {
        try {
          await webpush.sendNotification(s.subscription, payload);
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      })
    );

    return new Response(JSON.stringify({ sent }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
