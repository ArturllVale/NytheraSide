import { z } from 'zod';

export const BattleCommandSchema = z.object({
  type: z.enum(['SKILL', 'ITEM', 'FLEE']),
  skillId: z.number().int().positive().optional(),
  itemId: z.number().int().positive().optional(),
  targetId: z.string().optional(), // id of the target battler
});

export type BattleCommand = z.infer<typeof BattleCommandSchema>;

export const BattleEventSchema = z.object({
  type: z.enum(['DAMAGE', 'HEAL', 'DEATH', 'BUFF', 'DEBUFF', 'DROP', 'FLEE_SUCCESS', 'FLEE_FAIL', 'BATTLE_WON', 'BATTLE_LOST', 'ACTION_START']),
  sourceId: z.string().optional(),
  targetId: z.string().optional(),
  value: z.number().optional(), // e.g. damage amount or heal amount
  meta: z.any().optional(), // additional info (which stat, what item dropped, etc.)
});

export type BattleEvent = z.infer<typeof BattleEventSchema>;

export const StartBattleRequestSchema = z.object({
  characterId: z.string(),
  troopId: z.number().int().positive(),
});

export type StartBattleRequest = z.infer<typeof StartBattleRequestSchema>;

export const SubmitCommandRequestSchema = z.object({
  command: BattleCommandSchema,
});

export type SubmitCommandRequest = z.infer<typeof SubmitCommandRequestSchema>;

export const SetAutoRequestSchema = z.object({
  isAuto: z.boolean(),
});

export type SetAutoRequest = z.infer<typeof SetAutoRequestSchema>;
import { MapMoveRequestSchema, MapUpdateResponseSchema } from './map.dto';

// Schema para mensagens enviadas pelo CLIENTE para o servidor
export const BattleWsClientPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('AUTH_REQ'),
    token: z.string(),
    characterId: z.string().optional()
  }),
  z.object({
    type: z.literal('BATTLE_START_REQ'),
    troopId: z.number().int().positive().optional(),
    enemyIds: z.array(z.number().int().positive()).optional()
  }),
  z.object({
    type: z.literal('BATTLE_COMMAND_REQ'),
    command: BattleCommandSchema
  }),
  z.object({
    type: z.literal('BATTLE_SET_AUTO_REQ'),
    isAuto: z.boolean()
  }),
  z.object({
    type: z.literal('MAP_MOVE_REQ'),
    payload: MapMoveRequestSchema
  }),
]);

export type BattleWsClientPayload = z.infer<typeof BattleWsClientPayloadSchema>;

// Schema para mensagens enviadas pelo SERVIDOR para o cliente
export const BattleWsServerPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('AUTH_RES'),
    success: z.boolean(),
    character: z.object({
      id: z.string(),
      name: z.string(),
      mapId: z.number().int(),
      x: z.number().int(),
      y: z.number().int(),
      direction: z.number().int(),
    }).optional()
  }),
  z.object({
    type: z.literal('BATTLE_UPDATE_RES'),
    state: z.any(),
    events: z.array(BattleEventSchema)
  }),
  z.object({
    type: z.literal('ERROR_RES'),
    message: z.string()
  }),
  z.object({
    type: z.literal('MAP_UPDATE_RES'),
    payload: MapUpdateResponseSchema
  })
]);

export type BattleWsServerPayload = z.infer<typeof BattleWsServerPayloadSchema>;

// Alias de compatibilidade (era BattleWsPayloadSchema)
export const BattleWsPayloadSchema = BattleWsClientPayloadSchema;
export type BattleWsPayload = BattleWsClientPayload;
