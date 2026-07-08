import { describe, it, expect, vi } from "vitest";
import { resolveRedirectChain } from "../src/feeds/redirect";

function mockResponse(status: number, headers: Record<string, string> = {}) {
  return {
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null }
  } as unknown as Response;
}

describe("resolveRedirectChain", () => {
  it("resolves a single-hop redirect and records both URLs", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(301, { location: "https://real-cdn.example.com/file.mp3" }))
      .mockResolvedValueOnce(mockResponse(206));

    const result = await resolveRedirectChain("https://podtrac.com/a/b.mp3", { fetchImpl });

    expect(result.ok).toBe(true);
    expect(result.originalUrl).toBe("https://podtrac.com/a/b.mp3");
    expect(result.resolvedUrl).toBe("https://real-cdn.example.com/file.mp3");
    expect(result.hops).toEqual(["https://podtrac.com/a/b.mp3"]);
  });

  it("follows a multi-hop tracking-prefix chain (corner case 1: podtrac -> chartable -> cdn)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(302, { location: "https://chartable.com/x" }))
      .mockResolvedValueOnce(mockResponse(302, { location: "https://real-cdn.example.com/y.mp3" }))
      .mockResolvedValueOnce(mockResponse(200));

    const result = await resolveRedirectChain("https://podtrac.com/a", { fetchImpl });

    expect(result.ok).toBe(true);
    expect(result.resolvedUrl).toBe("https://real-cdn.example.com/y.mp3");
    expect(result.hops).toEqual(["https://podtrac.com/a", "https://chartable.com/x"]);
  });

  it("gives up after the redirect cap and reports an error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(302, { location: "https://loops.example.com/" }));

    const result = await resolveRedirectChain("https://loops.example.com/", { fetchImpl, maxRedirects: 3 });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exceeded max redirects/);
  });

  it("reports an error when a redirect has no Location header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(302, {}));

    const result = await resolveRedirectChain("https://broken.example.com/", { fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no Location header/);
  });

  it("treats a non-redirect final status as resolved, including 4xx (still records it)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(404));

    const result = await resolveRedirectChain("https://gone.example.com/file.mp3", { fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.resolvedUrl).toBe("https://gone.example.com/file.mp3");
  });

  it("surfaces network errors without throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    const result = await resolveRedirectChain("https://flaky.example.com/", { fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ECONNRESET/);
  });
});
