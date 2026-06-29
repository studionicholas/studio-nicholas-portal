import { supabase, inviteType } from "./supabase";

// True when the user arrived via an invite or password-reset link and must set a password.
export const needsPasswordSetup = inviteType === "invite" || inviteType === "recovery";

// True only for a brand-new invited client setting their password for the first
// time (not an existing client resetting it). Used to ping the studio once the
// account is live.
export const isInviteSetup = inviteType === "invite";

export async function setPassword(password) {
  return supabase.auth.updateUser({ password });
}

// Best-effort "your portal is ready" confirmation email (sent via the
// welcome-email Edge Function + Resend). Never blocks the UI.
export async function sendSetupEmail(email) {
  try {
    await supabase.functions.invoke("welcome-email", { body: { email } });
  } catch (e) {
    console.error("welcome email failed", e);
  }
}

// Reliable onboarding email (via the welcome-email Edge Function + Resend, NOT
// Supabase's flaky auth SMTP): tells a newly-added client/builder to go to the
// portal and "Set up your login". Returns { ok, error } so the UI can show it.
export async function sendLoginSetupEmail(email, { name, projectName } = {}) {
  try {
    const { data, error } = await supabase.functions.invoke("welcome-email", { body: { email: (email || "").trim(), kind: "setup", name, projectName } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { ok: true };
  } catch (e) {
    console.error("setup email failed", e);
    return { ok: false, error: e?.message || String(e) };
  }
}

/* ----------------------------------------------------------------
   Data + auth layer.
   The UI works with a `projects` object keyed by project code, where
   each value is the full project (name, milestones, meetings, messages…).
   In the database, each project is one row: { code, client_email, data }.
   These helpers translate between the two shapes.
------------------------------------------------------------------*/

/* ---------- Auth ---------- */

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// Lowercase the email so a phone auto-capitalising the first letter (or any
// stray case) can't cause a false "invalid credentials".
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email: (email || "").trim().toLowerCase(), password });
}

// Self-service account creation: a client whose email is on a project can set up
// their own login (email + password) instead of waiting for an invite. Access to
// data is still gated by Row Level Security (their email must be on a project),
// so signing up with an unknown email shows nothing.
export async function signUp(email, password) {
  return supabase.auth.signUp({ email: (email || "").trim().toLowerCase(), password });
}

