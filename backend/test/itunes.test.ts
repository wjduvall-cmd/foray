import { describe, it, expect, vi } from "vitest";
import { ItunesClient } from "../src/clients/itunes";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body
  } as unknown as Response;
}

describe("ItunesClient (keyless — every test uses a stub fetchImpl, never the network)", () => {
  it("searchPodcasts parses results and sends an honest User-Agent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resultCount: 1,
        results: [{ collectionId: 123, collectionName: "Test Show", feedUrl: "https://example.com/feed.xml" }]
      })
    );
    const client = new ItunesClient({ fetchImpl });

    const results = await client.searchPodcasts("test show");

    expect(results).toHaveLength(1);
    expect(results[0]!.collectionId).toBe(123);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain("itunes.apple.com/search");
    expect(init.headers["User-Agent"]).toContain("Foray");
  });

  it("lookupByCollectionId returns the first result or null", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ resultCount: 0, results: [] }));
    const client = new ItunesClient({ fetchImpl });

    const result = await client.lookupByCollectionId(999);

    expect(result).toBeNull();
  });

  it("throws a clear error on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false));
    const client = new ItunesClient({ fetchImpl });

    await expect(client.searchPodcasts("x")).rejects.toThrow(/iTunes search failed/);
  });
});
