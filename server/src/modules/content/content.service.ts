import { prisma } from '../../infra/prisma';
import { randomUUID, createHash } from 'crypto';

function computeHash(payload: unknown): string {
  const payloadString = JSON.stringify(payload);
  return createHash('sha256').update(payloadString, 'utf8').digest('hex');
}

export class ContentService {
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
    const active = await prisma.contentActive.findFirst({
      include: { version: true },
    });

    if (!active || !active.version) {
      throw new Error('No active content version');
    }

    return {
      version: active.version.version,
      payload: JSON.parse(active.version.payload),
    };
  }
}