/**
 * Per-host (not per-feed — corner case 8) request budget + exponential
 * backoff skeleton. A single host can serve dozens of feeds (e.g. every
 * Libsyn/Megaphone/Buzzsprout show), so the budget has to be keyed on
 * hostname, or a large batch job hammers one host even while "politely"
 * spacing out per-feed requests.
 *
 * This is intentionally a small in-memory skeleton: real scheduling lives
 * in the ingest worker (not built in this pass — see ADR 0001), this module
 * gives it the primitive to decide "can I hit example.com right now?" and
 * "how long do I back off after a 429/5xx?".
 */

export interface HostBudgetConfig {
  /** minimum ms between requests to the same host under normal conditions */
  minIntervalMs: number;
  /** base backoff after a single failure */
  backoffBaseMs: number;
  /** cap so backoff doesn't grow unbounded */
  backoffMaxMs: number;
}

const DEFAULT_CONFIG: HostBudgetConfig = {
  minIntervalMs: 2_000,
  backoffBaseMs: 5_000,
  backoffMaxMs: 15 * 60_000 // 15 minutes
};

interface HostState {
  lastRequestAt: number;
  consecutiveFailures: number;
  blockedUntil: number;
}

export class PolitenessBudget {
  private readonly config: HostBudgetConfig;
  private readonly hosts = new Map<string, HostState>();

  constructor(config: Partial<HostBudgetConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private stateFor(host: string): HostState {
    let s = this.hosts.get(host);
    if (!s) {
      // lastRequestAt starts at -Infinity (not 0/epoch) so a host that has
      // never been requested is immediately allowed — treating "never
      // requested" as "requested at time zero" would otherwise impose a
      // spurious minInterval wait on the very first request.
      s = { lastRequestAt: Number.NEGATIVE_INFINITY, consecutiveFailures: 0, blockedUntil: 0 };
      this.hosts.set(host, s);
    }
    return s;
  }

  static hostOf(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return url;
    }
  }

  /** Returns ms to wait before it's polite to request `host` again (0 = go now). */
  msUntilAllowed(host: string, now = Date.now()): number {
    const s = this.stateFor(host);
    const blockedFor = s.blockedUntil - now;
    const spacedFor = s.lastRequestAt + this.config.minIntervalMs - now;
    return Math.max(0, blockedFor, spacedFor);
  }

  /** Call immediately before issuing a request to `host`. */
  recordRequestStart(host: string, now = Date.now()): void {
    this.stateFor(host).lastRequestAt = now;
  }

  /** Call after a successful (non-429/5xx) response. */
  recordSuccess(host: string): void {
    const s = this.stateFor(host);
    s.consecutiveFailures = 0;
    s.blockedUntil = 0;
  }

  /** Call after a 429 or 5xx — applies exponential backoff for this host. */
  recordFailure(host: string, now = Date.now()): number {
    const s = this.stateFor(host);
    s.consecutiveFailures += 1;
    const backoff = Math.min(
      this.config.backoffMaxMs,
      this.config.backoffBaseMs * 2 ** (s.consecutiveFailures - 1)
    );
    s.blockedUntil = now + backoff;
    return backoff;
  }

  consecutiveFailuresFor(host: string): number {
    return this.stateFor(host).consecutiveFailures;
  }
}

/** Hosts known to run dynamic ad insertion — seeds `shows.dai_suspected` (corner case 2). */
export const KNOWN_DAI_HOSTS = new Set([
  "megaphone.fm",
  "traffic.megaphone.fm",
  "acast.com",
  "sphinx.acast.com",
  "art19.com",
  "rss.art19.com"
]);

export function hostSuggestsDai(url: string): boolean {
  const host = PolitenessBudget.hostOf(url);
  return [...KNOWN_DAI_HOSTS].some((known) => host === known || host.endsWith(`.${known}`));
}
