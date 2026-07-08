import { describe, it, expect } from "vitest";
import { createEnricher } from "../src/enrich/createEnricher";
import { StubEnricher } from "../src/enrich/StubEnricher";
import { env } from "../src/config/env";

describe("createEnricher", () => {
  it("returns a StubEnricher when ANTHROPIC_API_KEY is absent (repo .env is empty for this build)", () => {
    // This assertion documents the load-bearing assumption behind
    // "npm test never calls the real Anthropic API": as long as the repo's
    // .env has no ANTHROPIC_API_KEY, createEnricher() can only ever hand
    // back a StubEnricher, so nothing in the test suite can accidentally
    // construct a live client.
    expect(env.anthropicDryRun).toBe(true);
    const enricher = createEnricher();
    expect(enricher).toBeInstanceOf(StubEnricher);
    expect(enricher.providerName).toBe("stub");
  });
});
