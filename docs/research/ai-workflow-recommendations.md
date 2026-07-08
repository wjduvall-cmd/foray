# AI-assisted development workflow: research & execution plan

Researched 2026-07-07. Scope: what practitioners in 2025–2026 recommend for shipping AI-agent-built
software like Foray (static GH Pages frontend, Node/TS backend with 164 vitest tests, LLM curation
pipeline, agent-heavy Claude Code workflow), and a ranked list of actions executable **tonight**
with no new API keys or paid services.

---

## 1. Findings

### 1.1 Quality gates for AI-generated code

The consensus pattern: **move standards out of prompts and into deterministic pipeline gates.**
"A prompt can be ignored or fall out of context. A failed gate stops everything"
([Salesforce Engineering, "7 Patterns for Agentic Engineering"](https://engineering.salesforce.com/maintaining-code-quality-at-agent-speed-7-patterns-for-agentic-engineering/)).
Key recommendations that apply here:

- **Separate author from judge.** When the same agent writes code and tests, tests inherit the same
  misunderstandings. AI-generated tests are systematically shallower — they call a function and
  assert it doesn't throw, which counts toward coverage but verifies nothing
  ([Motomtech quality-gates guide](https://www.motomtech.com/blog-post/ai-generated-code-quality-gates/)).
- **Mutation testing grades the tests themselves.** For JS/TS the tool is **StrykerJS** (supports
  vitest, incremental mode, CI exit-code thresholds). Practitioners recommend scoping it to
  critical modules and changed code, not whole-repo nightly runs; ~70% mutation score is a common
  bar for AI-written code ([Augment Code mutation-testing guide](https://www.augmentcode.com/guides/mutation-testing-ai-generated-code)).
  For Foray the critical modules are `backend/src/curation/` (scoring, sessionBuilder) and
  `backend/src/identity/` (dedup) — bugs there silently degrade the product.
- **Property-based testing for anything that parses external data.** Rule of thumb: at least one
  **fast-check** property test per function that parses/validates/transforms external input
  (Motomtech, above). Foray's feed parser, duration parser, HTML stripper, and redirect handling
  all consume untrusted RSS data.
- **Gates must be independent of the generator** and have deterministic pass/fail
  ([Codacy on independent quality gates](https://blog.codacy.com/why-coding-agents-need-independent-quality-gates)).
  Order cheap gates first (lint/typecheck), parallelize the rest.

### 1.2 Security practice for AI-built apps

Studies through 2025–26 consistently find AI code carries more vulnerabilities than human code, and
AI-assisted commits leak secrets at roughly **2× the baseline rate** (3.2% vs 1.5% of public commits,
[Cloud Security Alliance research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-generated-code-security-vibe-coding-202/)).
The recommended minimum stack for a TS/JS project
([Vibe Coder tool comparison](https://blog.vibecoder.me/security-auditing-tools-ai-generated-code),
[Semgrep](https://semgrep.dev/)):

1. **Dependency scanner** — `npm audit` after every session where an agent touched package files.
2. **SAST** — Semgrep or ESLint security plugins (`eslint-plugin-security`,
   `eslint-plugin-no-secrets`). ESLint is the pragmatic choice here: npm-native, no Python/Docker.
3. **Secrets scanning on full git history** — gitleaks (single Go binary, `gitleaks git`).
   Critical for Foray because **the repo is public** and `.env` lives next to `.env.example`.
4. **Runtime/DAST** — OWASP ZAP **baseline scan** (spider + passive scan, no active attacks,
   minutes to run) is the standard "lightweight pen test"; it ships as a GitHub Action
   ([zaproxy/action-baseline](https://github.com/zaproxy/action-baseline),
   [Zimmergren walkthrough](https://zimmergren.net/security-scanning-with-github-actions-and-owasp-zap/)).
   Honest caveat for Foray: a static GH Pages site can't set response headers, so ZAP's findings
   would mostly be unfixable header warnings — low value until the real API exists.
5. **XSS review for data-driven frontends.** `app.js` renders catalog data through 12 `innerHTML`
   templates. An `esc()` helper exists and is used on text — good — but **URL-bearing attributes
   (`href`, `src`) are only HTML-escaped, not scheme-checked**. Today's data is build-time trusted;
   the moment the backend builds sessions from live RSS feeds, a feed-controlled
   `javascript:` or `data:` URL becomes stored XSS. Scheme allowlisting + a CSP `<meta>` tag
   (works on Pages) is the standard mitigation.

### 1.3 Evaluating LLM product features (why-lines, curation)

The strongest practitioner guidance ([Pragmatic Engineer's evals guide](https://newsletter.pragmaticengineer.com/p/evals)):

- **Start with error analysis, not a framework.** Read real outputs, annotate failures, group them.
- **Golden datasets with binary PASS/FAIL**, not 1–5 scales ("the distinction between a 3 and a 4
  is subjective and inconsistent").
- **Two eval tiers:** cheap **code-based assertions run on every commit**; LLM-as-judge runs less
  often. The harness should be task-agnostic — swap dataset + scoring config
  ([Galtea LLM-eval guide](https://galtea.ai/blog/llm-evaluation-complete-guide),
  [DeepEval LLM-as-judge guide](https://deepeval.com/guides/guides-llm-as-a-judge)).

Minimal harness for "are the why-lines good and staying good": a vitest suite over `data/session.json`
(and future generated sessions) asserting deterministic properties — length bounds, no banned
LLM-tell phrases, no claims contradicting episode metadata, no copy that violates recorded product
decisions (e.g. DECISIONS.md 2026-07-08 bans "fits your drive"-style commute copy). Keep a
`docs/evals/why-line-rubric.md` with PASS/FAIL examples so a future LLM judge (key already in
`.env` machinery via `@anthropic-ai/sdk`) grades against fixed criteria.

### 1.4 Agent workflow hygiene

From [Claude Code agent-teams docs](https://code.claude.com/docs/en/agent-teams),
[alexop.dev on deterministic orchestration](https://alexop.dev/posts/claude-code-workflows-deterministic-orchestration/),
and [MindStudio's workflow-pattern writeups](https://www.mindstudio.ai/blog/claude-code-agentic-workflow-patterns):

- **Builder–validator chains:** a dedicated validator/review step between agent output and merge
  catches what the builder can't see. Locally this is the `/code-review` + `/security-review`
  skills before merging any agent branch.
- **Lean CLAUDE.md + hooks as guardrails + plan-before-edit + subagents only for noisy research.**
  Multi-agent parallelism "doesn't make sense for 95% of tasks" and creates integration risk —
  individually-correct outputs that are mutually incompatible.
- **Known failure patterns to guard against:** agents gaming literal gates (deleting failing tests,
  loosening assertions), author-judge conflation, silent scope creep. Salesforce's advice: study
  the failure modes and encode defenses as gates, not instructions.
- **Headless CI agents** are recommended as reusable PR quality gates, but Foray's blocker is that
  the gh OAuth token **lacks `workflow` scope** (DECISIONS.md 2026-07-07) — pushes that modify
  `.github/workflows/` will be rejected until `gh auth refresh -s workflow` is run. Local git
  hooks are the workaround tonight.

### 1.5 Solo-dev force multipliers

- **Lighthouse + axe-core in the loop.** Automated tools cover ~30% of WCAG criteria; still worth
  running because they're nearly free ([Lighthouse a11y scoring](https://developer.chrome.com/docs/lighthouse/accessibility/scoring),
  [dev.to AI a11y-audit writeup](https://dev.to/agentkit/i-built-an-ai-agent-that-runs-accessibility-audits-on-every-deploy-heres-what-it-catches-that-3h03)).
  `npx lighthouse <url>` and `npx pa11y <url>` need no accounts. Budgets/CI later via
  [Lighthouse CI](https://www.debugbear.com/software/lighthouse-automation).
- **One `verify` command.** Every source agrees the single highest-leverage artifact is a
  one-command gate (`npm run verify` = typecheck + test + lint + audit + data validation) that
  both humans and agents run before declaring done, wired into a pre-push hook and CLAUDE.md.

---

## 2. Ranked execution list — tonight, this repo

Constraint notes: no new keys/paid services; pushing workflow-file changes needs
`gh auth refresh -s workflow` first (or edit via github.com); Windows host, npm-native tools preferred.

| # | Action | Effort | Protects against |
|---|--------|--------|------------------|
| 1 | **Secrets history scan.** `gitleaks git .` at repo root (install: `winget install Gitleaks.Gitleaks` or download the release binary). Repo is public and `.env` exists locally — verify nothing ever leaked into history, not just the working tree. Add `gitleaks protect --staged` guidance to CLAUDE.md. | S | Leaked Anthropic/Podcast Index keys in a public repo (AI-assisted commits leak at ~2× baseline). |
| 2 | **Harden `app.js` URL handling + CSP.** Add a `safeUrl()` helper allowlisting `https:` (and `itms`/`podcast` schemes actually used for app handoff) applied to every `href`/`src` interpolation; add a CSP `<meta http-equiv="Content-Security-Policy">` to `index.html` (`default-src 'self'; img-src https:; ...` — no inline script is used today, verify before setting `script-src`). Add a vitest/node test feeding a `javascript:alert(1)` URL through the render path. | S | Stored XSS the day session data starts flowing from live RSS feeds instead of hand curation. |
| 3 | **One-command verify gate.** In `backend/package.json` add `"verify": "npm run typecheck && npm test && npm audit --omit=dev --audit-level=high"`, plus a root pre-push git hook (`core.hooksPath` or `.git/hooks/pre-push`) running it and `node --check app.js` + the JSON-validation snippet already in `ci.yml`. Create a lean root `CLAUDE.md` instructing agents to run it before finishing any task and forbidding test deletion/loosening to make it pass. | S | The core agent failure mode: unverified "done"; gates beat prompts. |
| 4 | **Why-line/copy golden eval suite.** New `backend/test/whyLineEval.test.ts` loading `data/session.json` + a small golden fixture set: assert why-lines 30–160 chars, fit-lines present, banned-phrase list (`fits your drive`, `in this episode`, `delve`, `whether you're`, em-dash-overload heuristics), every card's `episode_id` resolves, durations in copy match episode metadata. Write `docs/evals/why-line-rubric.md` with 3 PASS / 3 FAIL annotated examples for a future LLM judge. Runs on every commit for free. | M | Silent copy-quality regression when the LLM session builder replaces hand curation; encodes DECISIONS.md copy rules as tests. |
| 5 | **ESLint security pass on backend + site.** `cd backend && npm i -D eslint @eslint/js typescript-eslint eslint-plugin-security eslint-plugin-no-secrets`, flat config extending `security/recommended`, script `"lint": "eslint src test ../app.js"`. Triage findings once (expect noise; fix real ones, disable rules with inline justification). Add to `verify`. | M | Injection/regex-DoS/hardcoded-credential patterns AI code introduces at elevated rates. |
| 6 | **Property-based tests for the parse layer.** `npm i -D fast-check`; add properties for the RSS/XML candidate extraction (`parser`), `duration` parsing (arbitrary junk strings never throw, round-trip sane values), `html` stripping (output never contains `<`), and dedup identity (idempotent, order-insensitive). | M | The classic AI-test gap: example-only tests on exactly the functions consuming untrusted feed data. |
| 7 | **Mutation-test the curation core.** `cd backend && npx stryker init` (vitest runner), `mutate: ["src/curation/**/*.ts", "src/identity/**/*.ts"]`, incremental mode on, `thresholds.break: 60` to start. Run once, read survivors, strengthen the 164-test suite where mutants survive. | M | Assertion-free/shallow tests that pass while scoring or dedup logic is actually broken. |
| 8 | **Lighthouse + pa11y audit of the live site.** `npx lighthouse https://wjduvall-cmd.github.io/foray/ --output html --output-path lighthouse.html --only-categories=performance,accessibility,best-practices` and `npx pa11y https://wjduvall-cmd.github.io/foray/`. Fix the top a11y findings (contrast, tap targets, aria on the star/refresh buttons). Record scores in DECISIONS.md as the baseline budget. | S | Unnoticed perf/a11y decay on the product surface the user actually tests every morning. |
| 9 | **Extend CI with the new gates** — add `typecheck`, `lint`, `verify`-equivalent steps to `.github/workflows/ci.yml`. **Precondition:** run `gh auth refresh -s workflow` first or the push is rejected; if that's interactive-blocked tonight, keep gates local (item 3) and note the TODO. | S | Gate drift between local and CI; makes the pipeline independent of any one agent session. |
| 10 | **ZAP baseline scan — defer.** Add `zaproxy/action-baseline` against the Pages URL only after the real API/backend deploys; on a header-less static host it yields mostly unfixable warnings. Note it in the backend README as a pre-launch checklist item. | S (later) | Pen-test coverage timed to when there is an attack surface worth testing. |

**Suggested execution order tonight:** 1 → 3 → 2 → 4 → 8 → 5 → 6 → 7, with 9 only if the token
scope refresh is possible non-interactively. Items 1–4 are the highest protection-per-minute.

---

## 3. Source list

- Salesforce Engineering — [Maintaining Code Quality at Agent Speed: 7 Patterns](https://engineering.salesforce.com/maintaining-code-quality-at-agent-speed-7-patterns-for-agentic-engineering/)
- Augment Code — [Mutation Testing for AI-Generated Code](https://www.augmentcode.com/guides/mutation-testing-ai-generated-code)
- Motomtech — [Quality Gates for AI-Generated Code](https://www.motomtech.com/blog-post/ai-generated-code-quality-gates/)
- Codacy — [Why Coding Agents Need Independent Quality Gates](https://blog.codacy.com/why-coding-agents-need-independent-quality-gates)
- Cloud Security Alliance — [AI-Generated Code Security / Vibe Coding research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-generated-code-security-vibe-coding-202/)
- Vibe Coder — [Security Auditing Tools for AI-Generated Code Compared](https://blog.vibecoder.me/security-auditing-tools-ai-generated-code); [Semgrep](https://semgrep.dev/)
- ZAP — [action-baseline](https://github.com/zaproxy/action-baseline); [Zimmergren: ZAP + GitHub Actions](https://zimmergren.net/security-scanning-with-github-actions-and-owasp-zap/)
- Pragmatic Engineer — [A pragmatic guide to LLM evals](https://newsletter.pragmaticengineer.com/p/evals); [Galtea eval guide](https://galtea.ai/blog/llm-evaluation-complete-guide); [DeepEval LLM-as-a-judge](https://deepeval.com/guides/guides-llm-as-a-judge)
- Claude Code — [Agent teams docs](https://code.claude.com/docs/en/agent-teams); [alexop.dev deterministic orchestration](https://alexop.dev/posts/claude-code-workflows-deterministic-orchestration/); [MindStudio workflow patterns](https://www.mindstudio.ai/blog/claude-code-agentic-workflow-patterns)
- A11y/perf — [Lighthouse a11y scoring](https://developer.chrome.com/docs/lighthouse/accessibility/scoring); [dev.to: a11y audits on every deploy](https://dev.to/agentkit/i-built-an-ai-agent-that-runs-accessibility-audits-on-every-deploy-heres-what-it-catches-that-3h03); [DebugBear Lighthouse automation](https://www.debugbear.com/software/lighthouse-automation)
