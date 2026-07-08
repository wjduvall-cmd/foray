-- 0011_subscriptions.sql
-- Shows the user follows.

create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null,
  show_id                uuid not null references shows(id) on delete cascade,

  subscribed_at          timestamptz not null default now(),
  muted                   boolean not null default false,
  default_speed_override numeric,

  unique (user_id, show_id)
);

create index if not exists idx_subscriptions_user on subscriptions (user_id);
