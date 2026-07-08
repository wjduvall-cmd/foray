-- 0004_episode_enrichment.sql
-- Cheap-first cascade output (02_ARCHITECTURE.md Enrichment pipeline).
-- One row per (episode, tier) so Tier-0/1/2 results are independently cached
-- and re-runs are cheap-to-skip via content_hash.

create table if not exists episode_enrichment (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null,
  episode_id           uuid not null references episodes(id) on delete cascade,

  tier                 integer not null check (tier in (0, 1, 2)),
  content_hash         text not null,           -- hash of the inputs classified, for cache-forever semantics

  topics               text[] not null default '{}',   -- taxonomy_nodes.node_id values, multi-label
  apple_categories     jsonb not null default '[]',    -- [{category, subcategory}]
  format               text
                        check (format is null or format in ('interview','narrative','how-to','news','comedy','debate','solo','panel','documentary','hang')),
  depth                text check (depth is null or depth in ('low','medium','high')),
  evergreen            boolean,
  gist                 text,                             -- one-sentence summary
  guests               text[] not null default '{}',
  segment_map          jsonb,                             -- Tier-2: topic spans with timestamps + confidence
  quality              jsonb,                             -- Tier-2: substance-vs-banter ratio etc.
  pull_quote           text,

  model                text,
  source_confidence    numeric,

  created_at           timestamptz not null default now(),

  unique (episode_id, tier, content_hash)
);

create index if not exists idx_enrichment_user on episode_enrichment (user_id);
create index if not exists idx_enrichment_episode on episode_enrichment (episode_id);
create index if not exists idx_enrichment_topics on episode_enrichment using gin (topics);