// Send a password-reset email. The link returns to the portal with
// type=recovery, which routes to the "set a new password" screen.
export async function resetPassword(email) {
  return supabase.auth.resetPasswordForEmail((email || "").trim().toLowerCase(), {
    redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// Resend the "confirm your email" link (for clients who didn't get it / lost it).
export async function resendConfirmation(email) {
  return supabase.auth.resend({ type: "signup", email: (email || "").trim() });
}

// True if the signed-in user is a studio admin (listed in the `admins` table).
export async function isAdmin() {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("is_admin failed", error);
    return false;
  }
  return !!data;
}

/* ---------- Projects ---------- */

export async function fetchProjects() {
  const { data, error } = await supabase.from("projects").select("code, client_email, data");
  if (error) throw error;
  const out = {};
  (data || []).forEach((row) => {
    out[row.code] = { ...(row.data || {}), code: row.code, clientEmail: row.client_email || "" };
  });
  return out;
}

// Lightweight "has anything changed?" check — pulls only codes + timestamps
// (a few bytes) instead of the whole heavy record, so idle polling is cheap.
export async function fetchProjectStamps() {
  const { data, error } = await supabase.from("projects").select("code, updated_at");
  if (error) throw error;
  const out = {};
  (data || []).forEach((r) => {
    out[r.code] = r.updated_at || "";
  });
  return out;
}

// All participant login emails on a project (clients + builders, lowercased) —
// used for access rules (RLS). Builder logins live in project.builderUsers as an
// array of { name, email }; the separate project.builders text field (a company
// name shown on the About tab) is unrelated and left alone.
function clientEmailsOf(project) {
  const list = (project.clients || []).map((c) => (c.email || "").trim().toLowerCase()).filter(Boolean);
  list.push(...(project.builderUsers || []).map((b) => (b && b.email ? b.email.trim().toLowerCase() : "")).filter(Boolean));
  if (list.length === 0 && project.clientEmail) list.push(project.clientEmail.trim().toLowerCase());
  return [...new Set(list)];
}

// Update an EXISTING project row. Works for both the studio (any project) and a
// client (a project they're a member of) — neither needs permission to create rows.
export async function saveProject(code, project) {
  const { code: _omitCode, clientEmail, ...rest } = project;
  const emails = clientEmailsOf(project);
  const { error } = await supabase
    .from("projects")
    .update({ client_email: emails[0] || "", client_emails: emails, data: rest, updated_at: new Date().toISOString() })
    .eq("code", code);
  if (error) throw error;
}

// Create a NEW project row (studio admin only — clients can't reach this path).
export async function createProject(code, project) {
  const { code: _omitCode, clientEmail, ...rest } = project;
  const emails = clientEmailsOf(project);
  const { error } = await supabase.from("projects").insert({
    code,
    client_email: emails[0] || "",
    client_emails: emails,
    data: rest,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/* ---------- Media storage ---------- */

// Upload a Blob/File to the public "project-media" bucket and return its URL.
// Storing URLs (instead of base64 inside the project record) keeps rows small.
export async function uploadMedia(blob, ext = "jpg") {
  const path = `media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("project-media")
    .upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
  if (error) throw error;
  return supabase.storage.from("project-media").getPublicUrl(path).data.publicUrl;
}

export async function deleteProject(code) {
  const { error } = await supabase.from("projects").delete().eq("code", code);
  if (error) throw error;
}

/* ---------- Studio status note ---------- */

// All studio-wide settings (status note + login-page photo/message). Publicly
// readable so the login page can show the photo/message before anyone signs in.
export async function fetchSettings() {
  const { data, error } = await supabase
    .from("studio_settings")
    .select("status, status_color, login_image, login_message, studio_info, autoreply")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("fetchSettings failed", error);
    return { text: "", color: "", loginImage: "", loginMessage: "", studioInfo: null, autoReply: null };
  }
  return {
    text: data?.status || "",
    color: data?.status_color || "",
    loginImage: data?.login_image || "",
    loginMessage: data?.login_message || "",
    studioInfo: data?.studio_info || null,
    autoReply: data?.autoreply || null,
  };
}

export async function saveAutoReply(config) {
  const { error } = await supabase.from("studio_settings").upsert({ id: 1, autoreply: config });
  if (error) throw error;
}

// Lightweight settings fetch (everything EXCEPT the big login image) so clients
// can poll for status-note / auto-note changes cheaply.
export async function fetchSettingsLite() {
  const { data, error } = await supabase
    .from("studio_settings")
    .select("status, status_color, login_message, studio_info, autoreply")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("fetchSettingsLite failed", error);
    return null;
  }
  return {
    text: data?.status || "",
    color: data?.status_color || "",
    loginMessage: data?.login_message || "",
    studioInfo: data?.studio_info || null,
    autoReply: data?.autoreply || null,
  };
}

export async function saveStudioInfo(info) {
  const { error } = await supabase.from("studio_settings").upsert({ id: 1, studio_info: info });
  if (error) throw error;
}

export async function saveStudioStatus(text, color) {
  const { error } = await supabase.from("studio_settings").upsert({ id: 1, status: text, status_color: color || "" });
  if (error) console.error("saveStudioStatus failed", error);
}

export async function saveLoginSettings(loginImage, loginMessage) {
  const { error } = await supabase.from("studio_settings").upsert({ id: 1, login_image: loginImage || "", login_message: loginMessage || "" });
  if (error) throw error;
}

/* ---------- Realtime sync ---------- */

// Calls `callback` whenever any project changes (on any device).
export function subscribeProjects(callback) {
  const channel = supabase
    .channel("projects-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "studio_settings" }, callback)
    .subscribe();
  return channel;
}

/* ---------- Push notifications ---------- */

// Public half of the VAPID keypair (safe to ship). The private half lives only
// in the Supabase "notify" Edge Function secret.
const VAPID_PUBLIC_KEY = "BGA3zFN-rN2qAyZbiG2h8BYG5_e-xj4WAdqx_YdukKMF4GHcGAnzUutUhrUpVU_V-QWsQWCARzczKVekTgR-vbg";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : "unsupported";
}

// Ask permission + subscribe THIS device, storing the subscription against the
// signed-in user's email. Returns true if notifications are now on.
export async function enablePush(email) {
  if (!pushSupported()) throw new Error("This device doesn't support notifications.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  }
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ email: (email || "").trim().toLowerCase(), endpoint: sub.endpoint, subscription: sub.toJSON() }, { onConflict: "endpoint" });
  if (error) {
    console.error("save push subscription failed", error);
    throw error;
  }
  return true;
}

// Tell the studio (via push) that a client has finished setting up their account
// and set a password — so the studio knows they can now message that client and
// the message will be received. Best-effort; never blocks the client's flow.
export async function notifyStudioClientReady(email) {
  const who = (email || "").trim();
  return notifyPush({
    toStudio: true,
    title: "Client account ready ✓",
    body: who ? `${who} has set their password — you can message them now.` : "A client has set up their portal — you can message them now.",
    url: "/",
  });
}

// Best-effort push to the recipients (the studio, or specific client emails).
// Never throws to the UI — if the function isn't deployed yet it just logs.
export async function notifyPush({ toEmails, toStudio, title, body, url }) {
  try {
    await supabase.functions.invoke("Notify", { body: { toEmails: toEmails || [], toStudio: !!toStudio, title, body, url: url || "/" } });
  } catch (e) {
    console.error("notify failed", e);
  }
}

/* ---------- Microsoft 365 / Teams ---------- */

// Public app identifiers (safe in the browser — the secret lives only in the
// Supabase function). See [[studio-nicholas-teams]].
const MS_CLIENT_ID = "e56d9dec-7b3f-422c-a424-3bd19533c81b";
const MS_TENANT_ID = "5a0b4512-351c-4fc1-9389-afba9973b445";
const MS_REDIRECT = typeof window !== "undefined" ? window.location.origin : "https://portal.studionicholas.com.au";

// The Microsoft sign-in/consent URL the studio is sent to when connecting.
export function microsoftAuthUrl(state) {
  const scope = "offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite User.Read";
  const q = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: MS_REDIRECT,
    response_mode: "query",
    scope,
    state: state || "",
  });
  return `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${q.toString()}`;
}

export async function microsoftConnect(code) {
  const { data, error } = await supabase.functions.invoke("microsoft", { body: { action: "connect", code } });
  if (error) throw error;
  return data;
}
export async function microsoftStatus() {
  try {
    const { data } = await supabase.functions.invoke("microsoft", { body: { action: "status" } });
    return data || { connected: false };
  } catch (e) {
    return { connected: false };
  }
}
export async function microsoftDisconnect() {
  await supabase.functions.invoke("microsoft", { body: { action: "disconnect" } });
}
// Create a Teams meeting + calendar event; returns { id, joinUrl, webLink }.
export async function microsoftCreateEvent({ title, instant, message, attendees }) {
  const { data, error } = await supabase.functions.invoke("microsoft", { body: { action: "createEvent", title, instant, message, attendees } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
export async function microsoftDeleteEvent(id) {
  try {
    await supabase.functions.invoke("microsoft", { body: { action: "deleteEvent", id } });
  } catch (e) {
    console.error("ms delete event failed", e);
  }
}
// Read attendees' calendar responses for a Teams event → [{ email, response }].
export async function microsoftEventStatus(id) {
  try {
    const { data } = await supabase.functions.invoke("microsoft", { body: { action: "eventStatus", id } });
    return data?.responses || [];
  } catch (e) {
    return [];
  }
}

/* ---------- Fee-proposal e-signature ---------- */

// Ask the server for an authoritative IP + timestamp (and a document id) at the
// moment of signing, so the certificate's audit trail can't be forged in the
// browser. Returns { ip, time, id } or null if the function isn't reachable.
export async function signAudit() {
  try {
    const { data, error } = await supabase.functions.invoke("sign-proposal", { body: { action: "audit" } });
    if (error) throw error;
    return data || null;
  } catch (e) {
    console.error("sign audit failed", e);
    return null;
  }
}

// Email the finished signed PDF (as an attachment) to the client and the studio.
// Best-effort; never blocks the signing flow.
export async function sendSignedProposal({ pdfUrl, pdfBase64, fileName, clientEmail, clientName, projectName, signedAtLabel }) {
  try {
    await supabase.functions.invoke("sign-proposal", {
      body: { action: "send", pdfUrl, pdfBase64, fileName, clientEmail, clientName, projectName, signedAtLabel },
    });
  } catch (e) {
    console.error("send signed proposal failed", e);
  }
}

// Email the studio mailbox (info@) when something needs the studio's attention —
// a client activating their account, signing, or sending a message. Reliable
// backstop to push (which only lands if the studio device is subscribed).
export async function notifyStudioEmail({ subject, heading, body, projectName, time }) {
  try {
    await supabase.functions.invoke("notify-email", {
      body: { audience: "studio", subject, heading, body, projectName, time },
    });
  } catch (e) {
    console.error("notify studio email failed", e);
  }
}

// Tell the studio (push) that a client has signed their fee proposal.
export async function notifyStudioProposalSigned({ clientName, projectName }) {
  return notifyPush({
    toStudio: true,
    title: "Fee proposal signed ✓",
    body: `${clientName || "A client"} signed the proposal${projectName ? ` for ${projectName}` : ""}.`,
    url: "/",
  });
}

// Best-effort email to clients who opted in to email updates.
export async function notifyEmail({ toEmails, subject, heading, body, projectName, senderName, time, kind }) {
  if (!toEmails || toEmails.length === 0) return;
  try {
    await supabase.functions.invoke("notify-email", { body: { toEmails, subject, heading, body, projectName, senderName, time, kind } });
  } catch (e) {
    console.error("notify-email failed", e);
  }
}
