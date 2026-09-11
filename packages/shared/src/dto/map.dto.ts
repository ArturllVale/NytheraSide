import { z } from 'zod';

export const MapFollowerSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  realX: z.number().optional(),
  realY: z.number().optional(),
  direction: z.number().int().optional(),
  characterName: z.string(),
  characterIndex: z.number().int(),
});

export const MapPlayerSchema = z.object({
  id: z.string(),
  mapId: z.number().int(),
  x: z.number(),
  y: z.number(),
  realX: z.number().optional(),
  realY: z.number().optional(),
  isMoving: z.boolean().optional(),
  direction: z.number().int(),
  speed: z.number(),
  characterName: z.string(),
  characterIndex: z.number().int(),
  followers: z.array(MapFollowerSchema).optional(),
});

export type MapPlayer = z.infer<typeof MapPlayerSchema>;

export const MapMoveRequestSchema = z.object({
  mapId: z.number().int(),
  x: z.number(),
  y: z.number(),
  realX: z.number().optional(),
  realY: z.number().optional(),
  isMoving: z.boolean().optional(),
  direction: z.number().int(),
  speed: z.number(),
  characterName: z.string(),
  characterIndex: z.number().int(),
  followers: z.array(MapFollowerSchema).optional(),
});

export type MapMoveRequest = z.infer<typeof MapMoveRequestSchema>;

export const MapUpdateResponseSchema = z.object({
  players: z.array(MapPlayerSchema),
});

export type MapUpdateResponse = z.infer<typeof MapUpdateResponseSchema>;
