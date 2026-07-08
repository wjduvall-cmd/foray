import { z } from "zod";
import { env } from "../config/env";

/**
 * iTunes Search/Lookup API client — keyless (no auth), used as
 * fallback/metadata source per 02_ARCHITECTURE.md. Since it's keyless there
 * is no "dry-run vs live" distinction driven by env presence; callers that
 * want offline-safe tests should pass a stub `fetchImpl`.
 */

const ItunesPodcastResultSchema = z.object({
  collectionId: z.number().optional(),
  trackId: z.number().optional(),
  collectionName: z.string().optional(),
  artistName: z.string().optional(),
  feedUrl: z.string().optional(),
  artworkUrl600: z.string().optional(),
  trackViewUrl: z.string().optional(),
  primaryGenreName: z.string().optional(),
  releaseDate: z.string().optional()
});
export type ItunesPodcastResult = z.infer<typeof ItunesPodcastResultSchema>;

const ItunesSearchResponseSchema = z.object({
  resultCount: z.number(),
  results: z.array(ItunesPodcastResultSchema)
});

export interface ItunesClientOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class ItunesClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: ItunesClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? "https://itunes.apple.com";
  }

  async searchPodcasts(term: string, opts: { limit?: number } = {}): Promise<ItunesPodcastResult[]> {
    const limit = opts.limit ?? 10;
    const url = `${this.baseUrl}/search?media=podcast&entity=podcast&limit=${limit}&term=${encodeURIComponent(term)}`;
    const res = await this.fetchImpl(url, { headers: { "User-Agent": env.userAgent } });
    if (!res.ok) throw new Error(`iTunes search failed: HTTP ${res.status}`);
    const json = await res.json();
    return ItunesSearchResponseSchema.parse(json).results;
  }

  async lookupByCollectionId(collectionId: number): Promise<ItunesPodcastResult | null> {
    const url = `${this.baseUrl}/lookup?id=${collectionId}`;
    const res = await this.fetchImpl(url, { headers: { "User-Agent": env.userAgent } });
    if (!res.ok) throw new Error(`iTunes lookup failed: HTTP ${res.status}`);
    const json = await res.json();
    const parsed = ItunesSearchResponseSchema.parse(json);
    return parsed.results[0] ?? null;
  }
}
