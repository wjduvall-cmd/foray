/**
 * Enrichment pipeline interface (02_ARCHITECTURE.md "Enrichment pipeline").
 * Tier-1 classification and why-line generation both go through this
 * interface so the session builder never cares whether it's talking to the
 * real Anthropic API or a deterministic stub. Every call MUST route through
 * the budget guard (src/cost/budgetGuard.ts) — see AnthropicEnricher for the
 * enforced call site.
 */

export interface ClassificationInput {
  episodeId: string;
  showTitle: string;
  title: string;
  descriptionText: string;
  durationSeconds: number | null;
}

export interface ClassificationResult {
  topics: string[]; // taxonomy node ids
  format: "interview" | "narrative" | "how-to" | "news" | "comedy" | "debate" | "solo" | "panel" | "documentary" | "hang";
  depth: "low" | "medium" | "high";
  evergreen: boolean;
  gist: string;
  guests: string[];
  sourceConfidence: number; // 0..1
}

export interface WhyLineInput {
  episodeId: string;
  showTitle: string;
  title: string;
  gist: string;
  archetype: "deep-learn" | "stretch" | "narrative" | "comfort";
  /** short strings describing the listener's relevant history/interests */
  userContext: string[];
  /** for the stretch slot: what taxonomy node this bridges from */
  bridgeFrom?: string;
}

export interface WhyLineResult {
  whyLine: string; // <= 18 words, per 03_CURATION_SPEC.md
}

export interface EnrichContext {
  userId: string;
  sessionId?: string;
}

export interface Enricher {
  readonly providerName: string;
  classifyTier1(input: ClassificationInput, ctx: EnrichContext): Promise<ClassificationResult>;
  generateWhyLine(input: WhyLineInput, ctx: EnrichContext): Promise<WhyLineResult>;
}
