import { z } from "zod";

/** Matches data/taxonomy.json exactly (see docs/research/curation-practices.md sec. "Recommended taxonomy JSON schema"). */
export const TaxonomyNodeSchema = z.object({
  id: z.string(),
  parent: z.string().nullable(),
  label: z.string(),
  apple_anchor: z.string(),
  weight: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  last_evidence_at: z.string()
});
export type TaxonomyNode = z.infer<typeof TaxonomyNodeSchema>;

export const TaxonomyFileSchema = z.object({
  version: z.literal(1),
  notes: z.string().optional(),
  nodes: z.array(TaxonomyNodeSchema),
  episode_attributes: z.object({
    depth: z.array(z.string()),
    format: z.array(z.string()),
    evergreen: z.string()
  })
});
export type TaxonomyFile = z.infer<typeof TaxonomyFileSchema>;
