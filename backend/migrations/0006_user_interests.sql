-- 0006_user_interests.sql
-- Append-only log of interest-weight mutations (onboarding answers, voice
-- feedback, skip/finish signal, etc). taxonomy_nodes holds current state;
-- this table is the inspectable "why is this node's weight what it is"
-- audit trail referenced by 03_CURATION_SPEC.md's learning-signal table.

create table if not exists user_interests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  node_id             text not null,

  reason              text not null
                       check (reason in (
                         'onboarding','finished_strong','picked_from_menu',
                         'skip_strong_neg','skip_weak_neg','more_like_this',
                         'something_different','thumbs_down_named_node',
                         'saved_for_later','card_ignored_repeatedly','manual_edit'
                       )),
  archetype_slot      text,               -- provenance tag (curation-practices.md sec.4): explore vs exploit
  delta               numeric not null,   -- signed weight change applied
  previous_weight     numeric,
  new_weight          numeric,

  source_event_id     uuid,               -- references events(id); no FK (events created after this in migration order)
  episode_id          uuid references episodes(id),

  applied_at          timestamptz not null default now(),

  foreign key (user_id, node_id) references taxonomy_nodes (user_id, node_id)
);

create index if not exists idx_user_interests_user_node on user_interests (user_id, node_id);
create index if not exists idx_user_interests_applied_at on user_interests (applied_at);
