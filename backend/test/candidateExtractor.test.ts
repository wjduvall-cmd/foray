import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  extractCandidatesFromMarkdown,
  extractJsonFences,
  normalizeCandidatesFromJson,
  normalizeDepth
} from "../src/curation/candidateExtractor";

const RESEARCH_DIR = path.resolve(__dirname, "..", "..", "docs", "research");

describe("normalizeDepth", () => {
  it('maps "medium-high" to high (rounds up ambiguous curator notation)', () => {
    expect(normalizeDepth("medium-high")).toBe("high");
  });
  it("maps plain high/medium/low through unchanged", () => {
    expect(normalizeDepth("high")).toBe("high");
    expect(normalizeDepth("medium")).toBe("medium");
    expect(normalizeDepth("low")).toBe("low");
  });
  it("defaults unrecognized text to low", () => {
    expect(normalizeDepth("who knows")).toBe("low");
  });
});

describe("extractJsonFences", () => {
  it("extracts a fenced ```json block and ignores ```jsonc blocks", () => {
    const md = "before\n```json\n[1,2,3]\n```\nmiddle\n```jsonc\n// comment\n{}\n```\nafter";
    const fences = extractJsonFences(md);
    expect(fences).toHaveLength(1);
    expect(JSON.parse(fences[0]!)).toEqual([1, 2, 3]);
  });
});

describe("extractCandidatesFromMarkdown against the real research docs", () => {
  it("extracts the fusion-candidates.md flat array as deep-learn candidates", () => {
    const md = fs.readFileSync(path.join(RESEARCH_DIR, "fusion-candidates.md"), "utf-8");
    const candidates = extractCandidatesFromMarkdown(md, "fusion-candidates.md", "deep-learn");

    expect(candidates.length).toBeGreaterThanOrEqual(10);
    for (const c of candidates) {
      expect(c.archetypeHint).toBe("deep-learn");
      expect(c.show.length).toBeGreaterThan(0);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.durationMin).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(c.curatedDepth);
    }
    // ids must be unique
    expect(new Set(candidates.map((c) => c.id)).size).toBe(candidates.length);
  });

  it("extracts other-slot-candidates.md's keyed shape into stretch/narrative/comfort pools", () => {
    const md = fs.readFileSync(path.join(RESEARCH_DIR, "other-slot-candidates.md"), "utf-8");
    const candidates = extractCandidatesFromMarkdown(md, "other-slot-candidates.md", null);

    const archetypes = new Set(candidates.map((c) => c.archetypeHint));
    expect(archetypes.has("stretch")).toBe(true);
    expect(archetypes.has("narrative")).toBe(true);
    expect(archetypes.has("comfort")).toBe(true);

    const stretchCandidates = candidates.filter((c) => c.archetypeHint === "stretch");
    expect(stretchCandidates.every((c) => typeof c.bridge === "string" && c.bridge.length > 0)).toBe(true);
  });

  it("skips curation-practices.md's jsonc schema-example blocks entirely", () => {
    const md = fs.readFileSync(path.join(RESEARCH_DIR, "curation-practices.md"), "utf-8");
    const candidates = extractCandidatesFromMarkdown(md, "curation-practices.md", null);
    expect(candidates).toHaveLength(0);
  });
});

describe("normalizeCandidatesFromJson", () => {
  it("normalizes a hand-written flat candidates file the same way as the markdown extractor", () => {
    const parsed = [
      {
        show: "Test Show",
        episode_title: "Test Episode",
        release_date: "2026-01-01",
        duration_min: 42,
        summary: "A test episode.",
        depth: "medium"
      }
    ];
    const candidates = normalizeCandidatesFromJson(parsed, "test.json", "comfort");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.archetypeHint).toBe("comfort");
    expect(candidates[0]!.id).toBe("test-show-test-episode");
  });
});
