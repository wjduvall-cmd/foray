import type { TaxonomyNode } from "../types/taxonomy";

/**
 * Scoring per 03_CURATION_SPEC.md:
 *   score = w_r*relevance + w_f*freshness + w_q*quality - w_d*fatigue
 *
 * Simplifications vs. the full spec (documented, not hidden — see ADR 0003
 * and the session builder CLI's console output): relevance uses taxonomy
 * weight matching only (no embedding-space adjacency yet — there's no
 * embedding pipeline in this pass); quality falls back to a depth-based
 * heuristic in the absence of real completion-rate history (cold start,
 * per 03_CURATION_SPEC.md "Cold start" section); fatigue is wired for real
 * use (takes trailing pick history) but the CLI currently calls it with an
 * empty history since there's no persisted `events` table yet.
 */

export interface ScoreWeights {
  relevance: number;
  freshness: number;
  quality: number;
  fatigue: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  relevance: 0.4,
  freshness: 0.2,
  quality: 0.25,
  fatigue: 0.15
};

export interface ScoreComponents {
  relevance: number;
  freshness: number;
  quality: number;
  fatigue: number;
  total: number;
}

/** Average taxonomy-node weight across the candidate's classified topics, clamped to [0,1]. */
export function computeRelevance(topics: string[], taxonomyNodes: TaxonomyNode[]): number {
  if (topics.length === 0) return 0.1; // unclassified — small non-zero floor, not zero (still explorable)
  const byId = new Map(taxonomyNodes.map((n) => [n.id, n]));
  const matched = topics.map((t) => byId.get(t)).filter((n): n is TaxonomyNode => n !== undefined);
  if (matched.length === 0) return 0.15; // topics exist but aren't in the user's taxonomy — cold node
  const avgWeight = matched.reduce((sum, n) => sum + n.weight, 0) / matched.length;
  // taxonomy weight is -1..+1; rescale to 0..1 for the additive scoring formula
  return Math.max(0, Math.min(1, (avgWeight + 1) / 2));
}

/**
 * Recency with format-aware decay (03_CURATION_SPEC.md: "news decays in
 * days; 'how guitars are made' is evergreen"). Evergreen content decays
 * over ~10 years; timely content decays over ~30 days.
 */
export function computeFreshness(publishedAtIso: string, evergreen: boolean, now: Date = new Date()): number {
  const published = new Date(publishedAtIso);
  if (Number.isNaN(published.getTime())) return 0.5; // unknown date — neutral
  const ageDays = Math.max(0, (now.getTime() - published.getTime()) / 86_400_000);
  const halfLifeDays = evergreen ? 3650 : 30;
  return Math.max(0, Math.min(1, 1 - ageDays / halfLifeDays));
}

/**
 * Cold-start quality proxy: depth-weighted baseline plus classifier
 * confidence. Once real event history exists (finish rates, show-level
 * track record — see 03_CURATION_SPEC.md), this should be replaced by a
 * learned per-show/per-format quality signal fed from the `events` table.
 */
export function computeQuality(depth: "low" | "medium" | "high", sourceConfidence: number): number {
  const depthBonus = depth === "high" ? 0.3 : depth === "medium" ? 0.15 : 0;
  return Math.max(0, Math.min(1, 0.5 + depthBonus * 0.5 + sourceConfidence * 0.2));
}

export interface RecentPick {
  show: string;
  pickedAtIso: string;
}

/**
 * Same-show repetition penalty over the trailing 7 days (03_CURATION_SPEC.md:
 * "same-show repetition penalty (>=2 picks of one show in trailing 7 days ->
 * steep)"). Returns 0..1, higher = more fatigued.
 */
export function computeFatigue(show: string, recentPicks: RecentPick[], now: Date = new Date()): number {
  const sevenDaysAgo = now.getTime() - 7 * 86_400_000;
  const recentSameShow = recentPicks.filter(
    (p) => p.show === show && new Date(p.pickedAtIso).getTime() >= sevenDaysAgo
  ).length;
  if (recentSameShow === 0) return 0;
  if (recentSameShow === 1) return 0.2;
  return Math.min(1, 0.5 + 0.25 * (recentSameShow - 1)); // steep beyond the 2nd pick
}

export function scoreCandidate(
  input: {
    topics: string[];
    publishedAtIso: string;
    evergreen: boolean;
    depth: "low" | "medium" | "high";
    sourceConfidence: number;
    show: string;
  },
  taxonomyNodes: TaxonomyNode[],
  recentPicks: RecentPick[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  now: Date = new Date()
): ScoreComponents {
  const relevance = computeRelevance(input.topics, taxonomyNodes);
  const freshness = computeFreshness(input.publishedAtIso, input.evergreen, now);
  const quality = computeQuality(input.depth, input.sourceConfidence);
  const fatigue = computeFatigue(input.show, recentPicks, now);

  const total = weights.relevance * relevance + weights.freshness * freshness + weights.quality * quality - weights.fatigue * fatigue;

  return { relevance, freshness, quality, fatigue, total };
}
