-- Records email addresses that bounced (fed by the Resend webhook), so the back
-- end can flag a bad address. Writes happen via the service role (edge function);
-- the studio just reads it.
create table if not exists bounced_emails (
  email text primary key,
  reason text,
  created_at timestamptz default now()
);
alter table bounced_emails enable row level security;

drop policy if exists "bounced_emails read" on bounced_emails;
create policy "bounced_emails read" on bounced_emails
  for select to authenticated using (true);
