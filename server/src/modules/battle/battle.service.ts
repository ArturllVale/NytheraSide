import { prisma } from '../../infra/prisma';
import { randomUUID } from 'crypto';
import { BattleCommand, BattleState, Battler } from '@nythera/shared';
import { BattleEngine } from './engine/engine';
import { StrategyAI } from './engine/ai';

export class BattleService {
  async startBattle(characterId: string, troopId?: number, enemyIds?: number[]) {
    // 1. Get active content
    const active = await prisma.contentActive.findFirst({
      include: { version: true },
    });
    if (!active || !active.version) throw new Error('No active content');
    const versionNumber = active.version.version;
    const content = JSON.parse(active.version.payload);

    // 2. Load character
    const char = await prisma.character.findUnique({
      where: { id: characterId },
    });
    if (!char) throw new Error('Character not found');
    const baseStats = JSON.parse(char.base_stats);
    
    // baseStats.actor.params is [hp, mp, atk, def, mat, mdf, agi, luk] at initial level
    const actorParams: number[] = baseStats?.actor?.params || [100, 10, 10, 10, 10, 10, 10, 10];

    // 3. Build Party
    const party: Battler[] = [{
      id: char.id,
      templateId: char.actor_template_id,
      isEnemy: false,
      name: char.name,
      hp: actorParams[0] || 100,
      mp: actorParams[1] || 10,
      mhp: actorParams[0] || 100,
      mmp: actorParams[1] || 10,
      atk: actorParams[2] || 10,
      def: actorParams[3] || 10,
      mat: actorParams[4] || 10,
      mdf: actorParams[5] || 10,
      agi: actorParams[6] || 10,
      luk: actorParams[7] || 10,
      isDead: false
    }];

    // 4. Build Troop
    let troop: Battler[] = [];
    if (enemyIds && enemyIds.length > 0) {
      troop = enemyIds.map((enemyId, idx) => {
        const enemyData = content.Enemies[enemyId];
        if (!enemyData) throw new Error(`Enemy ID ${enemyId} not found`);
        const eStats = enemyData.params;
        return {
          id: `enemy-${idx}`,
          templateId: enemyId,
          isEnemy: true,
          name: enemyData.name,
          hp: eStats[0],
          mp: eStats[1],
          mhp: eStats[0],
          mmp: eStats[1],
          atk: eStats[2],
          def: eStats[3],
          mat: eStats[4],
          mdf: eStats[5],
          agi: eStats[6],
          luk: eStats[7],
          isDead: false
        };
      });
    } else if (troopId) {
      const troopData = content.Troops[troopId];
      if (!troopData) throw new Error('Troop not found');
      troop = troopData.members.map((m: any, idx: number) => {
        const enemyData = content.Enemies[m.enemyId];
        if (!enemyData) throw new Error(`Enemy ID ${m.enemyId} not found`);
        const eStats = enemyData.params;
        return {
          id: `enemy-${idx}`,
          templateId: m.enemyId,
          isEnemy: true,
          name: enemyData.name,
          hp: eStats[0],
          mp: eStats[1],
          mhp: eStats[0],
          mmp: eStats[1],
          atk: eStats[2],
          def: eStats[3],
          mat: eStats[4],
          mdf: eStats[5],
          agi: eStats[6],
          luk: eStats[7],
          isDead: false
        };
      });
    } else {
      throw new Error('Either troopId or enemyIds must be provided');
    }

    const state: BattleState = {
      id: randomUUID(),
      turn: 1,
      party,
      troop,
      status: 'ACTIVE'
    };

    const seed = Math.random().toString(36).substring(2, 15);

    await prisma.battle.create({
      data: {
        id: state.id,
        character_id: characterId,
        content_version: versionNumber,
        seed,
        status: state.status,
        side_party: JSON.stringify(party),
        side_troop: JSON.stringify(troop),
        state_snapshot: JSON.stringify(state)
      },
    });

    return { state, seed };
  }

  async submitCommand(battleId: string, actorId: string, command: BattleCommand) {
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
    });
    if (!battle) throw new Error('Battle not found');

    if (battle.status !== 'ACTIVE') {
      throw new Error('Battle is not active');
    }

    const version = await prisma.contentVersion.findUnique({
      where: { version: battle.content_version },
    });
    if (!version) throw new Error('Content version not found for this battle');
    
    const content = JSON.parse(version.payload);
    const state = JSON.parse(battle.state_snapshot) as BattleState;

    const engine = new BattleEngine(state, battle.seed, content);
    
    // Process player command
    const events = engine.processCommand(actorId, command);

    // If still active, enemies take turns
    if (engine.state.status === 'ACTIVE') {
      for (const enemy of engine.state.troop) {
        if (!enemy.isDead && engine.state.status === 'ACTIVE') {
          // AI selects action
          // We need a deterministic RNG from the engine to pass to AI, 
          const aiAction = StrategyAI.decide(enemy.id, engine.state, engine.rng, content);
          const enemyEvents = engine.processCommand(enemy.id, aiAction);
          events.push(...enemyEvents);
        }
      }
    }

    // Optimistic compare-and-swap prevents two websocket commands from both
    // applying against the same snapshot when requests race.
    const saved = await prisma.battle.updateMany({
      where: { id: battleId, status: 'ACTIVE', state_snapshot: battle.state_snapshot },
      data: {
        side_party: JSON.stringify(engine.state.party),
        side_troop: JSON.stringify(engine.state.troop),
        state_snapshot: JSON.stringify(engine.state),
        status: engine.state.status,
        updated_at: new Date()
      },
    });
    if (saved.count !== 1) throw new Error('Battle state changed; retry command');

    // Handle end of battle rewards if won
    if (engine.state.status === 'WON') {
      // Calculate pending rewards to give to player
    }

    return { state: engine.state, events };
  }
}
