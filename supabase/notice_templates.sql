-- Adds the studio-editable formal-notice templates (Settings → Formal notice
-- templates). One jsonb list on the single studio_settings row.
alter table studio_settings add column if not exists notice_templates jsonb;
