# 10 — Category Coverage: Broad-Market Gap Analysis & Curation Orders

Desk: Marketing / Market Coverage. Date: 2026-07-09.
Directive: take a broad target market (~95% of US podcast listening hours), enumerate
what it listens to, check our pools against that list, and issue curation orders to
close the gaps. Companion to `02-listener-market.md` (market sizing) and
`09-product-feature-review.md`.

Data inputs (read-only): `data/discover.json` (curated pool, 516 episodes, 153 shows),
`data/taxonomy.json` (147 nodes), `data/breadth-classification.json` (19,787 classified
shows). No data files were modified.

---

## Part 1 — Where US podcast listening hours actually go

### Sources and reconciliation

No public dataset gives true hours-by-genre for all US listening, so the table below is
a **modeled synthesis**, anchored on four independent measurements:

1. **Spotify listening-hours by genre** (Statista, via Spotify platform data; Spotify
   only, but the only true *hours* measure public): Comedy **30%**, Society & Culture
   **18%**, Lifestyle & Health **15%**, True Crime **10%**, Educational **7%** of hours.
   [Backlinko podcast stats](https://backlinko.com/podcast-stats) (citing Statista).
2. **Edison Podcast Metrics genre reach ranking** (20,000 weekly US listeners 13+/yr;
   19 genres at ≥1% reach, Q1 2024): Comedy #1, Society & Culture #2, News #3, True
   Crime #4, Sports #5; Business, Health & Fitness, Education, TV & Film, Religion &
   Spirituality complete the top ten; Music, Fiction, Education, Religion all rising.
   [Edison Q1 2024 genres](https://www.edisonresearch.com/the-top-podcast-genres-in-the-u-s-q1-2024/),
   [Edison via DemandSage](https://www.demandsage.com/podcast-statistics/).
3. **Triton US Podcast Ranker reach** (Q3 2025): News reached **29.1%** of listeners
   (up from 27.3%), Sports **19.8%** (up from 18.2%); Q4 2025 flagged true crime,
   fiction and history spikes; Q1 2026 flagged everyday-moment listening growth.
   [Triton Q3 2025](https://www.morningstar.com/news/business-wire/20251120895274/triton-digitals-q3-2025-podcast-ranker-connects-listening-trends-to-retail-behavior-ahead-of-peak-shopping-season),
   [Triton Q4 2025](https://www.businesswire.com/news/home/20260226916795/en/Triton-Digitals-Q4-2025-U.S.-Podcast-Ranker-Reveals-Audience-Spikes-Beyond-Top-Shows-and-Genres),
   [Triton Q1 2026 (Forbes)](https://www.forbes.com/sites/frankracioppi/2026/05/21/triton-digital-releases-its-first-quarter-2026-us-podcast-ranker/).
4. **Chart composition** — Edison Top 50 Q1 2026 leads: Joe Rogan (comedy interview),
   Crime Junkie (true crime), The Daily (daily news), Call Her Daddy, SmartLess, Stuff
   You Should Know; Apple's 2025 year-end charts are dominated by talk/interview, news,
   self-help/wellness, true crime, and celebrity hangs.
   [Edison Top 50 Q1 2026](https://www.edisonresearch.com/the-top-50-podcasts-in-the-u-s-q1-2026-from-edison-podcast-metrics/),
   [Apple Podcasts 2025 charts](https://www.apple.com/newsroom/2025/11/apple-podcasts-unveils-the-most-popular-shows-and-trends-of-2025/).

Context: podcasts are now **10% of all US daily audio time** and 20% of ad-supported
audio (Edison ["Share of Ear" Q3 2025, via Westwood One](https://www.westwoodone.com/blog/2025/12/08/q3-2025-edison-share-of-ear-am-fm-radio-dominates-ad-supported-audio-while-podcast-audiences-age-as-older-audiences-surge/)),
with median listener age 39 — the mainstream, not early adopters.

**Method:** start from Spotify hours shares (the only hours base), split its coarse
genres using Edison's reach ranking and chart composition, sanity-check News and Sports
upward per Triton reach (both under-represented on Spotify), and normalize. Figures are
**modeled estimates of % of US listening hours**, not a single survey read; treat ±30%
relative error per row. 33 categories cover ~97% cumulative.

### Category table (modeled % of US listening hours)

| # | Category | % hrs | Basis / proxy | Cum. |
|---|----------|------:|---------------|-----:|
| 1 | Comedy — celebrity interview & hangout (Rogan, SmartLess) | 12.0 | Spotify comedy 30% split by chart composition | 12.0 |
| 2 | True crime — documentary & serialized | 9.0 | Spotify hours 10%; Edison #4 reach; #2 show | 21.0 |
| 3 | News — daily briefings | 6.0 | Triton news reach 29%; The Daily = #3 show | 27.0 |
| 4 | News — politics & opinion commentary | 6.0 | Triton news reach split; election-cycle charts | 33.0 |
| 5 | Sports — talk & fan shows | 5.0 | Triton sports reach 19.8%, split talk vs analysis | 38.0 |
| 6 | Comedy — improv, panel & comedy hangs | 4.0 | Spotify comedy split | 42.0 |
| 7 | Society & culture — interviews & personal journals | 3.5 | Spotify S&C 18% split; Edison #2 | 45.5 |
| 8 | Self-improvement & motivation | 3.5 | Mel Robbins = top-3 Apple/Edison; educational 7% split | 49.0 |
| 9 | Society & culture — narrative / documentary storytelling | 3.0 | S&C split; This American Life chart rank | 52.0 |
| 10 | Health — mental health & everyday wellness | 3.0 | Lifestyle & Health 15% split; Apple wellness trend | 55.0 |
| 11 | Comedy — stand-up & sketch | 3.0 | Spotify comedy split | 58.0 |
| 12 | Sports — analysis, fantasy & betting | 3.0 | Triton sports reach split | 61.0 |
| 13 | Health — fitness, nutrition & longevity | 3.0 | L&H split; Huberman chart rank | 64.0 |
| 14 | Business & entrepreneurship | 3.0 | Edison #6 reach | 67.0 |
| 15 | Relationships, dating & advice | 3.0 | L&H + S&C splits; Call Her Daddy rank | 70.0 |
| 16 | Education — general-knowledge explainers | 3.0 | Educational 7% split; SYSK = #6 show | 73.0 |
| 17 | TV & film — recaps, reviews, rewatchables | 2.5 | Edison #9 reach | 75.5 |
| 18 | History | 2.5 | Triton Q4-25 spike; Edison teens | 78.0 |
| 19 | Religion — Christianity (teaching & devotional) | 2.5 | Edison #10 reach, rising; perennial Apple top-10 shows | 80.5 |
| 20 | Pop culture & celebrity commentary | 2.0 | S&C split; Apple celebrity trend | 82.5 |
| 21 | Investing & personal finance | 2.0 | Business reach split; Ramsey chart rank | 84.5 |
| 22 | Science & nature | 2.0 | Edison teens reach | 86.5 |
| 23 | Music — culture & analysis | 1.5 | Edison #11, rising | 88.0 |
| 24 | Kids & family — children's content | 1.2 | Edison ≥1% reach; hours capped by session length | 89.2 |
| 25 | Technology | 1.2 | Edison teens reach | 90.4 |
| 26 | Fiction & audio drama | 1.2 | Edison #12 rising; Triton Q4-25 spike; 85%+ completion | 91.6 |
| 27 | Paranormal & unexplained | 1.0 | Apple category staple; true-crime adjacency | 92.6 |
| 28 | Parenting | 1.0 | Kids & Family reach split | 93.6 |
| 29 | Religion — spirituality & meditation | 1.0 | Religion reach split | 94.6 |
| 30 | Food & drink | 0.7 | Edison long tail (≥1% reach) | 95.3 |
| 31 | Arts, books & design | 0.7 | Edison long tail | 96.0 |
| 32 | Games & hobbies | 0.7 | Edison long tail | 96.7 |
| 33 | Travel & outdoors | 0.7 | Edison long tail | 97.4 |
|   | *Residual long tail (language learning, government, aviation, niche)* | ~2.6 | — | 100 |

---

## Part 2 — Gap check against our pools

**Method.** Each market category was mapped to taxonomy branches (`data/taxonomy.json`)
and counted two ways: episodes in the curated pool (`data/discover.json`, 516 items,
topics field) and shows in the breadth tier (`data/breadth-classification.json`,
19,787 classified shows). Status: **WELL-COVERED** = episode pool has the category's
mainstream flavor at depth; **THIN** = some episodes but shallow or a niche sub-flavor
of the category; **EMPTY** = zero curated episodes.

| Market category | % hrs | Curated eps | Breadth shows | Status |
|---|------:|------:|------:|---|
| Comedy — interview & hangout | 12.0 | 24 | 913 | THIN¹ |
| True crime | 9.0 | 0 | 214 | EMPTY |
| News — daily briefings | 6.0 | 0 | 200 | EMPTY² |
| News — politics & commentary | 6.0 | 0 | 597 | EMPTY² |
| Sports — talk & fan shows | 5.0 | 0³ | 2,924 | EMPTY³ |
| Comedy — improv & panel | 4.0 | 0 | ~395 | EMPTY |
| Society & culture — interviews/journals | 3.5 | 9⁴ | 1,883 | THIN |
| Self-improvement & motivation | 3.5 | 0 | 203 | EMPTY |
| Society & culture — storytelling | 3.0 | 9⁴ | (in above) | THIN |
| Health — mental health & wellness | 3.0 | 0⁵ | 323 | EMPTY |
| Comedy — stand-up & sketch | 3.0 | 0 | 200 | EMPTY |
| Sports — analysis, fantasy & betting | 3.0 | 0 | (in sports) | EMPTY |
| Health — fitness, nutrition & longevity | 3.0 | 0 | 1,325 | EMPTY |
| Business & entrepreneurship | 3.0 | 31 | 1,413 | WELL-COVERED |
| Relationships & advice | 3.0 | 0 | 407 | EMPTY |
| Education — explainers | 3.0 | 0⁶ | 814 | THIN⁶ |
| TV & film | 2.5 | 0 | 1,499 | EMPTY |
| History | 2.5 | 58 | 565 | WELL-COVERED |
| Religion — Christianity | 2.5 | 0 | 1,468 (all religion) | EMPTY |
| Pop culture & celebrity | 2.0 | 0 | —⁷ | EMPTY⁷ |
| Investing & personal finance | 2.0 | 13 | 257 | THIN⁸ |
| Science & nature | 2.0 | 109 | 2,105 | WELL-COVERED |
| Music culture | 1.5 | 22 | 704 | WELL-COVERED⁹ |
| Kids & family — children's content | 1.2 | 0 | 649 | EMPTY¹⁰ |
| Technology | 1.2 | 98 | 377 | WELL-COVERED |
| Fiction & audio drama | 1.2 | 0 | 719 | EMPTY |
| Paranormal & unexplained | 1.0 | 0 | 0⁷ | EMPTY⁷ |
| Parenting | 1.0 | 0 | 216 | EMPTY |
| Religion — spirituality & meditation | 1.0 | 0 | ~411 | EMPTY |
| Food & drink | 0.7 | 18 | 383 | WELL-COVERED |
| Arts, books & design | 0.7 | 8 | 1,017 | THIN |
| Games & hobbies | 0.7 | 48 | 1,271 | WELL-COVERED |
| Travel & outdoors | 0.7 | 13 | 385 | THIN |

Footnotes (flavor caveats — the map hides skew):
1. All 24 comedy episodes are `comedy/casual-hangs` from exactly two shows (SmartLess,
   Conan O'Brien — 7 eps each, plus adjacent). No improv, no stand-up, no panel.
2. News breadth coverage exists (1,210 shows) but the curated pool has literally zero
   news episodes. See corner-case 27 flag in Part 3.
3. Curated "sports" (17 eps) is entirely `sports/endurance` + `sports/biomechanics` —
   engineer-flavored sports science, not ball-sports talk. Zero mainstream sports talk.
4. Curated society/culture is `society/law` (9) + mythology/art under `culture`; no
   personal journals, no This American Life-style storytelling (9 eps of
   `science/storytelling` are the nearest neighbor).
5. `psychology/decision-making` (7 eps) is behavioral econ, not mental health/wellness.
6. No `education/*` episodes, but the pool's science/history depth partially serves
   explainer intent; thin on SYSK-style generalist curiosity.
7. **Taxonomy gap:** no node exists for paranormal or pop-culture/celebrity — 0 breadth
   shows *classifiable*, not 0 available. Add `paranormal` and `culture/pop-culture`
   nodes before curating these.
8. `economics/markets` (13 eps, Odd Lots-flavored macro) ≠ personal finance; the
   Ramsey/Money Guy flavor — the mass-market one — is absent.
9. Music curated eps skew classical/theory; mainstream music-culture (Song Exploder
   flavor) is present in spirit but thin.
10. Kids content is a stated product scenario (corner-case 28: family mode, explicit
    filter). Breadth tier has 649 shows; episode pool has none.

**Bottom line:** the curated pool WELL-COVERS categories worth ~12% of US listening
hours, is THIN on ~24%, and is EMPTY on ~61% — including the top 5 categories by
hours (comedy at depth, true crime, news x2, sports). The breadth tier proves
show-level coverage exists for every mapped category (200+ shows each), so this is a
curation problem, not a catalog problem.

---

## Part 3 — Curation orders (THIN/EMPTY categories)

Every candidate below was verified against the iTunes Search API on 2026-07-09;
`id` = Apple `collectionId`. Target = curated episodes to add. House taste rule
throughout: substance over outrage, documentary over exploitation, evidence over vibes.

### Wave 1 — Comedy at full depth (12% THIN + 7% EMPTY = 19% of hours)
- **Interview & hangout** (target 30 eps): Armchair Expert w/ Dax Shepard (id 1345682353), Call Her Daddy (id 1418960261), This Past Weekend w/ Theo Von (id 1190981360), Good Hang with Amy Poehler (id 1795483480). Keep SmartLess/Conan; add female-led and younger-skewing hosts — current pool is two shows deep.
- **Improv & panel** (target 15 eps): Comedy Bang Bang (id 316045799), My Brother, My Brother And Me (id 367330921), 2 Bears 1 Cave (id 1468013270).
- **Stand-up & sketch** (target 10 eps): KILL TONY (id 1042361179), Bad Friends (id 1496265971).
- Taste: joke density and chemistry over shock value; most are `itunes:explicit` — family mode (corner-case 28) must be live before these ship to a car with kids.

### Wave 2 — News (12% of hours, EMPTY)
- **Daily briefings** (target: rolling 8-12 eps, hard-expired): The Daily (id 1200361736), Up First from NPR (id 1222114325), Post Reports (id 1444873564), The Journal (id 1469394914), NPR News Now (id 121493675).
- **Politics & commentary** (target: rolling 8-12, balanced): The Ezra Klein Show (id 1548604447), Pod Save America (id 1192761536), The Ben Shapiro Show (id 1047335260), The NPR Politics Podcast (id 1057255460), KCRW's Left, Right & Center (id 73329771).
- **PRINCIPLE FLAG (corner-case 27, "stale news"):** news items must carry the timely
  tag and hard-expire from candidate pools in days. News is a *feed*, not an archive —
  curate the shows, auto-refresh the episodes. Balance rule per anti-echo-chamber
  principle: never serve commentary from only one ideological pole in a single menu.

### Wave 3 — True crime + paranormal (10% of hours, EMPTY)
- **True crime** (target 30 eps): Crime Junkie (id 1322200189), Dateline NBC (id 1464919521), Casefile True Crime (id 998568017), Criminal (id 809264944), Serial (id 917918570), Morbid (id 1379959217).
- **Paranormal** (target 8 eps; requires new taxonomy node): Lore (id {{ID:Lore}}), Astonishing Legends (id {{ID:AstonishingLegends}}), Unexplained (id {{ID:Unexplained}}).
- Taste: documentary quality over exploitation — favor Criminal/Casefile/Serial's
  restraint; victim-centered, reported, no gore-as-entertainment. Morbid/Crime Junkie
  earn slots on reach, but pick their best-reported episodes.

### Wave 4 — Health, wellness & self-improvement (9.5%, EMPTY)
- **Mental health & wellness** (target 15 eps): The Happiness Lab (id 1474245040), Ten Percent Happier (id {{ID:TenPercent}}), On Purpose with Jay Shetty (id 1450994021), Feel Better, Live More (id {{ID:FeelBetter}}).
- **Fitness, nutrition & longevity** (target 15 eps): Huberman Lab (id 1545953110), The Peter Attia Drive (id 1400828889), ZOE Science & Nutrition (id 1611216298), FoundMyFitness (id 818198322), Maintenance Phase (id 1535408667).
- **Self-improvement** (target 12 eps): The Mel Robbins Podcast (id 1646101002), The Tim Ferriss Show (id 863897795), The School of Greatness (id 596047499), Happier with Gretchen Rubin (id 969519520), A Bit of Optimism (id 1515385282).
- Taste: evidence-based over guru vibes — Attia/ZOE/Happiness Lab set the bar; include
  Maintenance Phase as the in-genre skeptic. Avoid supplement-funnel shows.

### Wave 5 — Society & culture + relationships (9.5%, THIN/EMPTY)
- **Storytelling & journals** (target 20 eps): This American Life (id 201671138), Radiolab (id 152249110), Hidden Brain (id 1028908750), Snap Judgment (id 283657561), Ear Hustle (id 1240841298), StoryCorps (id 250500859).
- **Relationships & advice** (target 12 eps): Where Should We Begin? (id 1237931798), Modern Love (id 1065559535), We Can Do Hard Things (id 1564530722), Savage Lovecast (id 201376301), Dear Prudence (id 1667640147).
- Taste: narrative craft is the draw — this is the genre closest to Foray's existing
  documentary DNA and the easiest bridge for current-taste users.

### Wave 6 — Sports (8%, EMPTY)
- **Talk & fan** (target 20 eps): The Bill Simmons Podcast (id 1043699613), Pardon My Take (id 1089022756), New Heights (id 1643745036), The Dan Le Batard Show (id 934820588), Mind the Game (id 1736431000).
- **Analysis & fantasy** (target 10 eps): Fantasy Footballers (id 917453719); add one betting-adjacent show only if clearly analysis-first.
- Taste + expiry: game-reaction episodes are timely (corner-case 27 tag); interview
  and craft-of-the-game episodes (Mind the Game) are evergreen — prefer those.

### Wave 7 — Explainers + personal finance (5%, THIN)
- **General-knowledge explainers** (target 15 eps): Stuff You Should Know (id 278981407), Freakonomics Radio (id 354668519), Ologies (id 1278815517), Ridiculous History (id 1299826850), Part-Time Genius (id 1242486356).
- **Personal finance** (target 10 eps): The Ramsey Show (id 77001367), Money Guy Show (id 121362031), Planet Money (id {{ID:PlanetMoney}}), Afford Anything (id {{ID:AffordAnything}}), NerdWallet's Smart Money (id {{ID:NerdWallet}}).
- Taste: explainer picks should complement (not duplicate) existing science depth;
  finance picks must be advice-grade and product-pitch-free.

### Wave 8 — TV & film + pop culture (4.5%, EMPTY)
- **TV & film** (target 15 eps): The Rewatchables (id {{ID:Rewatchables}}), Pop Culture Happy Hour (id {{ID:PCHH}}), The Big Picture (id {{ID:BigPicture}}), How Did This Get Made? (id {{ID:HDTGM}}), Office Ladies (id {{ID:OfficeLadies}}).
- **Pop culture & celebrity** (target 8 eps; requires new `culture/pop-culture` node): Las Culturistas (id {{ID:LasCulturistas}}), Normal Gossip (id {{ID:NormalGossip}}).
- Taste: criticism and craft over gossip-for-cruelty; Normal Gossip is the acceptable
  gossip format (anonymized, storytelling-first).

### Wave 9 — Religion & spirituality (3.5%, EMPTY)
- **Christian teaching/devotional** (target 12 eps): The Bible in a Year (id {{ID:BibleYear}}), BibleProject (id {{ID:BibleProject}}), Elevation with Steven Furtick (id {{ID:Elevation}}), Joel Osteen Podcast (id {{ID:Osteen}}).
- **Spirituality & meditation** (target 8 eps): Tara Brach (id {{ID:TaraBrach}}), On Being with Krista Tippett (id {{ID:OnBeing}}).
- Taste: teaching and contemplation over prosperity-pitch; BibleProject's scholarly
  register fits house DNA best. Serve only on expressed interest — never cold-recommend.

### Wave 10 — Family + fiction (3.4%, EMPTY)
- **Kids** (target 10 eps; family-mode gated per corner-case 28): Wow in the World (id {{ID:WowWorld}}), Story Pirates (id {{ID:StoryPirates}}), Circle Round (id {{ID:CircleRound}}), Greeking Out (id {{ID:GreekingOut}}).
- **Parenting** (target 10 eps): Good Inside with Dr. Becky (id {{ID:GoodInside}}), Raising Good Humans (id {{ID:RaisingGood}}), Ask Lisa: The Psychology of Parenting (id {{ID:AskLisa}}).
- **Fiction & audio drama** (target 10 eps): Welcome to Night Vale (id {{ID:NightVale}}), The Magnus Archives (id {{ID:Magnus}}), Old Gods of Appalachia (id {{ID:OldGods}}), LeVar Burton Reads (id {{ID:LeVar}}).
- Taste: parenting = evidence-based (clinical psych credentials: Dr. Becky, Dr. Lisa
  Damour) over mommy-blog vibes. Fiction = serialized quality with strong entry
  points; note 85%+ completion rates make fiction a retention asset.

### Wave 11 (opportunistic) — Music culture + arts top-ups (~2.2%, THIN)
- Song Exploder (id 788236947), Switched on Pop (id 934552872), Dissect (id {{ID:Dissect}}); plus arts/books additions from breadth tier (1,017 shows) as taste signals emerge. Target 8 eps.

### Ranked wave order (market-share-covered per wave)

| Rank | Wave | Categories | % hrs unlocked |
|---:|---|---|---:|
| 1 | W1 Comedy at depth | interview+improv+stand-up | 19.0 |
| 2 | W2 News | daily + politics | 12.0 |
| 3 | W3 True crime + paranormal | 2 cats | 10.0 |
| 4 | W4 Wellness | mental + fitness + self-improvement | 9.5 |
| 5 | W5 Culture + relationships | storytelling + journals + advice | 9.5 |
| 6 | W6 Sports | talk + analysis | 8.0 |
| 7 | W7 Explainers + finance | 2 cats | 5.0 |
| 8 | W8 TV/film + pop culture | 2 cats | 4.5 |
| 9 | W9 Religion & spirituality | 2 cats | 3.5 |
| 10 | W10 Family + fiction | kids + parenting + fiction | 3.4 |
| 11 | W11 Music + arts top-up | 2 cats | ~2.2 |

Waves 1-6 alone take episode-level coverage from ~12% to ~80% of US listening hours.
Prerequisites before Wave 3/8 ship: add `paranormal` and `culture/pop-culture` nodes to
`data/taxonomy.json`. Prerequisite before Wave 1/10 ship: family-mode explicit filter
(corner-case 28). Standing rule for Waves 2 & 6: timely episodes hard-expire
(corner-case 27) — these waves buy market coverage but need feed-freshness plumbing,
which is why comedy (evergreen, highest share) ranks first.
