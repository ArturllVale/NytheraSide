import type { MapPlayer } from '@nythera/shared';

export interface WorldSocket { readyState: number; send(data: string): void; }
export interface WorldPlayer extends MapPlayer { socket: WorldSocket; }

/** In-process realtime presence. Persistence deliberately lives outside this class. */
export class WorldState {
  private readonly maps = new Map<number, Map<string, WorldPlayer>>();

  upsert(player: WorldPlayer): void {
    let map = this.maps.get(player.mapId);
    if (!map) { map = new Map(); this.maps.set(player.mapId, map); }
    map.set(player.id, player);
  }

  remove(characterId: string, mapId: number): boolean {
    const map = this.maps.get(mapId);
    if (!map || !map.delete(characterId)) return false;
    if (map.size === 0) this.maps.delete(mapId);
    return true;
  }

  /** Sends one serialized payload per recipient, excluding that recipient's own player. */
  broadcast(mapId: number): void {
    const map = this.maps.get(mapId);
    if (!map) return;
    const players = [...map.values()];
    for (const recipient of players) {
      if (recipient.socket.readyState !== 1) continue;
      const visible = players.filter(({ id }) => id !== recipient.id).map(({ socket: _socket, ...player }) => player);
      recipient.socket.send(JSON.stringify({ type: 'MAP_UPDATE_RES', payload: { players: visible } }));
    }
  }

  removeSocket(socket: WorldSocket): Array<{ characterId: string; mapId: number }> {
    const removed: Array<{ characterId: string; mapId: number }> = [];
    for (const [mapId, map] of this.maps) {
      for (const [characterId, player] of map) if (player.socket === socket) {
        map.delete(characterId); removed.push({ characterId, mapId });
      }
      if (map.size === 0) this.maps.delete(mapId);
    }
    return removed;
  }
}
