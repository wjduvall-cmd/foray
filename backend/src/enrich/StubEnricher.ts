import * as crypto from "crypto";
import { defaultBudgetGuard, type BudgetGuard } from "../cost/budgetGuard";
import type {
  ClassificationInput,
  ClassificationResult,
  Enricher,
  EnrichContext,
  WhyLineInput,
  WhyLineResult
} from "./Enricher";

/**
 * Deterministic fake classifier/why-line generator, used whenever
 * ANTHROPIC_API_KEY is absent (env.anthropicDryRun) so the whole pipeline —
 * including `npm run build-session` — runs with zero API keys and zero
 * network calls, per the project's local-first constraint.
 *
 * "Deterministic" means: the same input always produces the same output
 * (hash-derived), which makes fixture-based tests reproducible without
 * needing to mock a real LLM response.
 */

const FORMATS: ClassificationResult["format"][] = [
  "interview",
  "narrative",
  "how-to",
  "news",
  "comedy",
  "debate",
  "solo",
  "panel",
  "documentary",
  "hang"
];

const FALLBACK_TOPICS = [
  "engineering/energy-fusion",
  "engineering/precision-mfg",
  "science/materials",
  "history/military-ancient",
  "history/technology",
  "craft/instrument-making",
  "craft/diy-home",
  "business/startups",
  "comedy/casual-hangs"
];

function hashToInt(input: string): number {
  const digest = crypto.createHash("sha1").update(input).digest();
  return digest.readUInt32BE(0);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

export class StubEnricher implements Enricher {
  readonly providerName = "stub";

  constructor(private readonly budgetGuard: BudgetGuard = defaultBudgetGuard) {}

  async classifyTier1(input: ClassificationInput, ctx: EnrichContext): Promise<ClassificationResult> {
    // Still record a (zero-cost, dry-run) cost event: every call site routes
    // through the budget guard, stub or not, so cost_events stays a
    // complete ledger of every classification ever attempted.
    await this.budgetGuard.checkAndRecord({
      userId: ctx.userId,
      operation: "tier1_classify",
      provider: this.providerName,
      estimatedUsd: 0,
      dryRun: true,
      episodeId: input.episodeId,
      sessionId: ctx.sessionId
    });

    const seed = hashToInt(`${input.episodeId}|${input.title}`);

    const format = pick(FORMATS, seed);
    const depthSeed = input.durationSeconds ?? seed;
    const depth: ClassificationResult["depth"] = depthSeed > 5400 ? "high" : depthSeed > 1800 ? "medium" : "low";
    const evergreen = !/\b(this week|breaking|news|today|latest)\b/i.test(input.title);

    const topicCount = 1 + (seed % 2);
    const topics: string[] = [];
    for (let i = 0; i < topicCount; i++) {
      const t = pick(FALLBACK_TOPICS, seed + i * 97);
      if (!topics.includes(t)) topics.push(t);
    }

    const gist = input.descriptionText.length > 0
      ? input.descriptionText.slice(0, 140).trim() + (input.descriptionText.length > 140 ? "…" : "")
      : `[dry-run] ${input.title}`;

    return {
      topics,
      format,
      depth,
      evergreen,
      gist,
      guests: [],
      sourceConfidence: 0.4 // stub confidence is deliberately mediocre, never fed to production ranking
    };
  }

  async generateWhyLine(input: WhyLineInput, ctx: EnrichContext): Promise<WhyLineResult> {
    await this.budgetGuard.checkAndRecord({
      userId: ctx.userId,
      operation: "why_line",
      provider: this.providerName,
      estimatedUsd: 0,
      dryRun: true,
      episodeId: input.episodeId,
      sessionId: ctx.sessionId
    });

    const context = input.userContext[0] ?? "your listening history";
    let whyLine: string;
    if (input.archetype === "stretch" && input.bridgeFrom) {
      whyLine = `You're into ${input.bridgeFrom.split("/").pop()} — this bridges straight to ${input.title.slice(0, 40)}.`;
    } else {
      whyLine = `Ties back to ${context}: ${input.title.slice(0, 50)}.`;
    }
    // trim to a rough 18-word cap
    const words = whyLine.split(/\s+/);
    if (words.length > 18) whyLine = words.slice(0, 18).join(" ");

    return { whyLine };
  }
}
