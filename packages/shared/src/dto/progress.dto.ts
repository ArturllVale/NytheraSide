import { z } from 'zod';

export const SetRouteRequestSchema = z.object({
  routeId: z.number().int().positive(),
});
export type SetRouteRequest = z.infer<typeof SetRouteRequestSchema>;

export const SetStrategyRequestSchema = z.object({
  strategy: z.any(), // JSON representing strategy overrides
});
export type SetStrategyRequest = z.infer<typeof SetStrategyRequestSchema>;

export const IdleStatusResponseSchema = z.object({
  elapsedSeconds: z.number().int().min(0),
  capReached: z.boolean(),
  currentRouteId: z.number().int().nullable(),
  estimatedBattles: z.number().int().min(0),
});
export type IdleStatusResponse = z.infer<typeof IdleStatusResponseSchema>;

export const ClaimOfflineResponseSchema = z.object({
  battlesSimulated: z.number().int(),
  drops: z.array(z.object({
    kind: z.number().int(),
    dataId: z.number().int(),
    amount: z.number().int()
  })),
  xpGained: z.number().int(),
  goldGained: z.number().int(),
});
export type ClaimOfflineResponse = z.infer<typeof ClaimOfflineResponseSchema>;