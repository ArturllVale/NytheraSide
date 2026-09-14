import { prisma } from '../../infra/prisma';

export interface Position { mapId: number; x: number; y: number; direction: number; }

/** Coalesces frequent movement packets into bounded database writes. */
export class PositionPersistenceService {
  private readonly dirty = new Map<string, Position>();
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly flushIntervalMs = 5_000, private readonly onError: (error: unknown, characterId: string) => void = () => {}) {
    this.timer = setInterval(() => void this.flush(), flushIntervalMs);
    this.timer.unref();
  }
  markDirty(characterId: string, position: Position): void { this.dirty.set(characterId, position); }
  async flushCharacter(characterId: string): Promise<void> {
    const position = this.dirty.get(characterId); if (!position) return;
    this.dirty.delete(characterId);
    try { await prisma.character.update({ where: { id: characterId }, data: { map_id: position.mapId, position_x: Math.round(position.x), position_y: Math.round(position.y), direction: position.direction } }); }
    catch (error) { this.dirty.set(characterId, position); this.onError(error, characterId); }
  }
  async flush(): Promise<void> { await Promise.all([...this.dirty.keys()].map((id) => this.flushCharacter(id))); }
  async close(): Promise<void> { clearInterval(this.timer); await this.flush(); }
}
