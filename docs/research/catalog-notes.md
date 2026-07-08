# Catalog build notes — data/catalog.json

44 shows total: 17 carried over from `data/session.json` (collection ids reused, not
re-verified) + 27 newly researched and confirmed live against the iTunes Search/Lookup API.
Every leaf taxonomy node landed at 4-8 shows, so nothing fell below the 3-6 target.

## Easy nodes

- **engineering/energy-fusion (8 shows)** — already the deepest bench before this pass;
  `docs/research/fusion-candidates.md` had done the hard work. No new shows added, just
  mapped. This node could support a "fusion tour" indefinitely.
- **history/military-ancient (6)** and **history/technology (6)** — both flooded with
  candidates. Hardcore History, The Ancients, and Ancient History Fangirl all confirmed on
  the first search pass. The harder call was *trimming*, not filling — I skipped several
  other well-known ancient-history shows (e.g. The History of Rome, In Our Time) once the
  node hit 6.
- **comedy/casual-hangs (6)** and **business/startups (6)** — mainstream categories with
  huge iTunes coverage; every candidate matched cleanly on the first search term.

## Medium difficulty

- **craft/diy-home (5)** — plenty of woodworking/home-improvement shows exist, but most are
  hobbyist and thin on production quality. Wood Talk and Shop Talk Live (Fine Woodworking)
  were the strongest finds; Being an Engineer carries over as a dual-tagged bridge from
  precision-mfg.
- **engineering/precision-mfg (6)** — hit the ceiling but took more search iterations than
  expected. Two strong leads (Behind the Cut, a carbide-tooling show; and a "Chips and Tips"
  CNC show) did **not** resolve to a clean iTunes match on the terms tried, so they were
  dropped rather than guessed at.
- **science/materials (6, but only 3 are dedicated shows)** — Materialism, MRS Bulletin
  Materials News, and It's a Material World are the only shows whose entire premise is
  materials science; the rest of the count comes from dual-tagged general-audience or
  adjacent-node shows (SYSK, omega tau, MTDCNC). Dedicated materials podcasts are a genuinely
  small genre.

## Hard node (flagged in advance, confirmed sparse)

- **craft/instrument-making (4)** — as expected, this was the thinnest. Guitar-lutherie
  content is real but small (Luthier on Luthier, The Fretboard Journal), and outside guitar
  the field drops off fast. Violin Chronicles and Piano Tech Radio Hour filled it out but
  both show release gaps (Violin Chronicles: no confirmed episode since ~Mar 2026; Piano Tech
  Radio Hour: ~10 months quiet) — cadence_hint reflects that (`null` and `"ended"`
  respectively). If this node's weight rises, expect to widen scope to instrument *repair*
  and *restoration* shows generally, not just building.

## Data quality notes

- `cadence_hint` is inferred from each new show's most-recent iTunes-indexed release date
  vs. `built_at`, corroborated by `trackCount` and (for Luthier on Luthier) an explicit "every
  month" claim found during research. It is a snapshot heuristic, not a verified schedule —
  treat it as approximate, especially for shows sitting in the 1-6 month gap zone where I
  left it `null` rather than guess.
- Carried-over shows (from `session.json`) were **not** re-verified per the task instructions.
  `feed_url` for those 17 was reused from prior verified research
  (`docs/research/fusion-candidates.md`, `docs/research/other-slot-candidates.md`) rather
  than invented; `artwork_url`, `apple_genre`, `episode_count`, `explicit`, and `cadence_hint`
  are `null` for all of them since none of that was captured in the prior research passes.
- All 27 new shows returned `collectionExplicitness: "notExplicit"` from iTunes, including
  Bad Friends — Apple's collection-level flag doesn't always reflect individual-episode
  content, worth a spot-check later if explicit filtering ever matters.
- No collection id or feed URL in the file was invented; two dropped leads (noted above) are
  the only candidates abandoned due to failed iTunes verification.
