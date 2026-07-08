-- 0002_shows.sql
-- One row per feed the user (eventually: a user) tracks. user_id is present
-- even though the catalog is conceptually shared, per hard constraint #7
-- (01_PROMPT.md): no single-tenant schema shortcuts, even pre-multi-user.
-- A future multi-user migration can add a separate shared `shows_catalog`
-- table and turn this into a thin per-user overlay; not needed yet.

create table if not exists shows (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,

  feed_url            text not null,               -- as first discovered
  resolved_feed_url   text,                         -- after 301 / itunes:new-feed-url
  feed_moved_from     text[] not null default '{}', -- audit trail, corner case 4

  podcast_index_id    text,
  itunes_collection_id bigint,

  title               text,
  description         text,
  artwork_url         text,
  explicit            boolean,

  -- polling strategy (ADR 0001)
  cadence_days        numeric,                      -- observed avg days between episodes
  polling_tier        text not null default 'unknown'
                        check (polling_tier in ('hourly','several_daily','daily','weekly','backoff','unknown')),
  last_polled_at       timestamptz,
  next_poll_due_at     timestamptz,
  etag                 text,
  last_modified_header text,
  consecutive_failures integer not null default 0,

  -- corner cases 2 (DAI) and per-show playback defaults
  dai_suspected        boolean not null default false,
  dai_suspect_hosts     text[] not null default '{}',
  chapters_reliable    boolean not null default false,
  default_speed        numeric not null default 1.0,

  private_feed         boolean not null default false, -- corner case 9: tokened URL
  status                text not null default 'active'
                        check (status in ('active','moved','dead','removed')),

  created_at            timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  unique (user_id, feed_url)
);

create index if not exists idx_shows_user on shows (user_id);
create index if not exists idx_shows_next_poll on shows (next_poll_due_at) where status = 'active';
create index if not exists idx_shows_status on shows (status);
