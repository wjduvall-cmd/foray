-- 0012_saved_items.sql
-- Listen-later queue (corner case 31: dedup at menu build against saved/played state).

create table if not exists saved_items (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null,
  episode_id            uuid not null references episodes(id) on delete cascade,

  saved_at              timestamptz not null default now(),
  note                   text,
  played_status           text not null default 'unplayed'
                           check (played_status in ('unplayed','in_progress','finished')),
  last_position_seconds    integer,

  unique (user_id, episode_id)
);

create index if not exists idx_saved_items_user on saved_items (user_id, played_status);
