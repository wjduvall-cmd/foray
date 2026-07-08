import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { SessionDocSchema } from "../src/types/session";
import { TaxonomyFileSchema } from "../src/types/taxonomy";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

describe("our zod schemas match the repo's existing data files exactly", () => {
  it("data/session.json (version 1, the web client's existing contract) validates against SessionDocSchema", () => {
    const raw = fs.readFileSync(path.join(REPO_ROOT, "data", "session.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(() => SessionDocSchema.parse(parsed)).not.toThrow();
  });

  it("data/taxonomy.json validates against TaxonomyFileSchema", () => {
    const raw = fs.readFileSync(path.join(REPO_ROOT, "data", "taxonomy.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(() => TaxonomyFileSchema.parse(parsed)).not.toThrow();
  });
});
