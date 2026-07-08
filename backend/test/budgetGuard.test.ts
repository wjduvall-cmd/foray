import { describe, it, expect } from "vitest";
import { InMemoryCostEventSink } from "../src/cost/costEvents";
import { BudgetExceededError, BudgetGuard } from "../src/cost/budgetGuard";

describe("BudgetGuard", () => {
  it("records a cost event when under budget", async () => {
    const sink = new InMemoryCostEventSink();
    const guard = new BudgetGuard(sink, 2.0);

    const record = await guard.checkAndRecord({
      userId: "u1",
      operation: "tier1_classify",
      provider: "stub",
      estimatedUsd: 0.01
    });

    expect(record.estimatedUsd).toBe(0.01);
    expect(await guard.spentToday("u1")).toBeCloseTo(0.01);
  });

  it("throws BudgetExceededError when a Tier 1 call would exceed the full daily budget", async () => {
    const sink = new InMemoryCostEventSink();
    const guard = new BudgetGuard(sink, 1.0);

    await guard.checkAndRecord({ userId: "u1", operation: "tier1_classify", provider: "anthropic", estimatedUsd: 0.9 });

    await expect(
      guard.checkAndRecord({ userId: "u1", operation: "tier1_classify", provider: "anthropic", estimatedUsd: 0.2 })
    ).rejects.toThrow(BudgetExceededError);
  });

  it("cuts off Tier 2 (transcript) spend before Tier 1 (corner case 33 / 02_ARCHITECTURE.md)", async () => {
    const sink = new InMemoryCostEventSink();
    const guard = new BudgetGuard(sink, 1.0);

    // Tier 2 cuts off at 60% of budget by default — spend 0.55, leaving
    // headroom under the full budget but over the tier-2 cutoff.
    await guard.checkAndRecord({ userId: "u1", operation: "tier1_classify", provider: "anthropic", estimatedUsd: 0.55 });

    // A further tier-2 spend of 0.1 would push total to 0.65 > 0.6 cutoff — blocked.
    await expect(
      guard.checkAndRecord({ userId: "u1", operation: "tier2_transcript", provider: "anthropic", estimatedUsd: 0.1 })
    ).rejects.toThrow(BudgetExceededError);

    // But Tier 1 spend is still allowed up to the full budget.
    await expect(
      guard.checkAndRecord({ userId: "u1", operation: "tier1_classify", provider: "anthropic", estimatedUsd: 0.1 })
    ).resolves.toBeDefined();
  });

  it("never gates Tier 0 (ingestion / free metadata) spend", async () => {
    const sink = new InMemoryCostEventSink();
    const guard = new BudgetGuard(sink, 0.0); // zero budget

    await expect(
      guard.checkAndRecord({ userId: "u1", operation: "tier0_normalize", provider: "none", estimatedUsd: 0 })
    ).resolves.toBeDefined();
  });

  it("tracks spend separately per user", async () => {
    const sink = new InMemoryCostEventSink();
    const guard = new BudgetGuard(sink, 1.0);

    await guard.checkAndRecord({ userId: "u1", operation: "tier1_classify", provider: "anthropic", estimatedUsd: 0.5 });
    await guard.checkAndRecord({ userId: "u2", operation: "tier1_classify", provider: "anthropic", estimatedUsd: 0.5 });

    expect(await guard.spentToday("u1")).toBeCloseTo(0.5);
    expect(await guard.spentToday("u2")).toBeCloseTo(0.5);
  });

  it("remainingToday never goes negative", async () => {
    const sink = new InMemoryCostEventSink();
    const guard = new BudgetGuard(sink, 1.0);
    // directly seed the sink past budget (simulating an out-of-band cost event)
    await sink.record({ userId: "u1", operation: "tts_generate", provider: "elevenlabs", estimatedUsd: 5 });
    expect(await guard.remainingToday("u1")).toBe(0);
  });
});
