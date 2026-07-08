-- 0007_sessions.sql
-- One row per built session document (data/session.json shape, versioned).
-- raw_json stores the full emitted session doc for audit/replay/version
-- migration (session format will evolve; version column tracks the schema
-- version the row was built against, per 01_PROMPT.md item 9).

create table if not exists sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,

  session_key         text not null,       -- e.g. "2026-07-08-morning"
  version             integer not null default 1,

  built_at            timestamptz not null default now(),
  commute_minutes     integer,
  playback_speed      numeric,
  content_minutes     integer,
  expires_at          timestamptz,

  status              text not null default 'built'
                       check (status in ('building','built','downloading','ready','played','expired','failed')),

  raw_json            jsonb not null,      -- full session document snapshot

  created_at          timestamptz not null default now(),

  unique (user_id, session_key)
);

create index if not exists idx_sessions_user on sessions (user_id);
create index if not exists idx_sessions_built_at on sessions (user_id, built_at desc);
