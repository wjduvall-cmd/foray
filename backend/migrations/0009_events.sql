-- 0009_events.sql
-- Single source of learning signal + product analytics (01_PROMPT.md
-- "Working style expected from you"). Every card shown / picked / skipped /
-- finished / voice command / thumbs / saved lands here.

create table if not exists events (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  ts                  timestamptz not null default now(),

  type                text not null
                       check (type in (
                         'card_shown','picked','skipped_at','finished',
                         'voice_command','thumbs','saved','session_built',
                         'session_rated'
                       )),

  session_id          uuid references sessions(id),
  episode_id          uuid references episodes(id),
  archetype            text,     -- slot provenance, for damped explore-slot weighting (curation-practices.md sec.4)

  payload              jsonb not null default '{}',

  created_at           timestamptz not null default now()
);

create index if not exists idx_events_user_ts on events (user_id, ts desc);
create index if not exists idx_events_type on events (user_id, type);
create index if not exists idx_events_episode on events (episode_id);
