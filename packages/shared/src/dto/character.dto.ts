import { z } from 'zod';

export const CreateCharacterRequestSchema = z.object({
  actorTemplateId: z.number().int().positive().optional(),
  mzActorId: z.number().int().positive().optional(),
  name: z.string().min(2).max(100),
}).refine((data) => data.actorTemplateId !== undefined || data.mzActorId !== undefined, {
  message: 'actorTemplateId or mzActorId must be provided',
});

export type CreateCharacterRequest = z.infer<typeof CreateCharacterRequestSchema>;

export const CharacterResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  actorTemplateId: z.number(),
  name: z.string(),
  baseStats: z.unknown(),
  createdAt: z.string(),
});

export type CharacterResponse = z.infer<typeof CharacterResponseSchema>;

export const CharactersResponseSchema = z.array(CharacterResponseSchema);
export type CharactersResponse = z.infer<typeof CharactersResponseSchema>;

export const MzClassDtoSchema = z.object({
  id: z.number(),
  name: z.string(),
  note: z.string().optional(),
});
export type MzClassDto = z.infer<typeof MzClassDtoSchema>;

export const MzActorDtoSchema = z.object({
  id: z.number(),
  name: z.string(),
  classId: z.number(),
  characterName: z.string(),
  characterIndex: z.number(),
  faceName: z.string().optional(),
  faceIndex: z.number().optional(),
  profile: z.string().optional(),
});
export type MzActorDto = z.infer<typeof MzActorDtoSchema>;

export const MzMapDtoSchema = z.object({
  id: z.number(),
  name: z.string(),
});
export type MzMapDto = z.infer<typeof MzMapDtoSchema>;

export const MzDataResponseSchema = z.object({
  classes: z.array(MzClassDtoSchema),
  actors: z.array(MzActorDtoSchema),
  maps: z.array(MzMapDtoSchema),
});
export type MzDataResponse = z.infer<typeof MzDataResponseSchema>;

