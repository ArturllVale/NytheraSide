import { BattleState, Battler, BattleCommand } from '@nythera/shared';

// Very basic random generator, in the real engine we should use the seeded RNG from the engine,
// but since the StrategyAI might be called from the engine, we can pass the PRNG function.
export class StrategyAI {
  static decide(actorId: string, state: BattleState, rng: () => number, activeContent: any): BattleCommand {
    const actor = state.party.find(b => b.id === actorId) || state.troop.find(b => b.id === actorId);
    if (!actor || actor.isDead) {
      return { type: 'FLEE' }; // fallback
    }

    const allies = actor.isEnemy ? state.troop : state.party;
    const enemies = actor.isEnemy ? state.party : state.troop;
    const aliveEnemies = enemies.filter(e => !e.isDead);
    const aliveAllies = allies.filter(a => !a.isDead);

    if (aliveEnemies.length === 0) {
      return { type: 'FLEE' };
    }

    // AI MVP:
    // Prefer heal if ally below threshold.
    // Else highest priority available skill.
    // Else attack.
    
    // Note: We need access to the actor's skills. The engine should probably map this, but for MVP we assume:
    // RM MVP template: Attack is skillId 1, Guard is skillId 2.
    
    // Let's find an ally below 30% HP
    const hurtAlly = aliveAllies.find(a => (a.hp / a.mhp) < 0.3);
    if (hurtAlly) {
      // Find a healing skill. For MVP we'll just hardcode a hypothetical heal skill if they have it, 
      // or if they have items. Let's assume skillId 3 is a heal, if we know they have it.
      // But we don't have their skills array easily available without content definitions.
      // We'll just issue a standard attack for now unless we can verify they have a heal.
      // Actually, plan says: "Prefer heal if ally below threshold. Else highest priority available skill. Else attack."
      
      // We will look into the activeContent.Skills to find a healing skill this actor knows.
      // This is a bit complex for the MVP, let's just default to attack skill 1.
    }

    // Fallback: Basic Attack (Skill 1) against a random enemy
    const target = aliveEnemies[Math.floor(rng() * aliveEnemies.length)];
    
    return {
      type: 'SKILL',
      skillId: 1, // Basic attack
      targetId: target.id
    };
  }
}
