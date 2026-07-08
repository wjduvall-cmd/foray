import { describe, it, expect } from "vitest";
import { computeFatigue, computeFreshness, computeQuality, computeRelevance, scoreCandidate } from "../src/curation/scoring";
import type { TaxonomyNode } from "../src/types/taxonomy";

const NODES: TaxonomyNode[] = [
  { id: "engineering/energy-fusion", parent: "engineering", label: "Fusion", apple_anchor: "Science", weight: 1.0, confidence: 0.9, last_evidence_at: "2026-07-01" },
  { id: "comedy/casual-hangs", parent: "comedy", label: "Casual hangs", apple_anchor: "Comedy", weight: 0.6, confidence: 0.7, last_evidence_at: "2026-07-01" },
  { id: "news/politics", parent: "news", label: "Politics", apple_anchor: "News", weight: -0.8, confidence: 0.5, last_evidence_at: "2026-07-01" }
];

describe("computeRelevance", () => {
  it("scales a high positive taxonomy weight toward 1", () => {
    expect(computeRelevance(["engineering/energy-fusion"], NODES)).toBeCloseTo(1.0, 5);
  });

  it("scales a negative taxonomy weight toward 0", () => {
    expect(computeRelevance(["news/politics"], NODES)).toBeCloseTo(0.1, 5);
  });

  it("averages across multiple matched topics", () => {
    const r = computeRelevance(["engineering/energy-fusion", "comedy/casual-hangs"], NODES);
    expect(r).toBeGreaterThan(computeRelevance(["comedy/casual-hangs"], NODES));
  });

  it("returns a small non-zero floor for unclassified episodes (still explorable)", () => {
    expect(computeRelevance([], NODES)).toBe(0.1);
  });

  it("returns a cold-node floor for topics outside the user's taxonomy", () => {
    expect(computeRelevance(["some/unknown-node"], NODES)).toBe(0.15);
  });
});

describe("computeFreshness", () => {
  const now = new Date("2026-07-07T00:00:00Z");

  it("evergreen content decays very slowly", () => {
    const tenYearsAgo = new Date("2016-07-07T00:00:00Z").toISOString();
    expect(computeFreshness(tenYearsAgo, true, now)).toBeCloseTo(0, 1);
    const oneYearAgo = new Date("2025-07-07T00:00:00Z").toISOString();
    expect(computeFreshness(oneYearAgo, true, now)).toBeGreaterThan(0.8);
  });

  it("timely content decays within weeks", () => {
    const threeWeeksAgo = new Date("2026-06-16T00:00:00Z").toISOString();
    const freshness = computeFreshness(threeWeeksAgo, false, now);
    expect(freshness).toBeLessThan(0.4);
  });

  it("returns neutral 0.5 for an unparseable date", () => {
    expect(computeFreshness("not-a-date", true, now)).toBe(0.5);
  });

  it("today's episode scores near 1 regardless of evergreen flag", () => {
    expect(computeFreshness(now.toISOString(), false, now)).toBeCloseTo(1, 5);
  });
});

describe("computeQuality", () => {
  it("rewards higher curated depth", () => {
    expect(computeQuality("high", 0.5)).toBeGreaterThan(computeQuality("medium", 0.5));
    expect(computeQuality("medium", 0.5)).toBeGreaterThan(computeQuality("low", 0.5));
  });

  it("stays within [0,1]", () => {
    expect(computeQuality("high", 1)).toBeLessThanOrEqual(1);
    expect(computeQuality("low", 0)).toBeGreaterThanOrEqual(0);
  });
});

describe("computeFatigue", () => {
  const now = new Date("2026-07-07T00:00:00Z");

  it("no penalty with no recent picks of this show", () => {
    expect(computeFatigue("Some Show", [], now)).toBe(0);
  });

  it("mild penalty for exactly one recent pick", () => {
    const picks = [{ show: "Some Show", pickedAtIso: "2026-07-05T00:00:00Z" }];
    expect(computeFatigue("Some Show", picks, now)).toBe(0.2);
  });

  it("steep penalty for two or more picks in the trailing 7 days (03_CURATION_SPEC.md)", () => {
    const picks = [
      { show: "Some Show", pickedAtIso: "2026-07-05T00:00:00Z" },
      { show: "Some Show", pickedAtIso: "2026-07-02T00:00:00Z" }
    ];
    expect(computeFatigue("Some Show", picks, now)).toBeGreaterThanOrEqual(0.5);
  });

  it("ignores picks outside the trailing 7 days", () => {
    const picks = [{ show: "Some Show", pickedAtIso: "2026-06-01T00:00:00Z" }];
    expect(computeFatigue("Some Show", picks, now)).toBe(0);
  });

  it("ignores picks of a different show", () => {
    const picks = [{ show: "Other Show", pickedAtIso: "2026-07-05T00:00:00Z" }];
    expect(computeFatigue("Some Show", picks, now)).toBe(0);
  });
});

describe("scoreCandidate", () => {
  it("combines all four components with the documented sign (fatigue subtracts)", () => {
    const now = new Date("2026-07-07T00:00:00Z");
    const fresh = scoreCandidate(
      {
        topics: ["engineering/energy-fusion"],
        publishedAtIso: now.toISOString(),
        evergreen: true,
        depth: "high",
        sourceConfidence: 0.8,
        show: "Untouched Show"
      },
      NODES,
      [],
      undefined,
      now
    );
    const fatigued = scoreCandidate(
      {
        topics: ["engineering/energy-fusion"],
        publishedAtIso: now.toISOString(),
        evergreen: true,
        depth: "high",
        sourceConfidence: 0.8,
        show: "Overplayed Show"
      },
      NODES,
      [
        { show: "Overplayed Show", pickedAtIso: "2026-07-05T00:00:00Z" },
        { show: "Overplayed Show", pickedAtIso: "2026-07-02T00:00:00Z" }
      ],
      undefined,
      now
    );
    expect(fatigued.total).toBeLessThan(fresh.total);
  });
});
