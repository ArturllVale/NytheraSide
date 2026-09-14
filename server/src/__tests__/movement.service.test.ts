import { MovementService } from '../modules/world/movement.service';

const valid = { mapId: 1, x: 10, y: 10, realX: 10, realY: 10, direction: 2, speed: 4, isMoving: true, characterName: 'Actor1', characterIndex: 0 };

describe('MovementService', () => {
  const service = new MovementService();
  const previous = { mapId: 1, x: 10, y: 10, direction: 2, updatedAt: 10_000 };

  it('accepts a nearby movement intent', () => expect(service.validate({ ...valid, x: 11 }, previous, 10_100)).toBeNull());
  it('rejects teleport-sized position changes and preserves caller state', () => expect(service.validate({ ...valid, x: 500 }, previous, 10_100)).toBe('Movimento distante demais'));
  it('rejects invalid speed and non-finite coordinates', () => {
    expect(service.validate({ ...valid, speed: 7 }, previous, 10_100)).toBe('Direção ou velocidade inválida');
    expect(service.validate({ ...valid, x: Number.NaN }, previous, 10_100)).toBe('Movimento contém valores inválidos');
  });
  it('rejects map changes while moving', () => expect(service.validate({ ...valid, mapId: 2 }, previous, 10_100)).toBe('Mudança de mapa durante movimento não permitida'));
});
