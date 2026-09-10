import { BattleCommand, BattleEvent, BattleState, Battler } from '@nythera/shared';
import { evaluateFormula } from '@nythera/content-schema';

export function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export class BattleEngine {
  public state: BattleState;
  public rng: () => number;
  private content: any;

  constructor(state: BattleState, seed: string, content: any) {
    this.state = state;
    // Simple hash of seed string to number for mulberry32
    let seedNum = 0;
    for (let i = 0; i < seed.length; i++) {
      seedNum = Math.imul(31, seedNum) + seed.charCodeAt(i) | 0;
    }
    this.rng = mulberry32(seedNum);
    this.content = content;
  }

  // Resolves a single command into events and updates the state
  public processCommand(actorId: string, command: BattleCommand): BattleEvent[] {
    const actor = this.getBattler(actorId);
    if (!actor || actor.isDead) return [];

    const events: BattleEvent[] = [];
    events.push({ type: 'ACTION_START', sourceId: actorId, meta: command });

    if (command.type === 'FLEE') {
      // Base 50% chance to flee
      const success = this.rng() > 0.5;
      if (success) {
        this.state.status = 'FLEED';
        events.push({ type: 'FLEE_SUCCESS', sourceId: actorId });
      } else {
        events.push({ type: 'FLEE_FAIL', sourceId: actorId });
      }
      return events;
    }

    if (command.type === 'SKILL' && command.skillId) {
      const skill = this.content.Skills[command.skillId];
      if (!skill) return events;

      // MP Cost Check
      if (actor.mp < skill.mpCost) {
        return events; // Failed to cast
      }
      actor.mp -= skill.mpCost;

      // Determine Target
      const targets = this.getTargets(actor, command.targetId, skill.scope);
      
      for (const target of targets) {
        // Evaluate damage formula if present
        if (skill.damage && skill.damage.type !== 0) {
          const isHealing = skill.damage.type === 3 || skill.damage.type === 4;
          
          let rawValue = 0;
          if (skill.damage.formula) {
            try {
              // RM MV typical damage formula execution with a, b variables
              rawValue = evaluateFormula(skill.damage.formula, { a: actor, b: target, v: {} }, 10);
            } catch (e) {
              console.error('Formula evaluation failed', e);
              rawValue = 0;
            }
          }

          // Add variance (e.g. 20%)
          const variance = skill.damage.variance || 0;
          if (variance > 0) {
            const amp = Math.floor(Math.max(Math.abs(rawValue) * variance / 100, 0));
            const v = Math.floor(this.rng() * (amp + 1)) + Math.floor(this.rng() * (amp + 1)) - amp;
            rawValue += v;
          }

          const finalValue = Math.floor(rawValue);

          if (isHealing) {
            const healAmount = Math.max(0, finalValue);
            target.hp = Math.min(target.mhp, target.hp + healAmount);
            events.push({ type: 'HEAL', sourceId: actorId, targetId: target.id, value: healAmount });
          } else {
            const damageAmount = Math.max(0, finalValue);
            target.hp = Math.max(0, target.hp - damageAmount);
            events.push({ type: 'DAMAGE', sourceId: actorId, targetId: target.id, value: damageAmount });

            if (target.hp <= 0) {
              target.isDead = true;
              events.push({ type: 'DEATH', targetId: target.id });
            }
          }
        }
      }
    }

    this.checkWinCondition(events);
    return events;
  }

  private checkWinCondition(events: BattleEvent[]) {
    const aliveAllies = this.state.party.filter(a => !a.isDead);
    const aliveEnemies = this.state.troop.filter(e => !e.isDead);

    if (aliveAllies.length === 0) {
      this.state.status = 'LOST';
      events.push({ type: 'BATTLE_LOST' });
    } else if (aliveEnemies.length === 0) {
      this.state.status = 'WON';
      events.push({ type: 'BATTLE_WON' });
      // Calculate Drops here
      this.calculateDrops(events);
    }
  }

  private calculateDrops(events: BattleEvent[]) {
    for (const enemy of this.state.troop) {
      const enemyData = this.content.Enemies[enemy.templateId];
      if (enemyData && enemyData.dropItems) {
        for (const drop of enemyData.dropItems) {
          if (drop.kind > 0) {
            // denominator means 1/N chance
            if (this.rng() * drop.denominator < 1) {
              events.push({ 
                type: 'DROP', 
                sourceId: enemy.id, 
                meta: { kind: drop.kind, dataId: drop.dataId } 
              });
            }
          }
        }
      }
    }
  }

  private getBattler(id: string): Battler | undefined {
    return this.state.party.find(b => b.id === id) || this.state.troop.find(b => b.id === id);
  }

  private getTargets(actor: Battler, targetId: string | undefined, scope: number): Battler[] {
    const enemies = actor.isEnemy ? this.state.party : this.state.troop;
    const allies = actor.isEnemy ? this.state.troop : this.state.party;
    
    // Simplification for MVP: scope 1 = 1 enemy, scope 2 = all enemies, scope 7 = 1 ally
    if (scope === 2) return enemies.filter(e => !e.isDead);
    if (scope === 8) return allies.filter(a => !a.isDead);
    
    if (targetId) {
      const specific = this.getBattler(targetId);
      if (specific && !specific.isDead) return [specific];
    }
    
    // Default single target fallback
    const aliveEnemies = enemies.filter(e => !e.isDead);
    if (aliveEnemies.length > 0) {
      return [aliveEnemies[Math.floor(this.rng() * aliveEnemies.length)]];
    }
    return [];
  }
}
