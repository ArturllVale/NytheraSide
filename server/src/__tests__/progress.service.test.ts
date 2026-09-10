import { expect, describe, it, beforeAll, afterAll } from 'vitest';
import { ProgressService } from '../modules/progress/progress.service';
import { prisma } from '../infra/prisma';
import { randomUUID } from 'crypto';

describe('ProgressService', () => {
  let progressService: ProgressService;
  let userId: string;
  let charId: string;

  beforeAll(async () => {
    progressService = new ProgressService();
    userId = randomUUID();
    charId = randomUUID();
    
    // Seed basic data
    await prisma.user.create({ data: { id: userId, email: `${randomUUID()}@test.com`, password_hash: 'hash' } });
    await prisma.character.create({ 
      data: { id: charId, user_id: userId, name: 'Test', actor_template_id: 1, base_stats: '{}' }
    });
    
    const vId = randomUUID();
    const uniqueVersion = Math.floor(Math.random() * 1000000);
    await prisma.contentVersion.create({
      data: { id: vId, version: uniqueVersion, payload: '{}', hash: randomUUID() }
    });
    await prisma.contentActive.create({ data: { id: randomUUID(), version_id: vId } });
  });

  afterAll(async () => {
    await prisma.characterIdleState.deleteMany({ where: { character_id: charId } });
    await prisma.character.delete({ where: { id: charId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('should initialize idle state if missing', async () => {
    const status = await progressService.getIdleStatus(charId);
    expect(status.elapsedSeconds).toBe(0);
  });

  it('should respect the 12h cap', async () => {
    const lastSyncedAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h
    await prisma.characterIdleState.upsert({
      where: { character_id: charId },
      update: { last_synced_at: lastSyncedAt },
      create: { character_id: charId, last_synced_at: lastSyncedAt, route_or_stage_id: 1, strategy: 'default', content_version: 1 }
    });

    const status = await progressService.getIdleStatus(charId);
    expect(status.capReached).toBe(true);
    expect(status.elapsedSeconds).toBe(12 * 60 * 60); // 12h cap
  });
});