import { z } from 'zod';

export const CreateCharacterRequestSchema = z.object({
  actorTemplateId: z.number().int().positive(),
  name: z.string().min(1).max(100),
});

export type CreateCharacterRequest = z.infer<typeof CreateCharacterRequestSchema>;

export const CharacterResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  actorTemplateId: z.number(),
  name: z.string(),
  baseStats: z.unknown(), // We'll keep it as unknown for now, but we can define a more specific shape if needed.
  createdAt: z.string(),
});

export type CharacterResponse = z.infer<typeof CharacterResponseSchema>;

export const CharactersResponseSchema = z.array(CharacterResponseSchema);
export type CharactersResponse = z.infer<typeof CharactersResponseSchema>;
