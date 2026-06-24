-- One-row table holding the studio's Microsoft refresh token.
-- Locked down: no anon/authenticated access. Only the edge function (service
-- role, which bypasses RLS) ever reads or writes it.
create table if not exists microsoft_tokens (
  id int primary key default 1,
  refresh_token text,
  account text,
  updated_at timestamptz default now()
);

alter table microsoft_tokens enable row level security;
-- (no policies on purpose — service role bypasses RLS; everyone else is denied)
