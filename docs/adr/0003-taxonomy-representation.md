# ADR 0003: Taxonomy Representation

## Status
Accepted. Implemented in `backend/migrations/0005_taxonomy_nodes.sql`
(current state) and `0006_user_interests.sql` (mutation audit log);
`src/types/taxonomy.ts` mirrors `data/taxonomy.json`'s shape exactly.

## Context
01_PROMPT.md item 5 asks for "the exact taxonomy representation" — flat
tags vs. hierarchical vs. embedding-space — and how voice feedback ("more
like this," "less politics") mutates it, while staying inspectable and
hand-editable in the app. `docs/research/curation-practices.md` did the
legwork here (see its "Recommended taxonomy JSON schema" section) so this
ADR mostly ratifies that research rather than re-deriving it from scratch,
per the instruction not to relitigate settled research.

## Options considered
1. **Flat tags** (a set of strings per episode/interest). Simple, but has
   no notion of "engineering" as a parent of "fusion" — can't express
   partial credit for adjacency (liking fusion should mildly boost
   precision-manufacturing) without hand-maintained tag-to-tag rules.
2. **Pure embedding space** (episodes and interests as vectors, similarity
   = cosine distance). Great for "adjacent, not identical" serendipity
   (Stretch slot) and requires no manual taxonomy maintenance, but is
   opaque — the user can't open a screen and see or drag a number, which
   directly violates the "inspectable and hand-editable" requirement and
   the why-line's need to name a concrete interest.
3. **Hierarchical symbolic tree + per-node embedding centroid, anchored to
   Apple Podcasts' standard categories.** The hybrid `curation-practices.md`
   validated against Netflix's knowledge-graph pattern and academic
   hierarchical multi-interest modeling: symbolic tree for
   interpretability/explainability + editability, centroid embeddings for
   adjacency/serendipity math.

## Decision
Option 3. Concretely, per `data/taxonomy.json` and
`taxonomy_nodes` (migration 0005):
- Two-level hierarchy: top-level branches (`engineering`, `history`,
  `craft`, ...) and leaf nodes (`engineering/energy-fusion`,
  `history/military-ancient`, ...), identified by slash-path id.
- Every node carries `weight` (-1..+1, durable taste signal),
  `confidence` (0..1, grows with evidence volume — gates cold-start
  exploration radius per the curation spec), and `last_evidence_at`.
- Every node anchors to a standard Apple Podcasts category
  (`apple_anchor`/`appleCategoryAnchor`) so ingestion can pre-filter
  candidate feeds against Podcast Index/iTunes *before* any LLM
  classification runs — this is the taxonomy paying for itself in the
  cost-discipline constraint (01_PROMPT.md #8), not just an
  interoperability nicety.
- `centroid_embedding` (vector + sample count + updated-at) is reserved on
  the node for the not-yet-built embedding pipeline — an incrementally
  updated running mean per `curation-practices.md`'s recommendation, rather
  than a batch recompute, so adjacency tracks taste drift continuously.
  **Not populated in this pass** (no embeddings pipeline exists yet); the
  scoring module's `computeRelevance()` currently uses taxonomy-weight
  matching only and documents this simplification explicitly.
- **Mutations are append-only, not in-place overwrites**: `user_interests`
  (migration 0006) logs every weight change with a `reason` enum (`
  onboarding`, `skip_strong_neg`, `more_like_this`, `something_different`,
  ...), `archetype_slot` provenance (per `curation-practices.md`'s
  bandit-literature recommendation to damp Stretch-slot negative signal
  relative to Deep-learn), and `previous_weight`/`new_weight`. This is what
  makes "why is this node's weight what it is" answerable in the app
  without a separate analytics system.

## Consequences
- The Interests screen (future iOS work) can render `taxonomy_nodes`
  directly — every field the user needs to see or drag already exists in
  one row.
- "Something different" and other session-context signals must write to a
  *separate* session-scoped state, never straight into `taxonomy_nodes` or
  `user_interests` — the curation spec's "critical rule" that mood signals
  must not permanently mutate durable taste. This ADR does not yet define
  that session-context table; flagged as a gap for the curation-engine
  milestone (M2 in `06_ROADMAP.md`), not solved in this backend-core pass.
- Adjacency/serendipity (the Stretch slot) is currently taxonomy-only
  (cold-node-with-high-quality fallback), not embedding-adjacency —
  weaker than the target design but honest about what's actually built;
  upgrading to real embedding centroids is additive (new column already
  exists) and doesn't require a schema migration when it lands.
