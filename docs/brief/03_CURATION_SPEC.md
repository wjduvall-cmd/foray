# CURATION SPEC — the part that must be excellent

The failure mode to design against: after two weeks the menu is "your 3 usual shows + 1 random thing," i.e., a subscription list with extra steps. Everything below exists to prevent that.

## Interest model

- **Taxonomy**: start with a two-level hierarchy seeded from an onboarding interview (the app's first-run flow is a short conversational Q&A, voice or text, that Claude turns into initial taxonomy weights). Nodes have: weight (-1..+1), confidence, last_evidence_at. Example seeds for me: engineering/energy/fusion, engineering/precision-mfg, history/military/ancient, history/technology, craft/instrument-making, science/materials, business/startups, comedy/casual-hangs, home/DIY.
- Also maintain **embeddings** for episodes and a centroid-per-node so "adjacent" is computable — adjacency powers serendipity, and taxonomy powers explainability. Both, not either.
- **User-inspectable**: I can open the Interests screen, see weights, and drag them. Voice mutations: "more like this" (+episode topics, small), "less politics" (node down, medium, with confirmation earcon), "never this show again" (show blocklist, hard).

## Scoring

Per candidate episode: `score = w_r·relevance + w_f·freshness + w_q·quality − w_d·fatigue`, where
- **relevance**: taxonomy match + embedding similarity to positive-signal centroid
- **freshness**: recency with per-format decay (news decays in days; "how guitars are made" is evergreen — Tier-1 classification tags evergreen-ness)
- **quality**: completion rates of similar past picks, show-level track record with me, Tier-2 substance ratio when available
- **fatigue**: same-show repetition penalty (≥2 picks of one show in trailing 7 days → steep), same-topic-run penalty, and a "you always skip 3h episodes on weekdays" duration-context prior
Log every component per candidate into the session build record so I can audit "why did it pick this?"

## The 4-slot menu: variety by construction

Do **not** take top-4 of one ranked list. Fill fixed archetype slots, each from its own candidate pool:

1. **Deep-learn** — highest relevance in a high-weight interest node; substantive format.
2. **Stretch** — the serendipity slot. Drawn from *adjacent* embedding space (near, not inside, my demonstrated clusters) or a cold taxonomy node with high global quality. The why-line MUST articulate the bridge ("you finished the metallurgy episode — Damascus steel forging scratches the same itch"). ε-greedy floor: this slot ignores my historical skip rate for the region it explores; exploration is the point.
3. **Narrative** — story-driven / history / documentary format, orthogonal to slot 1's topic.
4. **Comfort** — low-cognitive-load: the casual hang, comedy, favorite hosts. Plus, when one exists, a **Continue card** (partially-played episode) takes precedence here or appears as a 5th card — resuming must always be one tap.

Constraints across the menu: ≥3 distinct shows, ≥3 distinct top-level taxonomy branches, ≥1 item fitting the commute duration end-to-end, ≤1 item over 90 min.

## Session assembly

- Target duration = configured commute ± 15%. A session is: `intro(optional) → picked content` where picking happens live, so the "session" the builder ships is really: 4 pre-fetched option tracks + pre-generated intro/transition TTS for the *likely paths* (generate intros for all 4 cards; generate transitions lazily-server-side but pre-download the first-hop ones).
- If picked item < commute length: queue a follow-on (same-archetype next-best) with a transition TTS bridging them; the bridge sentence should connect content, not just announce ("that was fusion confinement — staying with energy, here's...").
- If picked item ≫ commute length: play it; at session end the position is saved and tomorrow's menu gets the Continue card.

## Learning from signals (weights are starting points; tune from my data)

| Signal | Interpretation |
|---|---|
| Finished ≥85% | strong + on episode topics/show/format |
| Picked from menu | mild + on card archetype & topics (even before listening) |
| Skip < 2 min in | strong − on *episode*, weak − on topic (bad guest ≠ bad topic) |
| Skip 2–20 min | moderate − episode, mild − format (maybe too slow/padded) |
| "More like this" | strong + topics, + show |
| "Something different" | contextual − (mood, not taste) — affects *this session only* |
| Thumbs down + "less X" | medium − on named node |
| Saved for later | + topic, neutral on now-context (wrong time, right content) |
| Card shown, never picked, 5+ times | gentle − on that card's framing/topic combo |

Critical rule: **"something different" and time-of-day context must not permanently mutate taste.** Keep a separation between durable taste weights and session-context state.

## The why-line

Generated per (episode, me, moment) by Claude at build time. Requirements: ≤ 18 words on the card; references my actual history or stated interests at least implicitly; no generic praise ("fascinating deep dive" is banned); for Stretch slot it must state the bridge. These lines double as the opening of the spoken intro.

## Cold start (before my history exists)

Onboarding interview → seed weights; first week runs a higher exploration rate and shorter items (easier to evaluate); explicitly ask via a card once per session-end: "how was that pick?" until ~30 signal events exist, then stop nagging.
