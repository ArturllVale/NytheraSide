import type { MapPlayer } from '@nythera/shared';

export interface WorldSocket { readyState: number; send(data: string): void; }
export interface WorldPlayer extends MapPlayer { socket: WorldSocket; playerName?: string; }

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

  findPlayerByName(name: string): WorldPlayer | undefined {
    const search = name.trim().toLowerCase();
    for (const map of this.maps.values()) {
      for (const player of map.values()) {
        const pName = (player.playerName || (player as any).name || '').toLowerCase();
        if (pName === search) return player;
      }
    }
    return undefined;
  }

  sendWhisper(senderSocket: WorldSocket, senderCharId: string, senderName: string, senderRole: string, targetName: string, message: string): boolean {
    const targetPlayer = this.findPlayerByName(targetName);
    if (!targetPlayer || targetPlayer.socket.readyState !== 1) {
      // Notifica o remetente que o jogador não foi encontrado ou está offline
      if (senderSocket.readyState === 1) {
        senderSocket.send(JSON.stringify({
          type: 'CHAT_MSG_RES',
          channel: 'system',
          sender: 'Sistema',
          role: 'system',
          message: `Jogador "${targetName}" não foi encontrado ou está offline.`
        }));
      }
      return false;
    }

    const payload = JSON.stringify({
      type: 'CHAT_MSG_RES',
      channel: 'whisper',
      characterId: senderCharId,
      sender: senderName,
      role: senderRole,
      target: targetPlayer.playerName || targetName,
      message
    });

    // Envia para o destinatário
    targetPlayer.socket.send(payload);

    // Envia também uma cópia de confirmação para o próprio remetente (se forem sockets diferentes)
    if (senderSocket !== targetPlayer.socket && senderSocket.readyState === 1) {
      senderSocket.send(payload);
    }
    return true;
  }

  broadcastChat(channel: 'global' | 'local' | 'system', characterId: string, sender: string, role: string, message: string, mapId?: number): void {
    const payload = JSON.stringify({
      type: 'CHAT_MSG_RES',
      channel,
      characterId,
      sender,
      role,
      message
    });

    if (channel === 'global' || channel === 'system') {
      for (const map of this.maps.values()) {
        for (const player of map.values()) {
          if (player.socket.readyState === 1) player.socket.send(payload);
        }
      }
    } else if (channel === 'local' && mapId !== undefined) {
      const map = this.maps.get(mapId);
      if (map) {
        for (const player of map.values()) {
          if (player.socket.readyState === 1) player.socket.send(payload);
        }
      }
    }
  }
}
