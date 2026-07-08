import * as crypto from "crypto";
import { z } from "zod";
import { env } from "../config/env";

/**
 * Podcast Index API client (docs.podcastindex.org). Auth per their spec:
 * headers `X-Auth-Date` (unix seconds), `Authorization` = sha1(apiKey +
 * apiSecret + X-Auth-Date), `User-Agent` honest per corner case 8.
 *
 * Runs in dry-run mode (no network calls, deterministic canned responses)
 * whenever PODCASTINDEX_API_KEY/SECRET are absent from env — this keeps
 * `npm test` and `npm run build-session` fully offline per the project's
 * local-first / zero-cloud-dependency constraint.
 */

const PodcastFeedSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string(),
  originalUrl: z.string().optional(),
  link: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  image: z.string().optional(),
  artwork: z.string().optional(),
  newestItemPubdate: z.number().optional()
});
export type PodcastIndexFeed = z.infer<typeof PodcastFeedSchema>;

const SearchResponseSchema = z.object({
  status: z.string().optional(),
  feeds: z.array(PodcastFeedSchema).default([]),
  count: z.number().optional(),
  query: z.string().optional()
});

const EpisodeSchema = z.object({
  id: z.number(),
  title: z.string(),
  link: z.string().optional(),
  description: z.string().optional(),
  guid: z.string().optional(),
  datePublished: z.number().optional(),
  enclosureUrl: z.string().optional(),
  enclosureType: z.string().optional(),
  enclosureLength: z.number().optional(),
  duration: z.number().nullable().optional(),
  feedId: z.number().optional(),
  feedTitle: z.string().optional(),
  transcriptUrl: z.string().optional()
});
export type PodcastIndexEpisode = z.infer<typeof EpisodeSchema>;

const EpisodesResponseSchema = z.object({
  status: z.string().optional(),
  items: z.array(EpisodeSchema).default([]),
  count: z.number().optional()
});

export interface PodcastIndexClientOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class PodcastIndexClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  readonly dryRun: boolean;

  constructor(opts: PodcastIndexClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? "https://api.podcastindex.org/api/1.0";
    this.dryRun = env.podcastIndexDryRun;
  }

  private authHeaders(): Record<string, string> {
    const apiTime = Math.floor(Date.now() / 1000).toString();
    const key = env.podcastIndexApiKey ?? "";
    const secret = env.podcastIndexApiSecret ?? "";
    const hash = crypto
      .createHash("sha1")
      .update(key + secret + apiTime)
      .digest("hex");
    return {
      "X-Auth-Date": apiTime,
      "X-Auth-Key": key,
      Authorization: hash,
      "User-Agent": env.userAgent
    };
  }

  async searchByTerm(term: string): Promise<PodcastIndexFeed[]> {
    if (this.dryRun) {
      return [stubFeed(term)];
    }
    const url = `${this.baseUrl}/search/byterm?q=${encodeURIComponent(term)}`;
    const res = await this.fetchImpl(url, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Podcast Index search failed: HTTP ${res.status}`);
    const json = await res.json();
    return SearchResponseSchema.parse(json).feeds;
  }

  async episodesByFeedId(feedId: number, opts: { max?: number } = {}): Promise<PodcastIndexEpisode[]> {
    if (this.dryRun) {
      return [stubEpisode(feedId)];
    }
    const max = opts.max ?? 50;
    const url = `${this.baseUrl}/episodes/byfeedid?id=${feedId}&max=${max}`;
    const res = await this.fetchImpl(url, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Podcast Index episodes failed: HTTP ${res.status}`);
    const json = await res.json();
    return EpisodesResponseSchema.parse(json).items;
  }
}

function stubFeed(term: string): PodcastIndexFeed {
  return {
    id: 0,
    title: `[dry-run] ${term}`,
    url: "https://example.invalid/dry-run-feed.xml",
    description: "Stub Podcast Index result — no API key configured.",
    author: "dry-run"
  };
}

function stubEpisode(feedId: number): PodcastIndexEpisode {
  return {
    id: 0,
    title: "[dry-run] stub episode",
    guid: `dry-run-${feedId}`,
    description: "Stub Podcast Index episode — no API key configured.",
    feedId,
    duration: null
  };
}
