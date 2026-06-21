import { supabase } from "./supabase";

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
    .select("status, status_color, login_image, login_message")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("fetchSettings failed", error);
    return { text: "", color: "", loginImage: "", loginMessage: "" };
  }
  return {
    text: data?.status || "",
    color: data?.status_color || "",
    loginImage: data?.login_image || "",
    loginMessage: data?.login_message || "",
  };
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
