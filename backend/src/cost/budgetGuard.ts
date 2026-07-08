import { env } from "../config/env";
import { costEvents, defaultCostEventSink, startOfLocalDayIso, type CostEventInput, type CostEventSink } from "./costEvents";

/**
 * Daily budget cap (01_PROMPT.md #8, corner case 33: "A bug queues 500
 * episodes for transcription overnight"). The cap halts Tier 2 (transcript
 * enrichment) first, then Tier 1 (cheap classification), and never blocks
 * Tier 0 (free metadata normalization) or feed ingestion — matching
 * 02_ARCHITECTURE.md's enrichment pipeline description verbatim.
 *
 * Every LLM/TTS call site should call `budgetGuard.checkAndRecord(...)`
 * rather than writing to costEvents directly, so the cap is structurally
 * impossible to bypass by accident.
 */

export class BudgetExceededError extends Error {
  constructor(
    public readonly tier: 0 | 1 | 2,
    public readonly spentUsd: number,
    public readonly attemptedUsd: number,
    public readonly capUsd: number
  ) {
    super(
      `Daily budget exceeded for tier ${tier}: spent $${spentUsd.toFixed(4)} + attempted $${attemptedUsd.toFixed(4)} > cap $${capUsd.toFixed(4)}`
    );
    this.name = "BudgetExceededError";
  }
}

/** Fraction of the daily budget each tier is allowed to consume before it gets cut off. */
const TIER_CUTOFF_FRACTION: Record<0 | 1 | 2, number> = {
  0: Number.POSITIVE_INFINITY, // ingestion / metadata-only: never budget-gated
  1: 1.0, // cheap classification: allowed up to the full daily budget
  2: 0.6 // transcript enrichment: cut off earlier, leaving headroom for Tier 1 and TTS
};

export class BudgetGuard {
  constructor(
    private readonly sink: CostEventSink = defaultCostEventSink,
    private readonly dailyBudgetUsd: number = env.dailyBudgetUsd
  ) {}

  private tierOf(operation: string): 0 | 1 | 2 {
    if (operation.startsWith("tier2")) return 2;
    if (operation.startsWith("tier1")) return 1;
    if (operation.startsWith("tier0")) return 0;
    // TTS / voice-intent / why-line calls aren't tier-prefixed; treat as tier 1
    // (cheap-LLM-class spend) for cutoff purposes.
    return 1;
  }

  /**
   * Throws BudgetExceededError if recording `estimatedUsd` would push
   * today's spend for this operation's tier past its cutoff. On success,
   * records the cost event and returns it.
   */
  async checkAndRecord(input: CostEventInput) {
    const tier = this.tierOf(input.operation);
    const cap = this.dailyBudgetUsd * TIER_CUTOFF_FRACTION[tier];
    const since = startOfLocalDayIso();
    const spent = await this.sink.sumUsdSince(input.userId, since);

    if (Number.isFinite(cap) && spent + input.estimatedUsd > cap) {
      throw new BudgetExceededError(tier, spent, input.estimatedUsd, cap);
    }

    return this.sink.record(input);
  }

  async spentToday(userId: string): Promise<number> {
    return this.sink.sumUsdSince(userId, startOfLocalDayIso());
  }

  async remainingToday(userId: string): Promise<number> {
    const spent = await this.spentToday(userId);
    return Math.max(0, this.dailyBudgetUsd - spent);
  }
}

/** Process-wide default guard, wired to the default in-memory sink and env budget. */
export const defaultBudgetGuard = new BudgetGuard(defaultCostEventSink, env.dailyBudgetUsd);

// re-export so call sites can `import { costEvents } from "../cost/budgetGuard"` if preferred
export { costEvents };
