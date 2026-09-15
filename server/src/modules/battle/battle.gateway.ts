import type { FastifyInstance, FastifyRequest } from 'fastify';
import { BattleWsPayloadSchema, isUserVip, type MapPlayer } from '@nythera/shared';
import { BattleService } from './battle.service';
import { AuthService } from '../auth/auth.service';
import { prisma } from '../../infra/prisma';
import { rateLimiter } from '../../infra/ratelimit';
import { MovementService, type MovementState } from '../world/movement.service';
import { PositionPersistenceService } from '../world/position-persistence.service';
import { WorldState, type WorldSocket } from '../world/world-state';

const OPEN = 1;
const AUTH_TIMEOUT_MS = 15_000;
const MAX_MESSAGES_PER_MINUTE = 180;
const MAX_MOVES_PER_SECOND = 20;

function send(socket: WorldSocket, payload: unknown) { if (socket.readyState === OPEN) socket.send(JSON.stringify(payload)); }

export default async function battleGateway(fastify: FastifyInstance) {
  const world = new WorldState();
  const positions = new PositionPersistenceService(5_000, (err, characterId) => fastify.log.error({ err, characterId }, 'position persistence failed'));
  const movement = new MovementService();
  fastify.addHook('onClose', async () => { await positions.close(); });

  fastify.get('/sync', { websocket: true }, (connection, req: FastifyRequest) => {
    const socket = ((connection as any).socket || connection) as WorldSocket & { on(event: string, listener: (...args: any[]) => void): void; close(code?: number): void; };
    const battleService = new BattleService();
    const authService = new AuthService();
    let characterId: string | null = null;
    let userId: string | null = null;
    let activeBattleId: string | null = null;
    let current: MovementState | null = null;
    let cleanedUp = false;
    const remoteAddress = req.ip;
    const authTimeout = setTimeout(() => { if (!characterId) { send(socket, { type: 'ERROR_RES', message: 'Tempo de autenticação esgotado' }); socket.close(1008); } }, AUTH_TIMEOUT_MS);

    const cleanup = () => {
      if (cleanedUp) return; cleanedUp = true; clearTimeout(authTimeout);
      if (characterId) void positions.flushCharacter(characterId);
      for (const removed of world.removeSocket(socket)) world.broadcast(removed.mapId);
      fastify.log.info({ characterId, remoteAddress }, 'websocket disconnected');
    };
    socket.on('close', cleanup); socket.on('error', (err: Error) => { fastify.log.warn({ err, characterId }, 'websocket error'); cleanup(); });
    fastify.log.info({ remoteAddress }, 'websocket connected');

    socket.on('message', async (message: Buffer) => {
      try {
        if (message.length > 16 * 1024) throw new Error('Payload muito grande');
        if (await rateLimiter.increment(`ws:message:${remoteAddress}`, 60) > MAX_MESSAGES_PER_MINUTE) throw new Error('Muitas mensagens');
        let raw: unknown; try { raw = JSON.parse(message.toString('utf8')); } catch { throw new Error('JSON inválido'); }
        const parsed = BattleWsPayloadSchema.safeParse(raw);
        if (!parsed.success) throw new Error('Payload inválido');
        const payload = parsed.data;

        if (payload.type === 'AUTH_REQ') {
          if (characterId) throw new Error('Conexão já autenticada');
          if (await rateLimiter.increment(`ws:auth:${remoteAddress}`, 60) > 10) throw new Error('Muitas tentativas de autenticação');
          const session = await authService.validateToken(payload.token);
          if (!session) throw new Error('Sessão inválida ou expirada');
          const char = payload.characterId
            ? await prisma.character.findFirst({ where: { id: payload.characterId, user_id: session.userId } })
            : await prisma.character.findFirst({ where: { user_id: session.userId }, orderBy: { created_at: 'asc' } });
          if (!char) throw new Error('Personagem não encontrado ou não pertence ao usuário');
          const user = await prisma.user.findUnique({ where: { id: session.userId } });
          if (!user) throw new Error('Usuário não encontrado');
          let baseStats: any = {}; try { baseStats = JSON.parse(char.base_stats); } catch { /* legacy malformed data uses defaults */ }
          characterId = char.id; userId = session.userId; current = { mapId: char.map_id, x: char.position_x, y: char.position_y, direction: char.direction, updatedAt: Date.now() }; clearTimeout(authTimeout);
          send(socket, { type: 'AUTH_RES', success: true, character: { id: char.id, name: char.name, actorTemplateId: char.actor_template_id, mapId: char.map_id, x: char.position_x, y: char.position_y, direction: char.direction, characterName: baseStats?.actor?.characterName || 'Actor1', characterIndex: baseStats?.actor?.characterIndex ?? 0 }, user: { role: user.role, isVip: isUserVip(user), vipUntil: user.vip_until?.toISOString() ?? null } });
          fastify.log.info({ characterId, userId }, 'websocket authenticated'); return;
        }
        if (!characterId || !userId || !current) throw new Error('Autentique-se primeiro com AUTH_REQ');
        if (payload.type === 'MAP_MOVE_REQ') {
          if (await rateLimiter.increment(`ws:move:${characterId}`, 1) > MAX_MOVES_PER_SECOND) throw new Error('Movimento muito frequente');
          const reason = movement.validate(payload.payload, current); if (reason) throw new Error(reason);
          const previousMapId = current.mapId;
          current = { mapId: payload.payload.mapId, x: payload.payload.x, y: payload.payload.y, direction: payload.payload.direction, updatedAt: Date.now() };
          positions.markDirty(characterId, current);
          if (previousMapId !== current.mapId) { world.remove(characterId, previousMapId); world.broadcast(previousMapId); await positions.flushCharacter(characterId); }
          const player: MapPlayer = { id: characterId, ...payload.payload };
          world.upsert({ ...player, socket }); world.broadcast(current.mapId); return;
        }
        if (payload.type === 'BATTLE_START_REQ') { const { state } = await battleService.startBattle(characterId, payload.troopId, payload.enemyIds); activeBattleId = state.id; send(socket, { type: 'BATTLE_UPDATE_RES', state, events: [] }); return; }
        if (payload.type === 'BATTLE_COMMAND_REQ') { if (!activeBattleId) throw new Error('Nenhuma batalha ativa'); if (await rateLimiter.increment(`ws:battle:${characterId}`, 1) > 8) throw new Error('Comandos de batalha muito frequentes'); const { state, events } = await battleService.submitCommand(activeBattleId, characterId, payload.command); send(socket, { type: 'BATTLE_UPDATE_RES', state, events }); return; }
        if (payload.type === 'CMD_VIP_REQ') {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user?.role !== 'admin') throw new Error('Comando administrativo não autorizado');
          const vipInfo = await authService.updateVipStatus(userId, payload.action, payload.days || 7);
          send(socket, { type: 'CMD_VIP_RES', ...vipInfo, message: payload.action === 1 ? 'Status VIP atualizado.' : 'Status VIP revogado.' }); return;
        }
        if (payload.type === 'EVENT_SYNC_REQ') {
          const { EventService } = await import('../world/npc.service');
          const eventService = new EventService();
          await eventService.syncEvent(characterId, payload.mapId, payload.eventId, payload.choices);
          return;
        }
      } catch (err: any) { fastify.log.warn({ err: err?.message, characterId }, 'websocket message rejected'); send(socket, { type: 'ERROR_RES', message: err?.message || 'Erro desconhecido' }); }
    });
  });
  fastify.get('/battle/sync', { websocket: true }, (connection) => { const socket: any = (connection as any).socket || connection; send(socket, { type: 'ERROR_RES', message: 'Rota descontinuada. Conecte em /sync' }); socket.close(); });
}
