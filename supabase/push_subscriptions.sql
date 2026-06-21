-- Push notification subscriptions (one row per device that opted in).
-- Run this in Supabase → SQL Editor.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

-- A logged-in user may add / update / read only their OWN device subscription.
-- (The "notify" Edge Function uses the service-role key and bypasses RLS to read
--  everyone's subscriptions when sending.)
drop policy if exists "insert own subscription" on public.push_subscriptions;
create policy "insert own subscription" on public.push_subscriptions
  for insert to authenticated
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "update own subscription" on public.push_subscriptions;
create policy "update own subscription" on public.push_subscriptions
  for update to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "read own subscription" on public.push_subscriptions;
create policy "read own subscription" on public.push_subscriptions
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));
