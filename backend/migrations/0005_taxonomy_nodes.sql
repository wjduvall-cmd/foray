-- 0005_taxonomy_nodes.sql
-- Two-level hierarchy, matches data/taxonomy.json shape (ADR 0003).
-- Composite primary key (user_id, node_id) since node_id ("engineering/energy-fusion")
-- is a slash-path unique per user, not globally.

create table if not exists taxonomy_nodes (
  user_id              uuid not null,
  node_id              text not null,              -- e.g. "engineering/energy-fusion"
  parent_id            text,                        -- null for top-level branches

  label                text not null,
  apple_category       text,                        -- one of Apple's 19 top-level categories
  apple_subcategory    text,

  weight               numeric not null default 0 check (weight between -1 and 1),
  confidence           numeric not null default 0 check (confidence between 0 and 1),
  last_evidence_at     timestamptz,

  centroid_embedding   jsonb,                       -- {vector: number[], sampleCount, updatedAt}

  user_editable        boolean not null default true,
  source                text not null default 'manual-edit'
                        check (source in ('onboarding-interview','inferred','voice-mutation','manual-edit')),

  created_at             timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  primary key (user_id, node_id),
  foreign key (user_id, parent_id) references taxonomy_nodes (user_id, node_id) deferrable initially deferred
);

create index if not exists idx_taxonomy_parent on taxonomy_nodes (user_id, parent_id);
