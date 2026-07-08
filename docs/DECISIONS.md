# DECISIONS.md — running changelog

Per-topic ADRs live in `docs/adr/`. This file is the chronological record.

## 2026-07-07 (overnight web-first sprint)

- **Web-first pivot.** First deliverable is a deployed static site (GitHub Pages), not the iOS app — App Store distribution wasn't feasible for a next-morning test. The site front-loads the M2 curation-quality gate ("would I pick something from this menu?"); the iOS roadmap in `docs/brief/06_ROADMAP.md` is unchanged, just re-sequenced. Audio-session choreography (M0's top risk) is untestable on web and remains the first iOS task.
- **Playback = external handoff.** Cards link out: Apple Podcasts (episode-level deep links), Overcast (show-level — Overcast has no public episode-URL scheme), pod.link (show-level universal links; covers Android testers). No hosted or proxied audio, consistent with hard constraint #3.
- **Repo is public** on GitHub (free Pages requires it). No secrets in repo; `.env` is gitignored with `.env.example` template committed.
- **Pages deploys from `main` branch root** (legacy build + `.nojekyll`), not GitHub Actions — the gh OAuth token lacks `workflow` scope. Revisit if/when `gh auth refresh -s workflow` is run.
- **Taxonomy anchors to Apple Podcasts categories** (the industry-standard taxonomy used by Podcast Index) with custom two-level nodes beneath, because Apple's tree has no Engineering category and no History/Science subtypes that match the user's interests. Depth (low/medium/high) is a **per-episode attribute**, not a taxonomy dimension. See `docs/research/curation-practices.md` and ADR-0003.
- **Session document v1** (`data/session.json`): cards with archetype/why_line/fit_line/alternates + an episodes map + browsable categories. The web client and the future iOS client consume the same document. `data/validated-links.json` is a generated overlay (resolved track IDs, artwork) so hand-curated data and machine-verified data stay separable.
- **Curation for session 1 was done by the architect (Claude) at build time**, from agent-researched candidates verified against the iTunes API. The backend session builder (in progress) reproduces this pipeline programmatically.
- **Commute parameters**: 15–20 min drive, playback at 1.5× → ~27 content-minutes per commute. Fit-lines speak in the user's effective listening time.
- **Long episodes are offered honestly** (e.g., the 3¼-hour Whyte episode is the Deep-learn lead with a "week of drives" fit-line) per the resume-across-sessions model — not filtered out.
- **Client-side event logging** (`localStorage`, capped at 500 events): session_shown / picked / refreshed. This is the learning-signal schema seed; syncs to the backend `events` table once it exists.
- **Podcast Index key is pending** (their signup email is slow) — everything tonight uses the keyless iTunes Search/Lookup API; the backend's Podcast Index client ships in dry-run mode.

## 2026-07-08 (first-morning feedback)

- **Discovery must feel like a splatter, not a directory.** Static category shelves replaced with a shuffled cross-topic feed: interest-weighted sampling with heavy jitter, a hard 30% exploration floor ("wildcards" that ignore weights), and no two adjacent items from the same topic branch. Taxonomy remains internal machinery + an editable interests panel, never the primary browse UI.
- **State is observed, never declared.** User principle: playback position, episode-finished status, and listening-stint length must be inferred by the system, not entered by the user. The iOS architecture already complies (15-second position persistence + events table drive the Continue card automatically). The web page's "Done ✓" button is a documented stopgap — external podcast apps hide playback position from us — and disappears when playback moves in-app.
- **Commute length is demoted from setting to learned parameter.** Dropped from all UI copy (no more "fits your drive" fit-lines; duration shown plainly). The user is happy spanning an episode across several drives. Session assembly's target duration should eventually be inferred from session start/stop events; retained internally only as a heuristic default (e.g. the web Continue-card threshold).
- **Fresh on every load.** Card slots shuffle their candidate chains per visit (already-played sink to the back); splatter excludes the ~36 most recently shown items. Stars/saves persist snapshots locally and gently boost topic weights (spec: "saved = right content, wrong time").
