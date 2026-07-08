import { z } from "zod";
import type { Archetype } from "../types/session";

/**
 * Extracts episode candidates from the fenced ```json blocks embedded in
 * docs/research/*.md (fusion-candidates.md, other-slot-candidates.md) per
 * 01_PROMPT.md item 8: "With no database yet it can read candidates from
 * docs/research/*.md JSON blocks — write a small extractor."
 *
 * This is intentionally a stopgap: the real system ingests candidates from
 * the `episodes` + `episode_enrichment` tables (see migrations). This
 * extractor exists solely to prove the session-builder pipeline end-to-end
 * without a live database.
 */

const RawEpisodeSchema = z
  .object({
    show: z.string(),
    episode_title: z.string(),
    release_date: z.string(),
    duration_min: z.number(),
    apple_collection_id: z.number().nullable().optional(),
    apple_track_id: z.number().nullable().optional(),
    episode_guid: z.string().nullable().optional(),
    apple_url: z.string().optional(),
    feed_url: z.string().optional(),
    episode_page_url: z.string().nullable().optional(),
    summary: z.string(),
    reactor_types: z.array(z.string()).optional(),
    depth: z.string(), // free text in source docs, e.g. "medium-high" — normalized later
    bridge: z.string().optional(),
    caveats: z.string().optional()
  })
  .passthrough();
export type RawEpisode = z.infer<typeof RawEpisodeSchema>;

/** Matches fusion-candidates.md's top-level shape: a bare array of episodes. */
const FlatCandidateFileSchema = z.array(RawEpisodeSchema);

/** Matches other-slot-candidates.md's shape: keyed by archetype. */
const KeyedCandidateFileSchema = z.record(z.array(RawEpisodeSchema));

export interface NormalizedCandidate {
  id: string;
  archetypeHint: Archetype;
  show: string;
  title: string;
  releaseDate: string; // YYYY-MM-DD
  durationMin: number;
  appleCollectionId: number | null;
  appleTrackId: number | null;
  summary: string;
  reactorTypes: string[] | undefined;
  curatedDepth: "low" | "medium" | "high";
  bridge: string | undefined;
  sourceFile: string;
}

const ARCHETYPE_KEYS: Record<string, Archetype> = {
  "deep-learn": "deep-learn",
  deep_learn: "deep-learn",
  stretch: "stretch",
  narrative: "narrative",
  comfort: "comfort"
};

/**
 * Free-text depth values in the research docs ("medium-high", "high",
 * "medium", "low") aren't the strict low/medium/high enum the rest of the
 * system uses. Rule: if the string mentions "high" at all, call it high
 * (a curator wrote "medium-high" to mean "leans high, but hedge slightly" —
 * we round up rather than lose the signal that this is substantive
 * content); otherwise "medium" if mentioned; otherwise "low".
 */
export function normalizeDepth(raw: string): "low" | "medium" | "high" {
  const v = raw.toLowerCase();
  if (v.includes("high")) return "high";
  if (v.includes("medium")) return "medium";
  return "low";
}

/** Extracts the contents of every ```json ... ``` fenced block in a markdown string. */
export function extractJsonFences(markdown: string): string[] {
  const fenceRe = /```json\r?\n([\s\S]*?)```/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(markdown)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function toCandidate(raw: RawEpisode, archetypeHint: Archetype, sourceFile: string, usedIds: Set<string>): NormalizedCandidate {
  let id = `${slugify(raw.show)}-${slugify(raw.episode_title)}`;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${slugify(raw.show)}-${slugify(raw.episode_title)}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);

  return {
    id,
    archetypeHint,
    show: raw.show,
    title: raw.episode_title,
    releaseDate: raw.release_date,
    durationMin: raw.duration_min,
    appleCollectionId: raw.apple_collection_id ?? null,
    appleTrackId: raw.apple_track_id ?? null,
    summary: raw.summary,
    reactorTypes: raw.reactor_types,
    curatedDepth: normalizeDepth(raw.depth),
    bridge: raw.bridge,
    sourceFile
  };
}

/**
 * Normalizes one already-JSON.parse()'d value (either a flat array shape
 * like fusion-candidates.md, or a keyed {stretch:[...], ...} shape like
 * other-slot-candidates.md) into candidates, appending into `out`/`usedIds`.
 * Non-candidate JSON values (e.g. curation-practices.md's taxonomy schema
 * examples) are silently skipped — detected by not matching either shape.
 */
function normalizeParsedBlock(
  parsed: unknown,
  sourceFile: string,
  defaultArchetype: Archetype | null,
  usedIds: Set<string>,
  out: NormalizedCandidate[]
): void {
  const flat = FlatCandidateFileSchema.safeParse(parsed);
  if (flat.success && defaultArchetype) {
    for (const raw of flat.data) {
      out.push(toCandidate(raw, defaultArchetype, sourceFile, usedIds));
    }
    return;
  }

  const keyed = KeyedCandidateFileSchema.safeParse(parsed);
  if (keyed.success) {
    for (const [key, episodes] of Object.entries(keyed.data)) {
      const archetype = ARCHETYPE_KEYS[key];
      if (!archetype) continue; // not an archetype-keyed candidate block (e.g. schema examples)
      for (const raw of episodes) {
        out.push(toCandidate(raw, archetype, sourceFile, usedIds));
      }
    }
  }
  // else: not a candidate block at all (e.g. a single schema-example object) — skip
}

/**
 * Parses one markdown file's JSON fences into normalized candidates.
 * `defaultArchetype` handles files like fusion-candidates.md where the
 * whole file is one flat array with no per-episode archetype key (the
 * fusion tour is entirely deep-learn-pool material).
 */
export function extractCandidatesFromMarkdown(
  markdown: string,
  sourceFile: string,
  defaultArchetype: Archetype | null
): NormalizedCandidate[] {
  const fences = extractJsonFences(markdown);
  const usedIds = new Set<string>();
  const out: NormalizedCandidate[] = [];

  for (const fence of fences) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fence);
    } catch {
      continue; // not valid JSON — skip (e.g. jsonc with comments used elsewhere)
    }
    normalizeParsedBlock(parsed, sourceFile, defaultArchetype, usedIds, out);
  }

  return out;
}

/**
 * Loads candidates from a standalone JSON file (the "--candidates <path>"
 * CLI argument) using the same flat/keyed shape rules as the markdown
 * extractor, so a hand-written or DB-exported candidates file works
 * identically to the docs/research/*.md fixtures.
 */
export function normalizeCandidatesFromJson(
  parsed: unknown,
  sourceFile: string,
  defaultArchetype: Archetype | null
): NormalizedCandidate[] {
  const usedIds = new Set<string>();
  const out: NormalizedCandidate[] = [];
  normalizeParsedBlock(parsed, sourceFile, defaultArchetype, usedIds, out);
  return out;
}
