import { prisma } from '../../infra/prisma';

export class EconomyService {
  /**
   * Idempotently applies rewards to a character.
   * Ensures the same idempotencyKey is never processed twice.
   */
  async grantRewardsIdempotent(
    characterId: string, 
    idempotencyKey: string, 
    rewards: { xp: number, gold: number, drops: any[] }
  ): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      // 1. Check idempotency
      const existing = await tx.idempotencyKey.findUnique({
        where: { key: idempotencyKey }
      });
      if (existing) {
        return false; // Already processed
      }

      // 2. Mark as processed
      await tx.idempotencyKey.create({ data: { key: idempotencyKey } });

      // 3. Grant rewards
      const char = await tx.character.findUnique({
        where: { id: characterId }
      });

      if (char) {
        const baseStats = JSON.parse(char.base_stats);
        
        if (!baseStats.inventory) baseStats.inventory = { items: [] };
        
        const currentExp = char.exp + rewards.xp;
        const currentCurrency = JSON.parse(char.currency);
        const currentGold = (currentCurrency.gold || 0) + rewards.gold;
        currentCurrency.gold = currentGold;

        rewards.drops.forEach(drop => {
          baseStats.inventory.items.push(drop);
        });

        await tx.character.update({
          where: { id: characterId },
          data: {
            exp: currentExp,
            currency: JSON.stringify(currentCurrency),
            base_stats: JSON.stringify(baseStats)
          }
        });
      }

      return true;
    });
  }
}