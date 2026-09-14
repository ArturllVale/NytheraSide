import { prisma } from '../../infra/prisma';
import { randomUUID, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

function computeHash(payload: unknown): string {
  const payloadString = JSON.stringify(payload);
  return createHash('sha256').update(payloadString, 'utf8').digest('hex');
}

export class ContentService {
  private async autoSeedInitialContent() {
    const candidatePaths = [
      path.join(process.cwd(), '..', 'data'),
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'www', 'data'),
      path.join(process.cwd(), '..', 'www', 'data'),
    ];
    const dataDir = candidatePaths.find((p) => fs.existsSync(p));
    const payload: Record<string, any> = {};

    if (dataDir) {
      const files = [
        'Actors.json', 'Classes.json', 'Skills.json', 'Items.json',
        'Weapons.json', 'Armors.json', 'Enemies.json', 'Troops.json',
        'States.json', 'System.json'
      ];
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
          const key = file.replace('.json', '');
          try {
            payload[key] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          } catch {
            payload[key] = [];
          }
        }
      }
    }

    await this.importDraft(payload);
    return await this.publishLatestDraft();
  }

  async importDraft(payload: Record<string, any>) {
    const hash = computeHash(payload);
    const id = randomUUID();

    await prisma.contentDraft.create({
      data: {
        id,
        payload: JSON.stringify(payload),
        hash,
      },
    });

    return { id, hash };
  }

  async publishLatestDraft() {
    const latestDraft = await prisma.contentDraft.findFirst({
      orderBy: { created_at: 'desc' },
    });

    if (!latestDraft) {
      throw new Error('No drafts to publish');
    }

    const payload = latestDraft.payload;
    const hash = latestDraft.hash;

    const latestVersion = await prisma.contentVersion.findFirst({
      orderBy: { version: 'desc' },
    });
    
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    const versionId = randomUUID();
    await prisma.contentVersion.create({
      data: {
        id: versionId,
        version: nextVersion,
        payload,
        hash,
      },
    });

    await prisma.contentActive.deleteMany();
    await prisma.contentActive.create({
      data: {
        id: randomUUID(),
        version_id: versionId,
      },
    });

    return { version: nextVersion, versionId };
  }

  async getActiveContent() {
    let active = await prisma.contentActive.findFirst({
      include: { version: true },
    });

    if (!active || !active.version) {
      try {
        await this.autoSeedInitialContent();
        active = await prisma.contentActive.findFirst({
          include: { version: true },
        });
      } catch {
        // Fall through
      }
    }

    if (!active || !active.version) {
      throw new Error('No active content version');
    }

    return {
      version: active.version.version,
      payload: JSON.parse(active.version.payload),
    };
  }
}