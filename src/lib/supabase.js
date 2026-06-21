import { createClient } from "@supabase/supabase-js";

// Public Supabase project URL + anon key. These are SAFE to ship in the browser
// bundle (that's what the anon key is for — access is gated by Row Level Security).
// Hardcoded as fallbacks so the app always connects even if the host's build-time
// env vars aren't set; local dev can still override them via a .env file.
const url = import.meta.env.VITE_SUPABASE_URL || "https://dxzqgoisiqflpgmirzkx.supabase.co";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4enFnb2lzaXFmbHBnbWlyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODE1NTMsImV4cCI6MjA5NzU1NzU1M30.Lk7Lp9kjBotjN1FoQ-Ebm-F8vcfaDLav1vYvO71AH_0";

// Capture the auth flow type from the URL hash BEFORE the client consumes it
// (invite links arrive as #access_token=...&type=invite).
let _inviteType = null;
try {
  _inviteType = new URLSearchParams((window.location.hash || "").replace(/^#/, "")).get("type");
} catch (e) {
  _inviteType = null;
}
export const inviteType = _inviteType;

export const supabase = createClient(url, anon);
