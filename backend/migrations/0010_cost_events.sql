-- 0010_cost_events.sql
-- Every LLM/TTS/transcription call writes a row here (01_PROMPT.md
-- constraint #8, 02_ARCHITECTURE.md Enrichment pipeline, corner case 33).
-- The budget guard (src/cost/budgetGuard.ts) sums estimated_usd for "today"
-- in the user's local timezone before allowing a new spend.

create table if not exists cost_events (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  ts                  timestamptz not null default now(),

  operation           text not null,      -- 'tier1_classify' | 'tier2_transcript' | 'tts_generate' | 'voice_intent' | 'why_line' | ...
  provider             text not null,      -- 'anthropic' | 'stub' | ...
  model                 text,

  tokens_input           integer,
  tokens_output           integer,
  units                    numeric,          -- generic unit count (chars/seconds) when tokens don't apply
  estimated_usd            numeric not null,

  episode_id               uuid references episodes(id),
  session_id                uuid references sessions(id),

  dry_run                   boolean not null default false,

  created_at                timestamptz not null default now()
);

create index if not exists idx_cost_events_user_ts on cost_events (user_id, ts desc);
create index if not exists idx_cost_events_operation on cost_events (user_id, operation);
