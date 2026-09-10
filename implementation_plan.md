# Phase 3: Battle Engine Core

## Goal
Implement a Pure TypeScript authoritative battle engine used for BOTH manual and auto-battle. No Pixi/RMMV runtime dependency.
The engine will run inside the Node.js server. 

## User Review Required
> [!IMPORTANT]
> - I will modify `apps/server/src/infra/db/schema.ts` to add the `battle` schema and `battles` table. 
> - I will add a battle engine under `apps/server/src/modules/battle/engine`.
> - Is the `packages/content-schema/src/lib/formula.ts` acceptable to modify for the 10ms timeout? (I will adjust it if yes, otherwise I can instantiate a new one specifically for the engine).

## Proposed Changes

### Database Schema
#### [MODIFY] schema.ts
Add a new `battleSchema` with a `battles` table:
```typescript
export const battleSchema = pgSchema('battle');
export const battles = battleSchema.table('battles', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  character_id: varchar('character_id', { length: 36 }).notNull(),
  content_version: integer('content_version').notNull(),
  seed: varchar('seed', { length: 32 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // ACTIVE, WON, LOST, FLEED
  state_snapshot: jsonb('state_snapshot').notNull(), // The complete serialized state of the battle
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});
```

### Shared Packages (DTO & Types)
#### [NEW] packages/shared/src/dto/battle.dto.ts
Add Zod schemas and TypeScript interfaces for:
- `BattleCommand`: { type: 'SKILL' | 'ITEM' | 'FLEE', skillId?: number, itemId?: number, targetId?: string }
- `BattleEvent`: { type: 'DAMAGE' | 'HEAL' | 'DEATH' | 'BUFF' | 'DROP', sourceId: string, targetId: string, value?: number, ... }
- `BattleSnapshot`: current turn, entities, HP/MP etc.

### Battle Engine Core (apps/server/src/modules/battle/engine)
#### [NEW] engine.ts
The core deterministic engine class: `BattleEngine`.
- **Initialization**: Loaded with a specific `contentVersion` and a `rngSeed` (using xoshiro for deterministic RNG).
- **State**: Holds `Party` (allies) and `Troop` (enemies). Maintains turn order.
- **Queue**: Accepts incoming commands (actions).
- **Resolution**: Computes actions -> uses `isolated-vm` via `evaluateFormula` (passing `a` and `b` as views of attacker/defender) with a strict 10ms timeout.
- **Events**: Returns an array of `BattleEvent` that describes exactly what happened (who took damage, who died, what dropped).

#### [NEW] ai.ts
The AI for auto-battle or enemy turns:
- Scans available skills and allies/enemies.
- Prefers healing allies below a certain HP threshold (e.g. 30%).
- Otherwise, selects the highest priority damaging skill.
- Falls back to basic attack.

### Battle Service (apps/server/src/modules/battle)
#### [NEW] battle.service.ts
Manages the lifecycle of battles:
- `startBattle(characterId, troopId)`: Fetches content, initializes engine, stores to DB.
- `submitCommand(battleId, characterId, command)`: Loads snapshot, validates and pushes command to engine, processes turn, updates snapshot.
- `setAuto(battleId, isAuto)`: Toggles AI control for the player.
- End of battle: Computes rewards (XP, drops, gold) according to rates in the content DB, and marks battle as WON/LOST.

## Verification Plan

### Automated Tests
I will create `apps/server/src/__tests__/battle.engine.test.ts` to test:
1. **Deterministic Replay**: Running the same commands with the same seed results in identical `BattleEvent[]` outputs.
2. **Formulas & isolated-vm**: Attack damage correctly scales based on RM MV formulas.
3. **Skill Cost**: Cannot use a skill if MP is insufficient.
4. **Death / Battle End**: Troop zero HP causes victory and drop generation based on content rates.
5. **AI Strategy**: Mock state where ally is <30% HP should trigger heal action, otherwise attack.

All tests will run isolated without touching the database via `vitest`.