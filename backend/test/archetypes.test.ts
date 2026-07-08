import { describe, it, expect } from "vitest";
import { ARCHETYPE_LABELS, auditMenuDiversity, pickSlots } from "../src/curation/archetypes";
import type { Archetype } from "../src/types/session";

describe("pickSlots", () => {
  it("picks the highest-scored candidate per archetype and orders alternates by score", () => {
    const pools: Record<Archetype, { candidate: string; totalScore: number }[]> = {
      "deep-learn": [
        { candidate: "d-low", totalScore: 0.3 },
        { candidate: "d-high", totalScore: 0.9 },
        { candidate: "d-mid", totalScore: 0.6 }
      ],
      stretch: [{ candidate: "s-only", totalScore: 0.5 }],
      narrative: [],
      comfort: [{ candidate: "c-a", totalScore: 0.4 }]
    };

    const picks = pickSlots(pools);

    const deepLearn = picks.find((p) => p.archetype === "deep-learn")!;
    expect(deepLearn.pick).toBe("d-high");
    expect(deepLearn.alternates).toEqual(["d-mid", "d-low"]);

    // empty pools are skipped, not padded with anything
    expect(picks.find((p) => p.archetype === "narrative")).toBeUndefined();
  });

  it("respects maxAlternates", () => {
    const pools: Record<Archetype, { candidate: string; totalScore: number }[]> = {
      "deep-learn": Array.from({ length: 10 }, (_, i) => ({ candidate: `d-${i}`, totalScore: i })),
      stretch: [],
      narrative: [],
      comfort: []
    };
    const picks = pickSlots(pools, 2);
    expect(picks[0]!.alternates).toHaveLength(2);
  });

  it("every archetype has a human label", () => {
    for (const archetype of Object.keys(ARCHETYPE_LABELS) as Archetype[]) {
      expect(ARCHETYPE_LABELS[archetype].length).toBeGreaterThan(0);
    }
  });
});

describe("auditMenuDiversity", () => {
  it("passes a healthy diverse menu with no warnings", () => {
    const result = auditMenuDiversity({
      shows: ["Show A", "Show B", "Show C", "Show D"],
      topLevelTaxonomyBranches: ["engineering", "history", "comedy", "science"],
      durationsMin: [40, 50, 60, 45]
    });
    expect(result.warnings).toHaveLength(0);
    expect(result.distinctShows).toBe(4);
  });

  it("warns when fewer than 3 distinct shows (corner case 25: feedback loop collapse)", () => {
    const result = auditMenuDiversity({
      shows: ["Show A", "Show A", "Show B"],
      topLevelTaxonomyBranches: ["engineering", "history", "comedy"],
      durationsMin: [40, 50, 60]
    });
    expect(result.warnings.some((w) => w.includes("distinct shows"))).toBe(true);
  });

  it("warns when fewer than 3 distinct taxonomy branches", () => {
    const result = auditMenuDiversity({
      shows: ["A", "B", "C"],
      topLevelTaxonomyBranches: ["engineering", "engineering", "engineering"],
      durationsMin: [40, 50, 60]
    });
    expect(result.warnings.some((w) => w.includes("taxonomy branches"))).toBe(true);
  });

  it("warns when more than one item exceeds 90 minutes", () => {
    const result = auditMenuDiversity({
      shows: ["A", "B", "C"],
      topLevelTaxonomyBranches: ["a", "b", "c"],
      durationsMin: [120, 150, 40]
    });
    expect(result.warnings.some((w) => w.includes("90 minutes"))).toBe(true);
  });
});
