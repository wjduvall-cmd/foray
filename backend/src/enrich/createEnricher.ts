import { env } from "../config/env";
import type { Enricher } from "./Enricher";
import { StubEnricher } from "./StubEnricher";

/**
 * Selects StubEnricher when ANTHROPIC_API_KEY is absent, AnthropicEnricher
 * otherwise. AnthropicEnricher is imported lazily so that merely requiring
 * this module never pulls in the Anthropic SDK client construction path —
 * keeps `npm test` fully offline-safe even if something imports this file
 * indirectly.
 */
export function createEnricher(): Enricher {
  if (env.anthropicDryRun) {
    return new StubEnricher();
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AnthropicEnricher } = require("./AnthropicEnricher") as typeof import("./AnthropicEnricher");
  return new AnthropicEnricher();
}
