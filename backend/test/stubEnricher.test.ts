import { describe, it, expect } from "vitest";
import { StubEnricher } from "../src/enrich/StubEnricher";
import { InMemoryCostEventSink } from "../src/cost/costEvents";
import { BudgetGuard } from "../src/cost/budgetGuard";

describe("StubEnricher", () => {
  it("is deterministic — same input always produces the same classification", async () => {
    const enricher = new StubEnricher();
    const input = {
      episodeId: "ep-1",
      showTitle: "Test Show",
      title: "A Fixed Title",
      descriptionText: "Some description text about this episode.",
      durationSeconds: 3600
    };

    const first = await enricher.classifyTier1(input, { userId: "u1" });
    const second = await enricher.classifyTier1(input, { userId: "u1" });

    expect(second).toEqual(first);
  });

  it("produces different classifications for different episode ids", async () => {
    const enricher = new StubEnricher();
    const base = { showTitle: "Test Show", descriptionText: "desc", durationSeconds: 1800 };

    const a = await enricher.classifyTier1({ ...base, episodeId: "ep-a", title: "Title A" }, { userId: "u1" });
    const b = await enricher.classifyTier1({ ...base, episodeId: "ep-b", title: "Title B" }, { userId: "u1" });

    // Not a hard guarantee for every possible pair (finite topic pool), but
    // for these two specific fixture inputs the hash should diverge.
    expect(a.topics.join(",") === b.topics.join(",") && a.format === b.format).toBe(false);
  });

  it("always returns at least one topic and a valid format enum value", async () => {
    const enricher = new StubEnricher();
    const result = await enricher.classifyTier1(
      { episodeId: "ep-x", showTitle: "Show", title: "Title", descriptionText: "", durationSeconds: null },
      { userId: "u1" }
    );
    expect(result.topics.length).toBeGreaterThanOrEqual(1);
    expect(typeof result.format).toBe("string");
    expect(result.depth === "low" || result.depth === "medium" || result.depth === "high").toBe(true);
  });

  it("marks timely-sounding titles as non-evergreen (corner case 27: stale news)", async () => {
    const enricher = new StubEnricher();
    const result = await enricher.classifyTier1(
      { episodeId: "ep-news", showTitle: "News Show", title: "This Week in Tech: Breaking News", descriptionText: "", durationSeconds: 1200 },
      { userId: "u1" }
    );
    expect(result.evergreen).toBe(false);
  });

  it("records a zero-cost dry-run cost event for every classification and why-line call", async () => {
    const sink = new InMemoryCostEventSink();
    const guard = new BudgetGuard(sink, 2.0);
    const enricher = new StubEnricher(guard);

    await enricher.classifyTier1(
      { episodeId: "ep-1", showTitle: "Show", title: "Title", descriptionText: "d", durationSeconds: 100 },
      { userId: "u1" }
    );
    await enricher.generateWhyLine(
      { episodeId: "ep-1", showTitle: "Show", title: "Title", gist: "gist", archetype: "comfort", userContext: ["comedy"] },
      { userId: "u1" }
    );

    const events = await sink.all();
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.estimatedUsd === 0 && e.dryRun === true)).toBe(true);
    expect(events.map((e) => e.operation).sort()).toEqual(["tier1_classify", "why_line"]);
  });

  it("generates a why-line under a rough 18-word cap and states the bridge for the stretch archetype", async () => {
    const enricher = new StubEnricher();
    const result = await enricher.generateWhyLine(
      {
        episodeId: "ep-1",
        showTitle: "Show",
        title: "Damascus Steel Forging",
        gist: "gist",
        archetype: "stretch",
        userContext: ["Fusion & energy systems"],
        bridgeFrom: "engineering/energy-fusion"
      },
      { userId: "u1" }
    );

    expect(result.whyLine.split(/\s+/).length).toBeLessThanOrEqual(18);
    expect(result.whyLine.toLowerCase()).toContain("energy-fusion".split("-")[0]);
  });
});
