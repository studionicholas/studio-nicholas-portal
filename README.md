# Studio Nicholas — Client Portal

A client portal for Studio Nicholas: per-client logins, project updates, a timeline,
meetings with RSVP, a fee proposal, and messaging — backed by Supabase so data syncs
across devices.

## Quick start
See **[SETUP.md](./SETUP.md)** for click-by-click instructions. In short:

1. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. Add your studio email to the `admins` table and create user accounts (Authentication → Users).
3. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key.
4. `npm install` then `npm run dev`.

## Tech
- React + Vite + Tailwind (via CDN-free build)
- Supabase: Postgres (data), Auth (logins), Row Level Security (per-client access), Realtime (sync)

## Project shape
- `src/ClientPortal.jsx` — the whole UI (client dashboard + studio admin) and the app root.
- `src/lib/supabase.js` — Supabase client, configured from `.env`.
- `src/lib/api.js` — auth + data access (the only place that talks to the database).
- `supabase/schema.sql` — database tables, access rules, and realtime setup.

## Notes / future work
- Files (fee proposal, signed copy, update photos) are currently stored inline as data
  URLs inside each project row. That's fine for small PDFs/images; for larger files, move
  them to Supabase Storage (a follow-up).
- Client provisioning is manual (create the user in Supabase, then a matching project).
  A one-click "invite client" flow can be added later via a Supabase Edge Function.
