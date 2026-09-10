import { expect, describe, it } from 'vitest';
import { BattleEngine } from '../modules/battle/engine/engine';
import { StrategyAI } from '../modules/battle/engine/ai';
import { BattleState, Battler, BattleCommand } from '@nythera/shared';

describe('Battle Engine Core', () => {
  const mockContent = {
    Skills: [
      null,
      { id: 1, name: 'Attack', mpCost: 0, scope: 1, damage: { type: 1, formula: 'a.atk * 4 - b.def * 2', variance: 0 } },
      { id: 2, name: 'Heal', mpCost: 5, scope: 8, damage: { type: 3, formula: '200 + a.mat', variance: 0 } },
      { id: 3, name: 'Heavy Strike', mpCost: 20, scope: 1, damage: { type: 1, formula: 'a.atk * 8', variance: 0 } }
    ],
    Enemies: [
      null,
      { id: 1, name: 'Slime', params: [100, 10, 10, 10, 10, 10, 10, 10], dropItems: [{ kind: 1, dataId: 1, denominator: 1 }] }
    ]
  };

  const createInitialState = (): BattleState => ({
    id: 'test-battle',
    turn: 1,
    status: 'ACTIVE',
    party: [{
      id: 'player-1', templateId: 1, isEnemy: false, name: 'Hero',
      hp: 500, mhp: 500, mp: 50, mmp: 50, atk: 20, def: 10, mat: 10, mdf: 10, agi: 10, luk: 10, isDead: false
    }],
    troop: [{
      id: 'enemy-1', templateId: 1, isEnemy: true, name: 'Slime',
      hp: 100, mhp: 100, mp: 10, mmp: 10, atk: 10, def: 5, mat: 5, mdf: 5, agi: 5, luk: 5, isDead: false
    }]
  });

  it('should deterministically resolve damage formula', () => {
    const state = createInitialState();
    const engine = new BattleEngine(state, 'test-seed-123', mockContent);
    const command: BattleCommand = { type: 'SKILL', skillId: 1, targetId: 'enemy-1' };
    
    const events = engine.processCommand('player-1', command);
    // formula: a.atk(20) * 4 - b.def(5) * 2 = 80 - 10 = 70 damage
    const damageEvent = events.find(e => e.type === 'DAMAGE');
    
    expect(damageEvent).toBeDefined();
    expect(damageEvent?.value).toBe(70);
    expect(engine.state.troop[0].hp).toBe(30); // 100 - 70
  });

  it('should validate skill cost', () => {
    const state = createInitialState();
    state.party[0].mp = 2; // Not enough for Heavy Strike (20)
    const engine = new BattleEngine(state, 'test-seed', mockContent);
    const command: BattleCommand = { type: 'SKILL', skillId: 3, targetId: 'enemy-1' };
    
    const events = engine.processCommand('player-1', command);
    const damageEvent = events.find(e => e.type === 'DAMAGE');
    
    expect(damageEvent).toBeUndefined(); // Failed to cast
  });

  it('should handle death and battle end', () => {
    const state = createInitialState();
    state.troop[0].hp = 50; // Set to lower HP so it dies in one hit
    const engine = new BattleEngine(state, 'test-seed', mockContent);
    
    const events = engine.processCommand('player-1', { type: 'SKILL', skillId: 1, targetId: 'enemy-1' });
    
    const deathEvent = events.find(e => e.type === 'DEATH');
    const winEvent = events.find(e => e.type === 'BATTLE_WON');
    const dropEvent = events.find(e => e.type === 'DROP');

    expect(deathEvent).toBeDefined();
    expect(winEvent).toBeDefined();
    expect(engine.state.status).toBe('WON');
    // Drop logic depends on RNG but with denominator 1, it's 100% chance
    expect(dropEvent).toBeDefined();
    expect(dropEvent?.meta.kind).toBe(1);
  });

  it('AI should fallback to attack', () => {
    const state = createInitialState();
    const command = StrategyAI.decide('enemy-1', state, () => 0.5, mockContent);
    
    expect(command.type).toBe('SKILL');
    expect(command.skillId).toBe(1);
    expect(command.targetId).toBe('player-1');
  });

  it('should deterministically replay a full battle', () => {
    const stateA = createInitialState();
    const stateB = createInitialState();

    const engineA = new BattleEngine(stateA, 'shared-seed', mockContent);
    const engineB = new BattleEngine(stateB, 'shared-seed', mockContent);

    const cmd: BattleCommand = { type: 'SKILL', skillId: 1, targetId: 'enemy-1' };

    const eventsA = engineA.processCommand('player-1', cmd);
    const eventsB = engineB.processCommand('player-1', cmd);

    expect(eventsA).toEqual(eventsB);
    expect(engineA.state).toEqual(engineB.state);
  });
});
