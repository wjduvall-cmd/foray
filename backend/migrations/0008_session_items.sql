-- 0008_session_items.sql
-- Normalized rows for the cards/queue items inside a session's raw_json,
-- so scoring components and picks can be queried without parsing jsonb.

create table if not exists session_items (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null,
  session_id            uuid not null references sessions(id) on delete cascade,

  slot                  integer,             -- 1..4 menu slot, null for follow-on/transition items
  archetype             text
                         check (archetype is null or archetype in ('deep-learn','stretch','narrative','comfort','continue')),
  item_type             text not null
                         check (item_type in ('intro_tts','episode','transition_tts','outro_tts')),

  episode_id            uuid references episodes(id),
  asset_url             text,
  start_offset_seconds  integer not null default 0,
  expected_duration_seconds integer,

  card_title            text,
  why_line              text,
  fit_line              text,
  art_url               text,

  score_components      jsonb,               -- {relevance, freshness, quality, fatigue, total} audit log (03_CURATION_SPEC.md)
  position               integer not null,    -- ordering within the session

  created_at             timestamptz not null default now()
);

create index if not exists idx_session_items_user on session_items (user_id);
create index if not exists idx_session_items_session on session_items (session_id, position);
create index if not exists idx_session_items_episode on session_items (episode_id);
