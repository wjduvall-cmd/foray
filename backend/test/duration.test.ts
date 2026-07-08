import { describe, it, expect } from "vitest";
import { normalizeDuration } from "../src/feeds/duration";

describe("normalizeDuration", () => {
  it("parses HH:MM:SS", () => {
    expect(normalizeDuration("01:02:03").seconds).toBe(3723);
  });

  it("parses H:MM:SS with no leading zero on hours (real lexfridman.xml format)", () => {
    expect(normalizeDuration("3:01:52").seconds).toBe(3 * 3600 + 1 * 60 + 52);
  });

  it("parses MM:SS", () => {
    expect(normalizeDuration("46:50").seconds).toBe(46 * 60 + 50);
  });

  it("parses bare seconds", () => {
    expect(normalizeDuration("2266").seconds).toBe(2266);
  });

  it("parses bare seconds given as a number", () => {
    expect(normalizeDuration(1834).seconds).toBe(1834);
  });

  it("parses 00:00:00 as zero, not null (garbage-but-parseable, per omegatau.xml)", () => {
    const result = normalizeDuration("00:00:00");
    expect(result.seconds).toBe(0);
    expect(result.reasonIfNull).toBeUndefined();
  });

  it("returns null with a reason for missing duration", () => {
    const result = normalizeDuration(undefined);
    expect(result.seconds).toBeNull();
    expect(result.reasonIfNull).toBe("missing");
  });

  it("returns null with a reason for empty string", () => {
    const result = normalizeDuration("");
    expect(result.seconds).toBeNull();
    expect(result.reasonIfNull).toBe("empty-string");
  });

  it("returns null with a reason for garbage text", () => {
    const result = normalizeDuration("not-a-duration");
    expect(result.seconds).toBeNull();
    expect(result.reasonIfNull).toBe("unparseable");
  });

  it("returns null for out-of-range MM component", () => {
    const result = normalizeDuration("12:75");
    expect(result.seconds).toBeNull();
    expect(result.reasonIfNull).toBe("out-of-range-component");
  });

  it("parses decimal seconds", () => {
    expect(normalizeDuration("1834.7").seconds).toBe(1835);
  });

  it("preserves the raw string for audit", () => {
    expect(normalizeDuration("46:50").raw).toBe("46:50");
  });
});
