import { supabase, inviteType } from "./supabase";

// True when the user arrived via an invite or password-reset link and must set a password.
export const needsPasswordSetup = inviteType === "invite" || inviteType === "recovery";

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

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email: (email || "").trim(), password });
}

// Send a password-reset email. The link returns to the portal with
// type=recovery, which routes to the "set a new password" screen.
export async function resetPassword(email) {
  return supabase.auth.resetPasswordForEmail((email || "").trim(), {
    redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
  });
}

export async function signOut() {
  return supabase.auth.signOut();
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

// The list of client login emails on a project (lowercased) — used for access rules.
function clientEmailsOf(project) {
  const list = (project.clients || []).map((c) => (c.email || "").trim().toLowerCase()).filter(Boolean);
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

// Best-effort push to the recipients (the studio, or specific client emails).
// Never throws to the UI — if the function isn't deployed yet it just logs.
export async function notifyPush({ toEmails, toStudio, title, body, url }) {
  try {
    await supabase.functions.invoke("Notify", { body: { toEmails: toEmails || [], toStudio: !!toStudio, title, body, url: url || "/" } });
  } catch (e) {
    console.error("notify failed", e);
  }
}

// Best-effort email to clients who opted in to email updates.
export async function notifyEmail({ toEmails, subject, heading, body }) {
  if (!toEmails || toEmails.length === 0) return;
  try {
    await supabase.functions.invoke("notify-email", { body: { toEmails, subject, heading, body } });
  } catch (e) {
    console.error("notify-email failed", e);
  }
}
