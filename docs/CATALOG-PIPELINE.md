# Catalog pipeline — review and the road to 10,000 shows

*2026-07-09. Commissioned before scaling: "make sure the cataloguing is being done
effectively and is forward compatible... then aim for cataloging 10k podcasts."*

## Review of the current process (agent waves)

Three agent waves built today's catalog: 154 shows / 389 episodes. Honest assessment:

**What it does well (keep for its tier):**
- Every ID verified against the iTunes API — zero invented data across ~390 episodes.
- Editorial judgment per show (which shows are *good*, not just popular) and per episode
  (skip trailers, pick substantive), plus copy-gated hooks and 5–10 tags per episode.
- Output feeds the semantic index directly; quality is high enough to serve as the
  golden calibration set for the future Tier-1 LLM classifier.

**Why it cannot reach 10k:**
- Throughput ≈ 30 shows per agent-run; 10k would take ~330 runs and most of the
  editorial work (hooks, per-episode picks) is wasted at that scale — nobody reads
  10k hooks, and episode-level data goes stale in a week without the feed-polling
  backend anyway.
- Web-search discovery biases toward famous shows in list-articles; a breadth catalog
  needs systematic coverage, not vibes.

**Verdict:** the agent-wave process is a *curation* pipeline, not a *catalog* pipeline.
Keep it for the curated tier; build a programmatic harvester for breadth.

## Two-tier catalog architecture

| | Curated tier | Breadth tier |
|---|---|---|
| File | `data/catalog.json` + `data/discover.json` | `data/catalog-breadth.json` |
| Size | ~150 shows, grows by editorial waves | ~10k shows, grows by re-harvest |
| Contents | shows + hand-picked episodes + hooks + tags | show-level records only |
| Consumers | web client (discover pool), semantic index | backend seed data, future show-level search |
| Episode data | hand-picked, copy-gated | none — episodes come from feed polling (ADR-0001) once the backend ingests; harvesting 10k×episodes via iTunes would be rate-abusive and instantly stale |

Both tiers share `apple_collection_id` as the primary key, so a breadth entry upgrades
to curated by simply appearing in catalog.json — no migration.

## Forward-compatibility requirements (all implemented in the harvester)

1. **Identity**: `apple_collection_id` primary; `feed_url` captured on every entry —
   the RSS-native architecture keys on feeds, and Podcast Index cross-referencing
   (when the key lands) matches on feed URL. `podcastindex_id: null` reserved.
2. **Popularity prior**: `chart_genre_id` + `chart_rank` (per-genre Apple top-charts
   position) stored — this becomes the curation engine's global-quality prior for
   cold nodes (03_CURATION_SPEC: stretch slot draws on "cold taxonomy node with high
   global quality").
3. **Genre mapping**: Apple's genre ids + names stored raw (`apple_genre_ids`,
   `apple_genre`). Mapping to our taxonomy happens downstream and can be re-run;
   never bake a lossy mapping into the harvest.
4. **Provenance + refresh**: `harvest_source`, `harvested_at`, `region` on every
   entry; the script is idempotent and re-runnable (re-harvest = new file, diffable).
5. **Client isolation**: the web client never fetches the breadth file (it is ~3MB
   and show-level only). No client change ships with the harvest.
6. **Dedupe discipline**: collectionId-unique within the file; curated-tier overlap
   is allowed and expected (marked `in_curated: true` for joins).

## The harvester (`tools/harvest-catalog.mjs`)

Pipeline: Apple podcast genre tree (`itunes.apple.com/.../ws/genres?id=26`, ~110
subgenres) → per-genre top-200 charts (legacy RSS JSON) → dedupe collectionIds →
batched `lookup` calls (200 ids/request) for authoritative metadata (feedUrl, title,
artwork, trackCount, explicitness, genres) → `data/catalog-breadth.json`.

Politeness: ≥3s between requests, honest User-Agent, ~170 total requests ≈ 10–12
minutes per full harvest. Expected yield: 110 genres × 200 ≈ 22k chart rows →
~9–13k unique shows (charts overlap heavily at the top).

## What stays out of scope at breadth scale (deliberately)

- **Per-episode harvesting** — the backend's feed poller owns episodes (fresh, polite,
  conditional-GET) once deployed; a one-shot iTunes episode grab of 10k shows would be
  stale on arrival.
- **Deep tagging/classification of 10k shows** — that's the Tier-1 LLM enrichment
  pipeline's job when the key lands, budget-metered, cheapest-first. Genre + chart
  rank are enough signal for the breadth tier until then.
- **Editorial notes/hooks at scale** — reserved for what actually surfaces to users.
