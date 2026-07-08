# ARCHITECTURE

## System overview

```
┌─────────────────────────── Backend (Node/TS) ───────────────────────────┐
│                                                                          │
│  Ingest worker ──> Enrichment pipeline ──> Curation engine ──> Session   │
│  (RSS poller,      (classify, summarize,   (score, archetype   builder   │
│   Podcast Index,    transcript ladder)      slots, dedup)      (+ TTS)   │
│   iTunes Search)                                                         │
│                                                                          │
│  REST API (Fastify or Hono): /sessions /feedback /voice-intent /library  │
│  Supabase: Postgres (all state) + Storage (TTS mp3s) + Auth (single user)│
│  cron: pre-commute session builds; feed polling tiers                    │
└──────────────────────────────────────────────────────────────────────────┘
                                   │ HTTPS (backend is the only server the
                                   ▼  app talks to; publisher CDNs excepted)
┌─────────────────────────── iOS app (SwiftUI) ────────────────────────────┐
│  Session picker (4 cards) · Now Playing · Library/History · Interests    │
│  PlayerQueueManager (custom, over AVPlayer)                              │
│  DownloadManager (background URLSession; episodes from publisher CDN,    │
│                   TTS assets from Supabase Storage)                      │
│  VoiceController (hold-to-talk STT + local grammar + App Intents)        │
│  Sync: event batching, position reporting, feedback                      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Backend components

### Ingest worker
- Sources: **Podcast Index API** (primary directory; free key), **iTunes Search** (fallback/metadata), direct RSS fetch.
- Per-feed polling tier derived from observed release cadence (daily show → poll ~hourly around its usual drop time; weekly → a few times/day). Conditional GET always (ETag / If-Modified-Since).
- Parses RSS incl. podcasting-2.0 namespace: `podcast:transcript`, `podcast:chapters`, `podcast:season/episode`, `itunes:duration`, `itunes:explicit`. Store raw enclosure URL *and* the resolved final URL after redirect chain (see corner cases: tracking prefixes).
- First sync of a large back-catalog feed: ingest most recent N (default 50) episodes only; lazily backfill on demand.

### Enrichment pipeline (cheap-first cascade)
1. **Tier 0 (free)**: normalize metadata; extract duration, explicit flag, chapters, transcript URL if present.
2. **Tier 1 (cheap LLM)**: classify from title + show notes → topics (taxonomy IDs), format tags (interview / narrative / panel / solo), density estimate, guest extraction, one-sentence gist. Batch these calls. Cache forever keyed on content hash.
3. **Tier 2 (expensive, gated)**: transcript acquisition ladder → segment map (topic spans with timestamps + confidence), quality signals (substance vs. banter ratio), pull-quote for the intro. Only for episodes shortlisted by the curation engine or explicitly queued by me.
- Every LLM/TTS/transcription call writes a `cost_events` row (operation, model, tokens/chars, estimated USD). Daily budget cap halts Tier 2 first, then Tier 1, never ingestion.

### Curation engine + session builder
See `03_CURATION_SPEC.md`. Output artifact: a **Session** document (versioned JSON) =
ordered items, each: `{type: intro_tts | episode | transition_tts | outro_tts, asset_url, episode_ref?, start_offset?, expected_duration, card: {title, why_line, art_url, archetype}}`, plus session metadata (target duration, built_at, expiry).

### TTS generation
- Interface `TTSProvider` with one production implementation (pick a current high-quality API after comparing cost/latency/voice quality — write an ADR) and loudness-normalize output (ffmpeg loudnorm to ≈ -16 LUFS, true peak -1.5 dB).
- Intro script generation via Claude with strict length budget (target ≤ 40 words spoken ≈ 12–15 s; transitions ≤ 25 words). Persona/tone configurable in settings; no spoilers for narrative shows (the Tier-1 format tag gates this).
- Assets stored `storage://tts/{session_id}/{item_idx}.mp3`, referenced by signed URL in the session doc.

## Data model (guidance — you finalize; user_id everywhere)

- `shows` (feed_url, resolved ids, title, cadence stats, dai_suspected bool, chapters_reliable bool, default_speed)
- `episodes` (show_id, composite identity fields, guid, title, notes, enclosure_url, resolved_url, duration, published_at, explicit, transcript_status, dedup_group_id)
- `episode_enrichment` (episode_id, tier, topics[], format, gist, segment_map jsonb, quality jsonb, content_hash)
- `taxonomy` / `user_interests` (user-inspectable weights; see curation spec)
- `sessions`, `session_items`
- `events` (user_id, ts, type: card_shown | picked | skipped_at | finished | voice_command | thumbs | saved, payload jsonb) — the single source of learning signal
- `cost_events`
- `subscriptions` (user follows show) and `saved_items` (listen-later)

## API surface (v1)

- `GET /sessions/current` · `POST /sessions/build` (on-demand, params: target_minutes, mood hint)
- `POST /events` (batched from app)
- `POST /voice/intent` (free-text utterance → structured intent; Tier-2 voice path)
- `GET /library`, `POST /subscriptions`, `POST /saved`
- `GET /interests`, `PATCH /interests` (hand-editing my taxonomy weights)
- Auth: Supabase JWT; single seeded user.

## iOS app structure

- **PlayerQueueManager**: owns an ordered item list; single AVPlayer instance swapped between AVPlayerItems (mixed file:// and https:// — but in practice everything is pre-downloaded). Responsibilities: per-item start offsets, per-show rate, position persistence (every 15 s + on every state change), MPNowPlayingInfoCenter updates per item, MPRemoteCommandCenter wiring (play/pause, skip ±, next/prev item mapped sensibly), and the transition choreography (episode ends → play transition_tts → next episode). Treat it as a formal state machine with unit tests; it is the heart of the app.
- **DownloadManager**: background URLSession; downloads session assets in priority order (first item's audio first so playback can start before the whole session lands); LRU eviction with configurable cap (default 6 GB); session readiness state machine → local notification "Your commute session is ready."
- **VoiceController**: see `04_VOICE_AUDIO_SPEC.md`.
- **Sync**: events queue persisted locally, batched to `POST /events`, tolerant of days offline.
- Screens: Today (session cards, huge tap targets, one-hand reach), Now Playing (scrub, speed, why-card, thumbs, save), Library/History, Interests editor, Settings (commute times, intro verbosity, voice persona, budget/telemetry view).

## Deployment (personal phase)

- Backend: single small VM or my always-on workstation via Docker Compose (api + worker + cron); Supabase cloud free tier. Secrets in env, never in the repo, never on the phone.
- iOS: personal Apple Developer account, TestFlight internal build for daily dogfooding. Apply for CarPlay audio entitlement at project start; integrate only in a later milestone.
