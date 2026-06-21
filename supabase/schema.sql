-- ===================================================================
-- Studio Nicholas — Client Portal database setup
-- Run this ONCE in Supabase: SQL Editor → New query → paste all → Run.
-- ===================================================================

-- 1) Studio admins: emails of your team who can manage every project.
create table if not exists public.admins (
  email text primary key
);

-- 2) Projects: one row per client project. All the content (name, milestones,
--    meetings, messages, fee proposal, etc.) lives in the `data` JSON column.
create table if not exists public.projects (
  code text primary key,
  client_email text not null default '',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3) Studio settings: a single row holding the studio-wide status note
--    (e.g. "Out of office until Monday").
create table if not exists public.studio_settings (
  id int primary key default 1,
  status text not null default '',
  constraint single_row check (id = 1)
);
insert into public.studio_settings (id, status) values (1, '')
on conflict (id) do nothing;

-- Helper: is the signed-in user a studio admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- Turn on row-level security (every table denies access until a policy allows it).
alter table public.admins enable row level security;
alter table public.projects enable row level security;
alter table public.studio_settings enable row level security;

-- Admins table: only admins may read it.
drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins
  for select using (public.is_admin());

-- Projects — admins can do anything.
drop policy if exists projects_admin_all on public.projects;
create policy projects_admin_all on public.projects
  for all using (public.is_admin()) with check (public.is_admin());

-- Projects — a client can read only their own project (matched by email).
drop policy if exists projects_client_select on public.projects;
create policy projects_client_select on public.projects
  for select using (lower(client_email) = lower(auth.jwt() ->> 'email'));

-- Projects — a client can update only their own project, and cannot reassign it.
drop policy if exists projects_client_update on public.projects;
create policy projects_client_update on public.projects
  for update
  using (lower(client_email) = lower(auth.jwt() ->> 'email'))
  with check (lower(client_email) = lower(auth.jwt() ->> 'email'));

-- Studio settings — any signed-in user can read; only admins can change.
drop policy if exists settings_read on public.studio_settings;
create policy settings_read on public.studio_settings
  for select using (auth.role() = 'authenticated');

drop policy if exists settings_admin_write on public.studio_settings;
create policy settings_admin_write on public.studio_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Realtime: let devices stay in sync when rows change.
do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.studio_settings;
exception when duplicate_object then null; end $$;

-- ===================================================================
-- AFTER running everything above, do these (see SETUP.md for clicks):
--
-- 1) Add yourself as an admin (use your studio email):
--      insert into public.admins (email) values ('studio@studionicholas.com.au');
--
-- 2) Create login accounts in: Authentication → Users → Add user
--      - your studio admin email + a password
--      - each client's email + a password
--
-- 3) Sign in to the app as the studio and create a project for each client,
--    setting the project's "client login email" to match the user you made.
-- ===================================================================
