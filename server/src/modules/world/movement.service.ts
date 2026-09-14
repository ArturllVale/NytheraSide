import type { MapMoveRequest } from '@nythera/shared';

const MAX_MAP_ID = 9_999;
const MAX_COORDINATE = 10_000;
const VALID_DIRECTIONS = new Set([2, 4, 6, 8]);

export interface MovementState { mapId: number; x: number; y: number; direction: number; updatedAt: number; }
export class MovementService {
  validate(intent: MapMoveRequest, previous: MovementState | null, now = Date.now()): string | null {
    const values = [intent.mapId, intent.x, intent.y, intent.realX, intent.realY, intent.direction, intent.speed, intent.characterIndex];
    if (values.some((value) => value !== undefined && !Number.isFinite(value))) return 'Movimento contém valores inválidos';
    if (intent.mapId < 1 || intent.mapId > MAX_MAP_ID || intent.x < 0 || intent.y < 0 || intent.x > MAX_COORDINATE || intent.y > MAX_COORDINATE) return 'Coordenadas ou mapa inválidos';
    if (!VALID_DIRECTIONS.has(intent.direction) || intent.speed < 1 || intent.speed > 6) return 'Direção ou velocidade inválida';
    if (!previous) return null;
    if (previous.mapId !== intent.mapId) return intent.isMoving ? 'Mudança de mapa durante movimento não permitida' : null;
    const elapsedSeconds = Math.max(0.05, (now - previous.updatedAt) / 1000);
    // RPG Maker movement speed is tile-based; retain a generous latency allowance without accepting teleports.
    const maxDistance = Math.max(2, intent.speed * elapsedSeconds * 4 + 2);
    if (Math.hypot(intent.x - previous.x, intent.y - previous.y) > maxDistance) return 'Movimento distante demais';
    return null;
  }
}
