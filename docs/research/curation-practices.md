# Curation Practices Research — standards to leverage for Foray

Purpose: don't reinvent taxonomy, interest modeling, or exploration mechanics. This
grounds `03_CURATION_SPEC.md`'s interest model, scoring, and serendipity slot in
existing industry/academic practice.

## 1. Standard podcast taxonomy — Apple Podcasts categories

Apple Podcasts categories (confirmed directly from `podcasters.apple.com/support/1691`,
current as of the 2019 revision + subsequent subcategory additions) are the de facto
industry standard: Spotify, Podcast Index, Podchaser, and every major directory ingest
or map to this list because publishers declare it in their RSS `<itunes:category>` tags.
Podcast Index explicitly treats `apple_categories.txt` as "mostly the industry standard"
and flattens Apple's two-level structure into independent tags rather than inventing its
own taxonomy — a strong precedent for *anchoring* custom nodes to Apple categories rather
than replacing them.

**Full list (19 top-level, 15 with subcategories, ~106 leaf nodes total):**

| Top-level | Subcategories |
|---|---|
| Arts | Books, Design, Fashion & Beauty, Food, Performing Arts, Visual Arts |
| Business | Careers, Entrepreneurship, Investing, Management, Marketing, Non-Profit |
| Comedy | Comedy Interviews, Improv, Stand-Up |
| Education | Courses, How To, Language Learning, Self-Improvement |
| Fiction | Comedy Fiction, Drama, Science Fiction |
| Government | — |
| History | — |
| Health & Fitness | Alternative Health, Fitness, Medicine, Mental Health, Nutrition, Sexuality |
| Kids & Family | Education for Kids, Parenting, Pets & Animals, Stories for Kids |
| Leisure | Animation & Manga, Automotive, Aviation, Crafts, Games, Hobbies, Home & Garden, Video Games |
| Music | Music Commentary, Music History, Music Interviews |
| News | Business News, Daily News, Entertainment News, News Commentary, Politics, Sports News, Tech News |
| Religion & Spirituality | Buddhism, Christianity, Hinduism, Islam, Judaism, Religion, Spirituality |
| Science | Astronomy, Chemistry, Earth Sciences, Life Sciences, Mathematics, Natural Sciences, Nature, Physics, Social Sciences |
| Society & Culture | Documentary, Personal Journals, Philosophy, Places & Travel, Relationships |
| Sports | Baseball, Basketball, Cricket, Fantasy Sports, American Football, Golf, Hockey, Rugby, Running, Football (Soccer), Swimming, Tennis, Volleyball, Wilderness, Wrestling |
| Technology | — |
| True Crime | — |
| TV & Film | After Shows, Film History, Film Interviews, Film Reviews, TV Reviews |

**Mapping the seed interests from the spec to Apple categories:**

| Seed interest node | Nearest Apple anchor | Gap |
|---|---|---|
| engineering/energy/fusion | Science (Physics) | no "Engineering" category exists at all — biggest gap |
| engineering/precision-mfg | Technology, or Business/Entrepreneurship if about manufacturing startups | same gap |
| history/military/ancient | History | Apple's History has no subcategories, so "ancient" and "military" are invisible below the anchor |
| history/technology | History *or* Technology | ambiguous straddle — pick both as candidate anchors |
| craft/instrument-making | Leisure (Crafts) or Arts (Performing Arts, if music-adjacent) | reasonable fit |
| science/materials | Science (Chemistry, Physics) | reasonable fit |
| business/startups | Business (Entrepreneurship) | good fit, standard |
| comedy/casual-hangs | Comedy (Comedy Interviews) | good fit |
| home/DIY | Leisure (Home & Garden) or Education (How To) | reasonable fit |

**Conclusion:** Apple's taxonomy is necessary (it's how RSS feeds self-declare and how
Podcast Index/iTunes Search filter results) but not sufficient — it has zero coverage of
"engineering" as a discipline and no depth below History. This is exactly why the spec's
two-level *custom* hierarchy is right, but each custom node should carry an
`appleCategoryAnchor` field so ingestion/search can filter candidate feeds against Podcast
Index/iTunes before any LLM classification runs (cheap-first cascade, per the cost
constraint in `01_PROMPT.md`).

