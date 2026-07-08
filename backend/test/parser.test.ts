import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parseFeed } from "../src/feeds/parser";

const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures", "feeds");

const fixtureFiles = fs
  .readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith(".xml"))
  .sort();

describe("parseFeed against real-world fixture corpus", () => {
  it("found the expected fixture files", () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(6);
  });

  for (const file of fixtureFiles) {
    describe(file, () => {
      const xml = fs.readFileSync(path.join(FIXTURES_DIR, file), "utf-8");
      const feed = parseFeed(xml);

      it("parses a non-empty feed title", () => {
        expect(feed.title.length).toBeGreaterThan(0);
      });

      it("parses at least one episode", () => {
        expect(feed.episodes.length).toBeGreaterThanOrEqual(1);
      });

      it("every episode has an enclosure URL (or a recorded warning explaining why not)", () => {
        for (const ep of feed.episodes) {
          if (!ep.enclosureUrl) {
            expect(ep.warnings.join(" ")).toMatch(/enclosure/i);
          } else {
            expect(ep.enclosureUrl.startsWith("http")).toBe(true);
          }
        }
      });

      it("every episode's duration is normalized to seconds, or null with a reason", () => {
        for (const ep of feed.episodes) {
          if (ep.duration.seconds === null) {
            expect(typeof ep.duration.reasonIfNull).toBe("string");
          } else {
            expect(ep.duration.seconds).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(ep.duration.seconds)).toBe(true);
          }
        }
      });

      it("sanitizes description HTML — no real markup tags survive", () => {
        // Checks for actual HTML tag names rather than "any <...>" — some
        // fixtures (omegatau.xml) have legitimate escaped citation text like
        // "Dissolution of the Soviet Union &lt;Dissolution of the Soviet
        // Union&gt;" that decodes to real angle brackets around plain words;
        // that's not markup, so a blanket bracket check produces false
        // positives on real content (see the dedicated cleantechies test
        // below for the actual HTML-in-CDATA case this guards against).
        const knownTagPattern = /<\/?(p|div|span|a|br|img|b|i|em|strong|ul|ol|li|h[1-6]|table|tr|td)\b[^>]*>/i;
        for (const ep of feed.episodes.slice(0, 20)) {
          expect(ep.descriptionText).not.toMatch(knownTagPattern);
        }
      });
    });
  }
});

describe("known real-world quirks captured in the fixture corpus", () => {
  it("lexfridman.xml: WordPress/PowerPress numeric entities (&#038;) in titles are decoded, not left literal", () => {
    const xml = fs.readFileSync(path.join(FIXTURES_DIR, "lexfridman.xml"), "utf-8");
    const feed = parseFeed(xml);
    const withAmpersand = feed.episodes.find((e) => e.title.includes("&"));
    expect(withAmpersand).toBeDefined();
    expect(withAmpersand!.title).not.toContain("&#038;");
    expect(withAmpersand!.title).not.toContain("&#38;");
  });

  it("lexfridman.xml: ~25 of 100 episodes have no itunes:duration at all (real, not a fixture artifact)", () => {
    const xml = fs.readFileSync(path.join(FIXTURES_DIR, "lexfridman.xml"), "utf-8");
    const feed = parseFeed(xml);
    const missing = feed.episodes.filter((e) => e.duration.reasonIfNull === "missing");
    // Documents corner case 5/6 concretely: duration absence is common
    // enough on a real, popular, actively-maintained feed that "missing
    // itunes:duration" must be a first-class, non-alarming outcome, not an
    // edge case the parser merely tolerates in theory.
    expect(missing.length).toBeGreaterThan(10);
  });

  it("omegatau.xml: itunes:duration of 00:00:00 on real long episodes resolves to a non-null (if garbage-looking) duration, not a crash", () => {
    const xml = fs.readFileSync(path.join(FIXTURES_DIR, "omegatau.xml"), "utf-8");
    const feed = parseFeed(xml);
    const zeroDurationEpisodes = feed.episodes.filter((e) => e.duration.raw === "00:00:00");
    // The point of this fixture: the parser must not throw and must
    // normalize "00:00:00" to 0 seconds (a legitimate, if useless, value) —
    // downstream code decides whether 0 is trustworthy, not the parser.
    expect(zeroDurationEpisodes.length).toBeGreaterThan(0);
    for (const ep of zeroDurationEpisodes) {
      expect(ep.duration.seconds).toBe(0);
    }
  });

  it("cleantechies.xml: HTML-in-CDATA show notes are stripped to text", () => {
    const xml = fs.readFileSync(path.join(FIXTURES_DIR, "cleantechies.xml"), "utf-8");
    const feed = parseFeed(xml);
    const withParagraphs = feed.episodes.find((e) => e.descriptionHtml?.includes("<p>"));
    expect(withParagraphs).toBeDefined();
    expect(withParagraphs!.descriptionText).not.toContain("<p>");
  });

  it("lexfridman.xml, catalyst.xml, conan.xml fixtures were truncated to ~100 items", () => {
    for (const file of ["lexfridman.xml", "catalyst.xml", "conan.xml"]) {
      const xml = fs.readFileSync(path.join(FIXTURES_DIR, file), "utf-8");
      const feed = parseFeed(xml);
      expect(feed.episodes.length).toBeLessThanOrEqual(100);
      expect(feed.episodes.length).toBeGreaterThan(0);
    }
  });
});
