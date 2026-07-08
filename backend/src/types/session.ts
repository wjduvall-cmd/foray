import { z } from "zod";

/**
 * Matches data/session.json exactly (version 1). This is the contract the
 * iOS client already codes against — the session builder CLI must emit
 * documents that validate against this schema byte-shape-for-byte-shape
 * (field names, nesting), even though our own DB layer is richer.
 */

export const ArchetypeSchema = z.enum(["deep-learn", "stretch", "narrative", "comfort"]);
export type Archetype = z.infer<typeof ArchetypeSchema>;

export const SessionCardSchema = z.object({
  slot: z.number().int().min(1),
  archetype: ArchetypeSchema,
  archetype_label: z.string(),
  episode_id: z.string(),
  why_line: z.string(),
  fit_line: z.string(),
  alternates: z.array(z.string())
});
export type SessionCard = z.infer<typeof SessionCardSchema>;

export const SessionCategoryGroupSchema = z.object({
  label: z.string(),
  episode_ids: z.array(z.string())
});

export const SessionCategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  groups: z.array(SessionCategoryGroupSchema)
});
export type SessionCategory = z.infer<typeof SessionCategorySchema>;

export const SessionEpisodeDetailSchema = z
  .object({
    show: z.string(),
    title: z.string(),
    release_date: z.string(),
    duration_min: z.number(),
    apple_collection_id: z.number().nullable().optional(),
    apple_track_id: z.number().nullable().optional(),
    summary: z.string(),
    depth: z.enum(["low", "medium", "high"]),
    format: z.string(),
    topics: z.array(z.string())
  })
  // real-world episode extras like reactor_types (see data/session.json) are
  // allowed through untouched — the schema pins the *required* v1 shape.
  .passthrough();
export type SessionEpisodeDetail = z.infer<typeof SessionEpisodeDetailSchema>;

export const SessionDocSchema = z.object({
  version: z.literal(1),
  session_id: z.string(),
  built_at: z.string(),
  commute: z.object({
    minutes: z.number(),
    playback_speed: z.number(),
    content_minutes: z.number()
  }),
  cards: z.array(SessionCardSchema),
  categories: z.array(SessionCategorySchema),
  episodes: z.record(SessionEpisodeDetailSchema)
});
export type SessionDoc = z.infer<typeof SessionDocSchema>;
