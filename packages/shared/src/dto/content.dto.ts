// Content payload shape: normalized RM MV database files, keyed by file stem.
import { z } from 'zod';

export const RmEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  note: z.string().optional().default(''),
  notetags: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const ContentPayloadSchema = z.object({
  Actors: z.array(RmEntrySchema).optional(),
  Classes: z.array(RmEntrySchema).optional(),
  Skills: z.array(RmEntrySchema).optional(),
  Items: z.array(RmEntrySchema).optional(),
  Weapons: z.array(RmEntrySchema).optional(),
  Armors: z.array(RmEntrySchema).optional(),
  Enemies: z.array(RmEntrySchema).optional(),
  Troops: z.array(RmEntrySchema).optional(),
  States: z.array(RmEntrySchema).optional(),
  System: z.record(z.string(), z.unknown()).optional(),
});

export type RmEntry = z.infer<typeof RmEntrySchema>;
export type ContentPayload = z.infer<typeof ContentPayloadSchema>;