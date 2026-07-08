# Foray — Claude Code briefing package

Six files. Drop the whole folder into your project root (or a `docs/brief/` folder) before starting Claude Code.

## How to kick off

Start Claude Code in an empty repo containing this folder and say:

> Read docs/brief/01_PROMPT.md and all companion files it references. Then produce: (1) your proposed repo structure, (2) the list of ADRs you intend to write for the "decide yourself" items, (3) a plan for milestone M0. Don't write application code until I approve the M0 plan.

Making it plan-first matters: the prompt intentionally leaves engineering decisions open, and you want to see its reasoning on the risky ones (audio session choreography, DAI handling, dedup identity) before code exists.

## File map

| File | What it is |
|---|---|
| `01_PROMPT.md` | Master prompt: product definition, hard constraints, decided items, items Claude Code must decide itself |
| `02_ARCHITECTURE.md` | System design, components, data model guidance, API surface |
| `03_CURATION_SPEC.md` | The recommendation logic — archetype slots, scoring, serendipity floor, learning signals |
| `04_VOICE_AUDIO_SPEC.md` | iOS audio engine, TTS intro rules, hold-to-talk + Siri intents, latency budgets |
| `05_CORNER_CASES.md` | 36 known failure modes as requirements (RSS weirdness, DAI, audio interruptions, feedback-loop collapse...) |
| `06_ROADMAP.md` | M0–M7 with acceptance criteria; M0 spikes retire the three biggest risks before real code |

## Things only you can do (Claude Code can't)

- Create the Apple Developer account artifacts and **apply for the CarPlay audio entitlement now** — approval takes weeks and M6 wants it.
- Get a Podcast Index API key (free, instant) and pick/fund a TTS provider account.
- The in-car testing in M0/M3/M4 acceptance criteria — that's you, in the driveway and then on Poway Rd.
- Honest judgment on M2's "would I actually pick something from this menu" gate. Don't let it pass on vibes; this gate is the whole product.

## Suggested first-session guardrail

Claude Code will be tempted to start with the fun part (curation). Hold it to the M0 order: the audio-session spike is the highest-risk item in the project and the one most likely to force architectural changes if it goes badly.