Sources:
- [Apple Podcasts categories — official](https://podcasters.apple.com/support/1691-apple-podcasts-categories)
- [Podcast Index docs-categories](https://github.com/Podcastindex-org/docs-categories)
- [Podcast Insights — iTunes Podcast Categories list](https://www.podcastinsights.com/itunes-podcast-categories/)

## 2. Topic hierarchy + interest-profile practice

Two threads in the literature/industry converge on the same answer the spec already
picked — **both a symbolic hierarchy and embeddings, not one or the other**:

- **Hierarchical multi-interest modeling** (arXiv 2303.00311, "Modeling Multiple User
  Interests using Hierarchical Knowledge for Conversational Recommender Systems") assigns
  embedding vectors to *both* leaf items and abstract taxonomy nodes — a node's centroid
  is the mean of its members' embeddings (word2vec-style). This is precisely the
  "centroid-per-node" mechanism the spec already specifies for computing adjacency. It's
  validated practice, not a novel idea.
- **Spotify Research** (structural podcast content modeling, dynamic topic modeling,
  graph-based personalization for podcasts/audiobooks) treats podcasts as nodes in a
  graph where edges are shared topics, and layers unsupervised topic modeling over
  short-text metadata (titles/descriptions) rather than relying only on publisher-declared
  categories — because Apple categories are too coarse and self-reported inconsistently.
  Their "Trajectory Based Podcast Recommendation" paper models listening sequences as
  graph walks, which is a heavier approach than Foray needs at single-user scale
  but validates graph/embedding adjacency as the mechanism for "similar but not
  identical" recommendations — i.e., the Stretch slot.
- **Netflix's knowledge graph** (nodes = titles, genres, people, "abstract concepts";
  edges = both collaborative signal and semantic relationship) is the clearest large-scale
  precedent for the hybrid pattern: symbolic taxonomy for interpretability/explainability,
  embeddings/graph structure for similarity and discovery. Netflix explicitly calls out
  that semantic metadata "provides interpretability" alongside co-engagement signals —
  the same justification the spec gives for why taxonomy powers explainability while
  embeddings power serendipity.

**Verdict for Foray:** the spec's design (two-level tree + per-node centroid
embedding, node weight -1..+1, confidence, last_evidence_at) is standard practice at a
scale appropriate for one user. No need for GNNs or dynamic topic modeling — that's
solving a cold-catalog/millions-of-users problem Foray doesn't have. The one
addition worth adopting from this research: store the centroid as an incrementally-updated
running mean (exponential moving average weighted by recency/signal strength) rather than
recomputing from scratch, so "adjacent" tracks taste drift without a batch job.

Sources:
- [Modeling Multiple User Interests using Hierarchical Knowledge for Conversational Recommender System (arXiv 2303.00311)](https://ar5iv.labs.arxiv.org/html/2303.00311)
- [Structural Podcast Content Modeling with Generalizability — Spotify Research](https://research.atspotify.com/publications/structural-podcast-content-modeling-with-generalizability/)
- [Topic Modeling on Podcast Short-Text Metadata (arXiv 2201.04419)](https://arxiv.org/abs/2201.04419)
- [Personalizing Audiobooks and Podcasts with graph-based models — Spotify Research](https://research.atspotify.com/2024/05/personalizing-audiobooks-and-podcasts-with-graph-based-models)
- [Trajectory Based Podcast Recommendation (arXiv 2009.03859)](https://arxiv.org/pdf/2009.03859)
- [Netflix — Unlocking Entertainment Intelligence with Knowledge Graph](https://netflixtechblog.medium.com/unlocking-entertainment-intelligence-with-knowledge-graph-da4b22090141)

## 3. Difficulty/depth levels

Education platforms (Coursera, Khan Academy, Skillsoft, LinkedIn Learning) universally
tag content with an explicit expertise level (beginner/intermediate/advanced), used both
for filtering and for personalization ("inferred expertise level calibrated against a
benchmark enables more effective recommendations"). This is a mature, well-understood
pattern in that domain.

**No mainstream podcast app does this.** Targeted search across Pocket Casts, Podcast
Addict, Player FM, and "podcasts for learning" roundups turned up filtering by topic,
genre, status, and download state — never by skill/depth level. It isn't in Apple's
taxonomy, Podcast Index's schema, or any directory's metadata. This is a genuine gap
Foray would be filling, not a wheel to avoid reinventing.

**Recommendation: depth is a per-episode attribute, not a taxonomy dimension.**
Reasoning:
- The same topic node (`science/materials`) legitimately contains both a 101-level
  survey episode and a niche metallurgy deep-dive with a specialist guest — the taxonomy
  node shouldn't fork into `science/materials/beginner` and `science/materials/expert`
  subtrees, because that doubles node count for a distinction that's really about the
  *episode*, not the topic.
  This also matches how Tier-1/Tier-2 classification already works in the spec:
  metadata-cheap classification produces `topics[]`, `evergreen`, and `format`; a `depth`
  field slots into that same per-episode enrichment step at near-zero marginal cost —
  it's plausibly inferable by the classifier from title/description/transcript sample
  without a dedicated model.
- Depth *can* still feed the taxonomy indirectly: track a per-node "depth distribution
  the user tends to pick" (a lightweight derived stat, not a stored weight) so the ranker
  can avoid repeatedly serving 101-level content in a node the user has demonstrated
  expert-level engagement with — this is a scoring-time join between episode depth and
  node history, not a schema change to the taxonomy.

Sources:
- [Skillsoft — Expertise Level](https://skillsoft.my.site.com/kb/s/article/Expertise-Level)
- [Directed expertise level-based discovery system (USPTO)](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9171262)
- (negative finding) search across Pocket Casts/Podcast Addict/Player FM feature pages and "best podcasts for learning" roundups — no skill-level filter found in any mainstream podcast client, confirming this is custom territory.

## 4. Exploration slot practice

Production recommenders overwhelmingly use **uniform ε-greedy exploration** rather than
Thompson Sampling or full contextual bandits, specifically because it's simple and
composable with black-box personalization models — the same reasoning applies at
Foray's single-user, low-QPS scale even more strongly (no need for the statistical
machinery multi-armed bandits exist to justify at web scale). The spec's existing design —
a fixed Stretch slot that explicitly ignores historical skip rate for the region it
explores — **is** an ε-greedy floor, just expressed as one guaranteed slot instead of a
probability. That's a reasonable, even superior, adaptation for a 4-item menu: with only 4
slots, a *probabilistic* per-item exploration roll risks an all-exploit session by chance,
which a guaranteed slot avoids by construction.

Two refinements worth adopting from bandit practice, both cheap:
1. **Decay the exploration floor's scope over time, not its existence.** Literature and
   practice agree exploration should never fully vanish (cold items keep entering the
   catalog), but its *aggressiveness* should shrink as confidence grows. The spec already
   does this for cold-start ("first week runs a higher exploration rate") — extend the
   same logic permanently: Stretch-slot candidate distance from the demonstrated cluster
   can be widest at low history-confidence and gradually tighten (still adjacent, never
   inside) as the taste profile matures, rather than using a fixed adjacency radius
   forever.
2. **Track exploration outcomes separately from exploitation outcomes when updating
   weights.** Bandit literature warns that naively folding explore-slot skip/finish
   signal into the same update rule as exploit-slot signal biases the model against
   exploration (explore picks are inherently higher-variance/riskier, so they fail more
   often for reasons unrelated to true node quality). The spec's fatigue/weight rules
   don't currently distinguish slot provenance — recommend tagging every signal event
   with which archetype slot produced it, and giving Stretch-slot negative signal a
   damped weight relative to the same signal from a Deep-learn pick.

Sources:
- [Deep reinforcement learning for search, recommendation, and online advertising: a survey (arXiv 1812.07127)](https://arxiv.org/pdf/1812.07127)
- [Optimization of Epsilon-Greedy Exploration (arXiv 2506.03324)](https://arxiv.org/pdf/2506.03324)
- [Exploitation Over Exploration: Unmasking the Bias in Linear Bandit Recommender Offline Evaluation — RecSys](https://dl.acm.org/doi/10.1145/3705328.3748166)
- [The Exploration-Exploitation Trade-off in Interactive Recommender Systems](https://www.researchgate.net/publication/319284200_The_Exploration-Exploitation_Trade-off_in_Interactive_Recommender_Systems)

## Recommended taxonomy JSON schema

Two-level hierarchy; every node anchors to a standard Apple Podcasts category (top-level
required, subcategory optional) so ingestion can pre-filter candidate feeds cheaply before
any LLM call.

```jsonc
// TaxonomyNode — one row per node (top-level branch OR leaf) in the user's interest tree
{
  "id": "engineering/precision-mfg",       // slash-path, top-level/leaf; top-level branches are custom, not Apple's
  "label": "Precision Manufacturing",
  "parentId": "engineering",                // null for top-level branches
  "appleCategoryAnchor": {                  // required — grounds the node in the industry-standard taxonomy
    "category": "Technology",               // one of the 19 Apple top-level categories
    "subcategory": null                     // Apple subcategory string, or null if the top-level has none/doesn't apply
  },
  "weight": 0.62,                           // -1..+1, durable taste signal (spec 03, Interest model)
  "confidence": 0.4,                        // 0..1, grows with evidence volume; gates cold-start exploration radius
  "lastEvidenceAt": "2026-07-02T14:00:00Z",
  "centroidEmbedding": {                    // running mean of positive-signal episode embeddings for this node
    "vector": [/* float[], same dim as episode embeddings */],
    "sampleCount": 14,                      // for EMA weighting of future updates
    "updatedAt": "2026-07-02T14:00:00Z"
  },
  "userEditable": true,                     // false only for system-managed nodes, if any ever exist
  "source": "onboarding-interview"          // onboarding-interview | inferred | voice-mutation | manual-edit
}
```

```jsonc
// EpisodeCurationAttributes — per-episode enrichment record produced by the classification cascade
{
  "episodeId": "…",
  "topics": ["engineering/precision-mfg", "science/materials"],  // taxonomy node ids, multi-label
  "appleCategories": [{ "category": "Technology", "subcategory": null }], // as declared in RSS, kept separately from inferred topics
  "depth": "medium",                        // low | medium | high — per-episode, NOT a taxonomy dimension (see Q3)
  "format": "interview",                    // interview | narrative | how-to | news | comedy | debate | solo — feeds Narrative/Comfort slot selection
  "evergreen": true,                        // Tier-1 classification tag; drives freshness decay curve
  "embedding": { "vector": [/* … */], "model": "…", "computedAt": "…" },
  "classificationTier": 1,                  // 1 = metadata-only, 2 = transcript-enriched (cost cascade per prompt doc)
  "sourceConfidence": 0.8
}
```

## Leverage vs. build

| Layer | Adopt from standards | Build custom |
|---|---|---|
| Top-level category vocabulary | Apple Podcasts' 19 categories / ~106 subcategories, via `<itunes:category>` in RSS and Podcast Index/iTunes Search filtering | — |
| Discipline coverage (engineering, craft, materials science as first-class topics) | — | Apple has no "Engineering" category and flat/no subcategories under History and Technology — the entire custom two-level tree seeded from onboarding exists because Apple's taxonomy is too shallow for this user's actual interests |
| Interest representation mechanics | Hybrid symbolic-tree + per-node centroid embedding (validated by Netflix's knowledge graph and academic hierarchical multi-interest modeling) | Single-user weight/confidence/last_evidence_at fields, voice-mutation update rules — no existing product exposes hand-editable per-node weights to an end user |
| Adjacency / serendipity computation | Embedding cosine similarity to node centroids (standard technique) | The Stretch-slot selection policy itself (near-not-inside radius, cold-node-with-high-quality fallback, damped negative-signal weighting) |
| Exploration mechanism | ε-greedy-as-guaranteed-slot, the dominant production pattern per bandit literature | Confidence-scaled radius decay; slot-provenance-tagged signal weighting |
| Difficulty/depth | Beginner/intermediate/advanced vocabulary borrowed from ed-tech (Coursera/Khan/Skillsoft) | No podcast product has this — the per-episode `depth` field, its inference in the classification cascade, and its use in scoring are all novel to this product |
| Format/evergreen tagging | Loosely modeled on how ed-tech and Spotify's topic modeling treat metadata-derived tags | Evergreen-vs-decaying freshness curve and format-driven slot assignment (Narrative/Comfort) are Foray-specific |
