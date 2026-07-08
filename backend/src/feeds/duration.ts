/**
 * Normalizes `<itunes:duration>` into seconds. Real-world feeds emit this
 * field in at least four shapes (corner case 5): `HH:MM:SS`, `MM:SS`, bare
 * seconds, or outright garbage. Treat all of it as a hint, never a fact
 * (corner case 6) — callers should reconcile against the downloaded file
 * when precision actually matters.
 */

export interface NormalizedDuration {
  seconds: number | null;
  raw: string | null;
  reasonIfNull?: string;
}

export function normalizeDuration(raw: string | number | null | undefined): NormalizedDuration {
  if (raw === null || raw === undefined) {
    return { seconds: null, raw: null, reasonIfNull: "missing" };
  }

  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) {
      return { seconds: null, raw: String(raw), reasonIfNull: "non-finite-number" };
    }
    return { seconds: Math.round(raw), raw: String(raw) };
  }

  const rawString = String(raw).trim();
  if (rawString.length === 0) {
    return { seconds: null, raw: rawString, reasonIfNull: "empty-string" };
  }

  // bare seconds: "1834"
  if (/^\d+$/.test(rawString)) {
    const seconds = parseInt(rawString, 10);
    return { seconds, raw: rawString };
  }

  // HH:MM:SS or MM:SS or even just "SS" with colons, possibly with leading/trailing junk stripped
  const colonMatch = rawString.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colonMatch) {
    const a = parseInt(colonMatch[1] ?? "0", 10);
    const b = parseInt(colonMatch[2] ?? "0", 10);
    const c = colonMatch[3] !== undefined ? parseInt(colonMatch[3], 10) : undefined;

    let seconds: number;
    if (c !== undefined) {
      // HH:MM:SS
      seconds = a * 3600 + b * 60 + c;
    } else {
      // MM:SS
      seconds = a * 60 + b;
    }

    if (b >= 60 || (c !== undefined && c >= 60)) {
      // e.g. "12:75" — malformed but recoverable-ish; still flag as garbage
      // since the minutes/seconds component is out of range.
      return { seconds: null, raw: rawString, reasonIfNull: "out-of-range-component" };
    }

    return { seconds, raw: rawString };
  }

  // Decimal seconds, e.g. "1834.5"
  const floatMatch = rawString.match(/^\d+\.\d+$/);
  if (floatMatch) {
    return { seconds: Math.round(parseFloat(rawString)), raw: rawString };
  }

  return { seconds: null, raw: rawString, reasonIfNull: "unparseable" };
}
