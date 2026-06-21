import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Helpful message if the .env file hasn't been filled in yet.
  console.error(
    "Supabase isn't configured. Copy .env.example to .env and paste in your project URL and anon key (Supabase → Project Settings → API)."
  );
}

// Capture the auth flow type from the URL hash BEFORE the client consumes it
// (invite links arrive as #access_token=...&type=invite).
let _inviteType = null;
try {
  _inviteType = new URLSearchParams((window.location.hash || "").replace(/^#/, "")).get("type");
} catch (e) {
  _inviteType = null;
}
export const inviteType = _inviteType;

export const supabase = createClient(url || "https://placeholder.supabase.co", anon || "placeholder-anon-key");
