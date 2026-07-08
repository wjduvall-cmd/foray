import { describe, it, expect, vi } from "vitest";
import { PodcastIndexClient } from "../src/clients/podcastIndex";

describe("PodcastIndexClient — dry-run mode (no credentials in env)", () => {
  it("reports dryRun = true when no key/secret are configured", () => {
    const client = new PodcastIndexClient();
    expect(client.dryRun).toBe(true);
  });

  it("searchByTerm returns a stub feed without making a network call", async () => {
    const fetchImpl = vi.fn();
    const client = new PodcastIndexClient({ fetchImpl });

    const results = await client.searchByTerm("fusion energy");

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toContain("fusion energy");
  });

  it("episodesByFeedId returns a stub episode without making a network call", async () => {
    const fetchImpl = vi.fn();
    const client = new PodcastIndexClient({ fetchImpl });

    const results = await client.episodesByFeedId(12345);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]!.feedId).toBe(12345);
  });
});
