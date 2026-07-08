# ADR 0002: Episode Identity & Dedup

## Status
Accepted. Implemented in `src/identity/dedup.ts`; storage columns in
`backend/migrations/0003_episodes.sql` (`identity_key`, `dedup_group_id`).

## Context
Corner case 3: GUIDs are unreliable. Hosts migrate platforms and regenerate
every GUID; feeds get republished; audio and video feeds of the same show
duplicate every episode under different GUIDs; "rebroadcast" episodes
duplicate old content with a fresh GUID. If the menu ever shows two members
of the same underlying episode as if they were different options, that's an
immediate trust break ("why did it recommend the same thing twice").

## Options considered
1. **Trust GUID as the sole identity key.** What most naive implementations
   do. Fails exactly the cases above — it's the thing corner case 3 exists
   to warn against.
2. **Content hash of the audio file.** Defeated by corner case 2 (dynamic ad
   insertion): the same episode's bytes differ per fetch, so a content hash
   isn't stable even for a single canonical episode, let alone across an
   audio/video pair.
3. **Composite identity: normalized(title) + published_date ± 1 day +
   duration ± 90s**, computed at ingest time and re-checked in a dedup pass
   across candidate episodes.

## Decision
Option 3, split into two layers so it's both fast to look up and correct to
match:
- **`identity_key`** (`normalizeTitle(title) + "::" + dateBucket`) is a
  cheap, deterministic string stored per episode for indexed lookup — "find
  everything published around this date with a similar title" without a
  table scan. It is *not* itself the match rule (a date-bucket boundary
  would wrongly split two episodes 23 hours apart into different buckets).
- **`isSameEpisode(a, b)`** is the actual match rule, applied pairwise
  against `identity_key`-bucketed candidates: title must normalize
  identically (lowercase, punctuation stripped, diacritics folded, noise
  tags like `(Video)`/`[Explicit]` removed); published dates — when both
  present — must be within 1 day; duration — when both present — must be
  within 90 seconds. **Missing duration on either side does not block a
  match** (title + date proximity is required and sufficient), since
  duration is frequently absent per corner case 6, and requiring it would
  silently disable dedup for exactly the feeds worst affected by
  duplication.
- **`groupDuplicates()`** runs union-find over pairwise `isSameEpisode`
  results so duplication is transitive (A≈B, B≈C ⇒ A,B,C grouped even if A
  and C individually fall just outside tolerance) and deterministic (root =
  lexicographically smallest id, so re-running produces the same grouping).
- The session builder (`src/curation/sessionBuilder.ts`) runs this as a
  safety net across the whole candidate pool before scoring, dropping all
  but one member of any detected group — belt-and-suspenders on top of
  whatever ingest-time dedup the (not-yet-built) worker does.

Title normalization deliberately treats `(Video)` / `[Explicit]` /
`(Audio)` / rebroadcast-style noise tags as equivalent to their absence —
these are exactly the tokens a publisher's audio-vs-video sibling feeds or
a rebroadcast tend to add, and stripping them is what makes the audio/video
pair case actually match in practice rather than just in theory.

## Consequences
- Cross-feed dedup (audio feed vs. video feed of the same show) works
  without needing the feeds to agree on GUID, publisher, or hosting
  platform.
- False-negative risk: a legitimately distinct episode published the same
  day with a near-identical title and similar runtime (rare, but possible
  for e.g. "Part 1" / "Part 2" episodes with sloppy titling) could be
  over-merged. Mitigated by requiring the *whole* normalized title to
  match, not a fuzzy/partial match — "Part 1" vs "Part 2" normalize
  differently and won't collide.
- O(n²) pairwise comparison in `groupDuplicates` is fine at
  single-user/single-show batch sizes (documented in the code); a
  production-scale version should pre-bucket by `identity_key` ± 1 day
  before comparing pairwise, not implemented yet since there's no dataset
  large enough to need it.
