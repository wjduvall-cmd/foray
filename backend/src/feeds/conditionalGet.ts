import { env } from "../config/env";

export interface ConditionalGetState {
  etag: string | null;
  lastModified: string | null;
}

export interface FeedFetchResult {
  status: number;
  notModified: boolean;
  body: string | null;
  etag: string | null;
  lastModified: string | null;
  error?: string;
}

/**
 * Fetches a feed URL using conditional GET (ETag / If-Modified-Since) so
 * repeat polls cost the publisher (and us) as little as possible — the core
 * mechanic behind the polling-cadence ADR (0001). A 304 short-circuits with
 * `notModified: true` and no body.
 */
export async function fetchFeedConditional(
  url: string,
  prior: ConditionalGetState,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<FeedFetchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  const headers: Record<string, string> = {
    "User-Agent": env.userAgent,
    Accept: "application/rss+xml, application/xml, text/xml, */*"
  };
  if (prior.etag) headers["If-None-Match"] = prior.etag;
  if (prior.lastModified) headers["If-Modified-Since"] = prior.lastModified;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, { method: "GET", headers, signal: controller.signal });

    if (res.status === 304) {
      return { status: 304, notModified: true, body: null, etag: prior.etag, lastModified: prior.lastModified };
    }

    const etag = res.headers.get("etag");
    const lastModified = res.headers.get("last-modified");

    if (!res.ok) {
      return {
        status: res.status,
        notModified: false,
        body: null,
        etag,
        lastModified,
        error: `HTTP ${res.status}`
      };
    }

    const body = await res.text();
    return { status: res.status, notModified: false, body, etag, lastModified };
  } catch (err) {
    return {
      status: 0,
      notModified: false,
      body: null,
      etag: prior.etag,
      lastModified: prior.lastModified,
      error: `fetch error: ${(err as Error).message}`
    };
  } finally {
    clearTimeout(timer);
  }
}
