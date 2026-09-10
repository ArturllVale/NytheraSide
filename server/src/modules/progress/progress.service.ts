import { prisma } from '../../infra/prisma';
import { EconomyService } from './economy.service';
import { IdleStatusResponse, ClaimOfflineResponse } from '@nythera/shared';
import { mulberry32 } from '../battle/engine/engine';

const MAX_IDLE_SECONDS = 12 * 60 * 60; // 12 hours
const BATTLE_DURATION_SECONDS = 60; // 1 battle per minute approximation

export class ProgressService {
  private economyService = new EconomyService();

  async getIdleStatus(characterId: string): Promise<IdleStatusResponse> {
    const state = await prisma.characterIdleState.findUnique({
      where: { character_id: characterId },
    });
    
    if (!state) {
      return { elapsedSeconds: 0, capReached: false, currentRouteId: null, estimatedBattles: 0 };
    }

    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - state.last_synced_at.getTime()) / 1000);
    const cappedElapsed = Math.min(elapsedSeconds, MAX_IDLE_SECONDS);

    return {
      elapsedSeconds: cappedElapsed,
      capReached: elapsedSeconds >= MAX_IDLE_SECONDS,
      currentRouteId: state.route_or_stage_id,
      estimatedBattles: Math.floor(cappedElapsed / BATTLE_DURATION_SECONDS)
    };
  }

  async claimOffline(characterId: string): Promise<ClaimOfflineResponse> {
    const state = await prisma.characterIdleState.findUnique({
      where: { character_id: characterId },
    });
    if (!state) {
      throw new Error('No idle state found');
    }

    // Calculate time and window
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - state.last_synced_at.getTime()) / 1000);
    if (elapsedSeconds < BATTLE_DURATION_SECONDS) {
      return { battlesSimulated: 0, drops: [], xpGained: 0, goldGained: 0 }; // Not enough time passed
    }

    const cappedElapsed = Math.min(elapsedSeconds, MAX_IDLE_SECONDS);
    const battlesToSimulate = Math.floor(cappedElapsed / BATTLE_DURATION_SECONDS);
    const windowStart = state.last_synced_at.toISOString();

    const idempotencyKey = `offline_claim:${characterId}:${windowStart}`;

    // Update last_synced_at immediately so concurrent requests don't calculate the same elapsed time
    const consumedMs = battlesToSimulate * BATTLE_DURATION_SECONDS * 1000;
    const newSyncedAt = new Date(state.last_synced_at.getTime() + consumedMs);

    await prisma.characterIdleState.update({
      where: { character_id: characterId },
      data: { last_synced_at: newSyncedAt },
    });

    // Simulate battles deterministically
    const rewards = await this.simulateBattles(characterId, state.route_or_stage_id || 1, battlesToSimulate, idempotencyKey, state.content_version);

    // Apply rewards via EconomyService idempotently
    const applied = await this.economyService.grantRewardsIdempotent(characterId, idempotencyKey, rewards);
    
    if (!applied) {
      // It was already applied by a concurrent request, so return 0
      return { battlesSimulated: 0, drops: [], xpGained: 0, goldGained: 0 };
    }

    return {
      battlesSimulated: battlesToSimulate,
      drops: rewards.drops,
      xpGained: rewards.xp,
      goldGained: rewards.gold
    };
  }

  async setRoute(characterId: string, routeId: number) {
    const active = await prisma.contentActive.findFirst({
      include: { version: true },
    });
    if (!active || !active.version) throw new Error('No active content published');
    const versionNumber = active.version.version;

    await prisma.characterIdleState.upsert({
      where: { character_id: characterId },
      update: { route_or_stage_id: routeId, content_version: versionNumber },
      create: {
        character_id: characterId,
        route_or_stage_id: routeId,
        content_version: versionNumber
      },
    });
  }

  async setStrategy(characterId: string, strategy: any) {
    await prisma.characterIdleState.update({
      where: { character_id: characterId },
      data: { strategy: JSON.stringify(strategy) },
    });
  }

  private async simulateBattles(characterId: string, troopId: number, count: number, seedPhrase: string, contentVersion: number) {
    const version = await prisma.contentVersion.findUnique({
      where: { version: contentVersion },
    });
    if (!version) throw new Error('Content version missing');
    const content = JSON.parse(version.payload);

    // Use a hash of the seed phrase
    let seedNum = 0;
    for (let i = 0; i < seedPhrase.length; i++) {
      seedNum = Math.imul(31, seedNum) + seedPhrase.charCodeAt(i) | 0;
    }
    const rng = mulberry32(seedNum);

    const accumulatedDrops: any[] = [];
    let xp = 0;
    let gold = 0;

    const troopData = content.Troops[troopId];
    if (!troopData) return { drops: [], xp: 0, gold: 0 };

    for (let i = 0; i < count; i++) {
      const isWin = rng() < 0.95; // 95% win rate mock
      if (isWin) {
        xp += 10;
        gold += 5;
        
        troopData.members.forEach((m: any) => {
          const enemyData = content.Enemies[m.enemyId];
          if (enemyData && enemyData.dropItems) {
            enemyData.dropItems.forEach((drop: any) => {
              if (drop.kind > 0 && (rng() * drop.denominator < 1)) {
                accumulatedDrops.push({ kind: drop.kind, dataId: drop.dataId, amount: 1 });
              }
            });
          }
        });
      }
    }

    return { drops: accumulatedDrops, xp, gold };
  }
}