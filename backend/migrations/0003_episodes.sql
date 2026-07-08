-- 0003_episodes.sql
-- Composite identity + dedup fields per corner case 3 and ADR 0002.

create table if not exists episodes (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null,
  show_id                 uuid not null references shows(id) on delete cascade,

  guid                    text,                 -- unreliable; never the sole identity key
  title                   text not null,
  title_normalized        text not null,        -- lowercased, punctuation/whitespace-folded
  description_html        text,                 -- raw show-notes as received
  description_text        text,                 -- sanitized plain text for LLM input

  enclosure_url           text not null,        -- original, pre-redirect (corner case 1)
  resolved_enclosure_url  text,                 -- after following redirect chain (cap 8)
  enclosure_length_bytes  bigint,
  enclosure_type          text,
  is_video                boolean not null default false,

  duration_seconds        integer,              -- normalized; null when unrecoverable
  duration_raw             text,                 -- original itunes:duration string, for audit
  duration_source          text not null default 'unknown'
                            check (duration_source in ('itunes_duration','computed_from_file','unknown')),

  published_at             timestamptz,
  season_number             integer,
  episode_number             integer,
  explicit                    boolean,

  transcript_url               text,
  transcript_status            text not null default 'none'
                                check (transcript_status in ('none','podcast_tag','publisher','youtube','whisper_pending','whisper_done','unavailable')),
  chapters_url                  text,

  -- composite identity (ADR 0002): normalized(title) + published_date +/- 1 day + duration +/- 90s
  identity_key                   text not null,
  dedup_group_id                 uuid,          -- null until dedup pass groups it

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  unique (user_id, show_id, guid)
);

create index if not exists idx_episodes_user on episodes (user_id);
create index if not exists idx_episodes_show on episodes (user_id, show_id);
create index if not exists idx_episodes_identity on episodes (user_id, identity_key);
create index if not exists idx_episodes_dedup_group on episodes (dedup_group_id) where dedup_group_id is not null;
create index if not exists idx_episodes_published on episodes (user_id, published_at desc);
