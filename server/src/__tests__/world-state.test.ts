import { WorldState } from '../modules/world/world-state';

function player(id: string, socket: { readyState: number; send: (data: string) => void }) {
  return { id, socket, mapId: 1, x: 1, y: 1, direction: 2, speed: 4, characterName: 'Actor1', characterIndex: 0 };
}
describe('WorldState', () => {
  it('broadcasts each player only the other players', () => {
    const sentA: string[] = [], sentB: string[] = [];
    const world = new WorldState();
    world.upsert(player('a', { readyState: 1, send: (data) => sentA.push(data) }));
    world.upsert(player('b', { readyState: 1, send: (data) => sentB.push(data) }));
    world.broadcast(1);
    expect(JSON.parse(sentA[0]).payload.players.map((p: { id: string }) => p.id)).toEqual(['b']);
    expect(JSON.parse(sentB[0]).payload.players.map((p: { id: string }) => p.id)).toEqual(['a']);
  });
});
