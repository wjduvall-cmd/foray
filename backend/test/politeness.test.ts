import { describe, it, expect } from "vitest";
import { PolitenessBudget, hostSuggestsDai } from "../src/feeds/politeness";

describe("PolitenessBudget", () => {
  it("allows the first request to a host immediately", () => {
    const budget = new PolitenessBudget();
    expect(budget.msUntilAllowed("example.com", 1000)).toBe(0);
  });

  it("enforces the minimum interval between requests to the same host", () => {
    const budget = new PolitenessBudget({ minIntervalMs: 5000 });
    budget.recordRequestStart("example.com", 1000);
    expect(budget.msUntilAllowed("example.com", 2000)).toBe(4000);
    expect(budget.msUntilAllowed("example.com", 6000)).toBe(0);
  });

  it("budgets are per-host, not per-feed (corner case 8)", () => {
    const budget = new PolitenessBudget({ minIntervalMs: 5000 });
    budget.recordRequestStart("shared-host.com", 1000);
    // a different feed on the SAME host is still budget-limited
    expect(budget.msUntilAllowed("shared-host.com", 2000)).toBeGreaterThan(0);
    // a different host entirely is unaffected
    expect(budget.msUntilAllowed("other-host.com", 2000)).toBe(0);
  });

  it("applies exponential backoff after failures", () => {
    const budget = new PolitenessBudget({ backoffBaseMs: 1000, backoffMaxMs: 60_000 });
    const b1 = budget.recordFailure("flaky.com", 0);
    const b2 = budget.recordFailure("flaky.com", 0);
    const b3 = budget.recordFailure("flaky.com", 0);
    expect(b1).toBe(1000);
    expect(b2).toBe(2000);
    expect(b3).toBe(4000);
  });

  it("caps backoff at backoffMaxMs", () => {
    const budget = new PolitenessBudget({ backoffBaseMs: 1000, backoffMaxMs: 5000 });
    for (let i = 0; i < 10; i++) budget.recordFailure("flaky.com", 0);
    expect(budget.recordFailure("flaky.com", 0)).toBe(5000);
  });

  it("recordSuccess resets consecutive failure count and any block", () => {
    const budget = new PolitenessBudget({ backoffBaseMs: 1000 });
    budget.recordFailure("host.com", 0);
    budget.recordFailure("host.com", 0);
    expect(budget.consecutiveFailuresFor("host.com")).toBe(2);
    budget.recordSuccess("host.com");
    expect(budget.consecutiveFailuresFor("host.com")).toBe(0);
    expect(budget.msUntilAllowed("host.com", 0)).toBe(0);
  });

  it("hostOf extracts hostname from a URL, falling back to the raw string on invalid URLs", () => {
    expect(PolitenessBudget.hostOf("https://example.com/feed.xml")).toBe("example.com");
    expect(PolitenessBudget.hostOf("not a url")).toBe("not a url");
  });
});

describe("hostSuggestsDai", () => {
  it("flags known DAI hosts (Megaphone, Acast, Art19)", () => {
    expect(hostSuggestsDai("https://feeds.megaphone.fm/catalyst")).toBe(true);
    expect(hostSuggestsDai("https://sphinx.acast.com/show/feed")).toBe(true);
    expect(hostSuggestsDai("https://rss.art19.com/show")).toBe(true);
  });

  it("does not flag unrelated hosts", () => {
    expect(hostSuggestsDai("https://lexfridman.com/feed/podcast/")).toBe(false);
  });
});
