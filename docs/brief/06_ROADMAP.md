# ROADMAP — build in this order; meet acceptance criteria before advancing

## M0 — Risk-retirement spikes (before real code)
Three throwaway prototypes, each ≤ a day:
- **Audio choreography spike**: bare iOS app; play a local mp3 → hold-to-talk ducks + records + on-device STT → resume; survive a phone call and a BT disconnect. *Accept: no pops, no lost position, PTT round-trip < 1 s, tested in my actual car.*
- **Feed reality spike**: script that ingests 15 feeds I actually listen to + JRE; prints parsed metadata, redirect chains, duration reconciliation. *Accept: all 15 parse; weirdness documented into the fixture corpus.*
- **Intro quality spike**: for 5 real episodes, generate why-line + intro script + TTS with 2 candidate voices; I listen and pick. *Accept: I'd tolerate hearing these daily.*

## M1 — Backend core: ingest → enrich → API
Supabase schema + migrations; ingest worker with polling tiers + conditional GET; Tier-0/Tier-1 enrichment; dedup; cost metering; `/library`, `/subscriptions`, seeded auth. Fixture-corpus parser tests in CI.
*Accept: 20 subscribed shows stay current for a week unattended; Tier-1 classifications spot-check ≥ 90% sensible; total LLM spend for the week visible and < $5.*

## M2 — Curation engine + session builder + TTS
Taxonomy + onboarding interview flow (can be a CLI/web stub for now); scoring with component logging; archetype menu; session JSON v1; TTS generation + normalization + storage.
*Accept: 7 consecutive daily builds where I would genuinely pick something from ≥ 6 menus (I'll judge honestly); menu diversity metrics logged; every card has a non-generic why-line.*

## M3 — iOS app v0: pick and play (the daily-driver milestone)
Session picker + Now Playing + PlayerQueueManager + DownloadManager + event sync + lock-screen/BT controls + intros/transitions playing in sequence. No voice yet beyond M0 spike learnings.
*Accept: I complete 5 real commutes end-to-end with zero audio glitches and zero lost positions; airplane-mode cold-launch test passes; skip → next audible < 1 s.*

## M4 — Voice
Hold-to-talk with Tier-1 grammar; App Intents for Siri; Tier-2 free-text → backend intent; earcon language; family-mode toggle.
*Accept: 10 core commands work in the moving car at highway speed ≥ 9/10 attempts; "Hey Siri, something different" works from locked phone; free-text taste feedback demonstrably mutates interests.*

## M5 — Learning loop + polish
Feedback weights live; interests editor UI; continue cards; auto-extend; verbosity auto-brief; weekly diversity self-audit; per-show speed.
*Accept: after 3 weeks of my events, a held-out-week replay shows the ranker beats recency-only baseline on my actual picks; menus still ≥ 3 shows / ≥ 3 branches.*

## M6 — Stretch (only after I'm happily using it daily)
CarPlay template UI (entitlement should have arrived); Tier-2 segment maps + "the good 20 minutes" entry points for non-DAI, chapters-reliable shows; saved-item slot; morning news micro-slot.

## M7 — Pre-monetization hardening (later, separate effort)
Multi-user auth/billing, onboarding polish, OPML import, App Store review prep (podcast clients are an accepted category; our clean-room RSS posture is the asset), privacy policy, per-user cost ceilings. Decision gate: my own retention — if *I* still reach for it after 8+ weeks, it has a pulse worth funding.
