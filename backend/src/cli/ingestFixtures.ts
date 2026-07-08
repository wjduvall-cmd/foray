import * as fs from "fs";
import * as path from "path";
import { parseFeed } from "../feeds/parser";

/**
 * `npm run ingest-fixtures` — runs the lenient RSS parser against every
 * feed in backend/fixtures/feeds and prints a summary (title, episode
 * count, warning count, sample duration-normalization outcomes). This is
 * the manual/human-readable counterpart to test/parser.test.ts — useful
 * for eyeballing real feed weirdness without reading test assertions.
 * Corresponds to the "Feed reality spike" acceptance check in
 * 06_ROADMAP.md M0 ("script that ingests feeds... prints parsed metadata").
 */

const FIXTURES_DIR = path.resolve(__dirname, "..", "..", "fixtures", "feeds");

function main(): void {
  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".xml"))
    .sort();

  if (files.length === 0) {
    console.log(`No fixture feeds found in ${FIXTURES_DIR}`);
    return;
  }

  let totalEpisodes = 0;
  let totalWarnings = 0;
  let totalNullDurations = 0;

  for (const file of files) {
    const xml = fs.readFileSync(path.join(FIXTURES_DIR, file), "utf-8");
    const feed = parseFeed(xml);
    const nullDurations = feed.episodes.filter((e) => e.duration.seconds === null).length;
    const episodeWarnings = feed.episodes.reduce((sum, e) => sum + e.warnings.length, 0);

    totalEpisodes += feed.episodes.length;
    totalWarnings += feed.warnings.length + episodeWarnings;
    totalNullDurations += nullDurations;

    console.log(`\n${file}`);
    console.log(`  title: ${feed.title}`);
    console.log(`  episodes: ${feed.episodes.length}`);
    console.log(`  feed-level warnings: ${feed.warnings.length}${feed.warnings.length ? " -> " + feed.warnings.join("; ") : ""}`);
    console.log(`  episode-level warnings: ${episodeWarnings}`);
    console.log(`  durations unresolved (null): ${nullDurations}/${feed.episodes.length}`);
    const first = feed.episodes[0];
    if (first) {
      console.log(`  sample episode: "${first.title}" — duration ${first.duration.seconds ?? "null"}s (raw="${first.duration.raw}")`);
    }
  }

  console.log(`\n--- summary across ${files.length} fixture feeds ---`);
  console.log(`total episodes parsed: ${totalEpisodes}`);
  console.log(`total warnings: ${totalWarnings}`);
  console.log(`total unresolved durations: ${totalNullDurations}`);
}

main();
