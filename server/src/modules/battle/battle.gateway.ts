import { FastifyInstance, FastifyRequest } from 'fastify';
import { BattleService } from './battle.service';
import { BattleWsPayloadSchema, MapPlayer } from '@nythera/shared';
import { prisma } from '../../infra/prisma';

// Estado global do mapa para o MVP
// mapId -> characterId -> MapPlayer & { socket: any }
const mapState = new Map<number, Map<string, MapPlayer & { socket: any }>>();

export default async function battleGateway(fastify: FastifyInstance) {
  const battleService = new BattleService();

  fastify.get('/sync', { websocket: true }, (connection, req: FastifyRequest) => {
    let characterId: string | null = null;
    let activeBattleId: string | null = null;
    let currentMapId: number | null = null;
    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastDir: number | null = null;
    let lastDbSaveAt = 0;
    const socket: any = (connection as any).socket || connection;

    const savePositionToDb = async () => {
      if (characterId && currentMapId !== null && lastX !== null && lastY !== null) {
        try {
          await prisma.character.update({
            where: { id: characterId },
            data: {
              map_id: currentMapId,
              position_x: Math.round(lastX),
              position_y: Math.round(lastY),
              direction: lastDir || 2
            }
          });
          fastify.log.info({ characterId, map_id: currentMapId, x: Math.round(lastX), y: Math.round(lastY) }, '[MapSync] Character position persisted to DB');
        } catch (err) {
          fastify.log.error({ err }, '[MapSync] Failed to persist position to DB');
        }
      }
    };

    const removeFromMap = () => {
      if (characterId && currentMapId !== null) {
        const playersOnMap = mapState.get(currentMapId);
        if (playersOnMap) {
          playersOnMap.delete(characterId);
          broadcastMapUpdate(currentMapId);
        }
        savePositionToDb();
      }
    };

    socket.on('close', () => {
      removeFromMap();
    });

    socket.on('error', () => {
      removeFromMap();
    });

    // Função helper para enviar posições do mapa para todos
    function broadcastMapUpdate(mapId: number) {
      const playersOnMap = mapState.get(mapId);
      if (!playersOnMap) return;

      for (const [charId, playerObj] of playersOnMap.entries()) {
        if (playerObj.socket.readyState !== 1) continue;

        // Omitir o próprio jogador do pacote para não ser desenhado duas vezes
        const othersPayload = Array.from(playersOnMap.values())
          .filter(p => p.id !== charId)
          .map(p => ({
            id: p.id,
            mapId: p.mapId,
            x: p.x,
            y: p.y,
            realX: p.realX,
            realY: p.realY,
            isMoving: p.isMoving,
            direction: p.direction,
            speed: p.speed,
            characterName: p.characterName,
            characterIndex: p.characterIndex,
            followers: p.followers,
          }));

        const msg = JSON.stringify({
          type: 'MAP_UPDATE_RES',
          payload: { players: othersPayload }
        });

        playerObj.socket.send(msg);
      }
    }

    socket.on('message', async (message: Buffer) => {
      try {
        const raw = JSON.parse(message.toString());
        
        // Parse against the client payload schema first
        const parsed = BattleWsPayloadSchema.safeParse(raw);
        if (!parsed.success) {
          socket.send(JSON.stringify({ type: 'ERROR_RES', message: 'Payload inválido' }));
          return;
        }

        const payload = parsed.data;

        // 1. AUTH_REQ — deve ser o primeiro comando, define characterId
        if (payload.type === 'AUTH_REQ') {
          const token = payload.token;
          if (!token) throw new Error('Token não fornecido');
          
          const session = await prisma.session.findUnique({ where: { token } });
          if (!session || session.expires_at < new Date()) {
            throw new Error('Sessão inválida ou expirada');
          }
          
          let char = null;
          if (payload.characterId) {
            char = await prisma.character.findFirst({ where: { id: payload.characterId, user_id: session.user_id } });
          }
          if (!char) {
            char = await prisma.character.findFirst({ where: { user_id: session.user_id }, orderBy: { created_at: 'asc' } });
          }
          if (!char) {
            throw new Error('Nenhum personagem encontrado para este usuário');
          }
          
          let baseStats: any = {};
          try { baseStats = JSON.parse(char.base_stats); } catch (e) {}

          characterId = char.id;
          currentMapId = char.map_id;
          lastX = char.position_x;
          lastY = char.position_y;
          lastDir = char.direction;

          socket.send(JSON.stringify({
            type: 'AUTH_RES',
            success: true,
            character: {
              id: char.id,
              name: char.name,
              actorTemplateId: char.actor_template_id,
              mapId: char.map_id,
              x: char.position_x,
              y: char.position_y,
              direction: char.direction,
              characterName: baseStats?.actor?.characterName || 'Actor1',
              characterIndex: baseStats?.actor?.characterIndex ?? 0,
            }
          }));
          return;
        }

        // 2. Todas as outras rotas exigem autenticação prévia
        if (!characterId) {
          throw new Error('Autentique-se primeiro com AUTH_REQ');
        }

        if (payload.type === 'BATTLE_START_REQ') {
          const { state } = await battleService.startBattle(characterId, payload.troopId);
          activeBattleId = state.id;
          socket.send(JSON.stringify({
            type: 'BATTLE_UPDATE_RES',
            state,
            events: []
          }));
        } 
        else if (payload.type === 'BATTLE_COMMAND_REQ') {
          if (!activeBattleId) throw new Error('Nenhuma batalha ativa');
          const { state, events } = await battleService.submitCommand(activeBattleId, characterId, payload.command);
          socket.send(JSON.stringify({
            type: 'BATTLE_UPDATE_RES',
            state,
            events
          }));
        }
        else if (payload.type === 'BATTLE_SET_AUTO_REQ') {
          // TODO: implementar modo automático persistente
        }
        else if (payload.type === 'MAP_MOVE_REQ') {
          const reqMapId = payload.payload.mapId;
          
          // Se mudou de mapa, remove do anterior
          if (currentMapId !== null && currentMapId !== reqMapId) {
             removeFromMap();
          }

          currentMapId = reqMapId;
          lastX = payload.payload.x;
          lastY = payload.payload.y;
          lastDir = payload.payload.direction;

          // Salvar periodicamente no banco a cada 3s enquanto anda
          const now = Date.now();
          if (now - lastDbSaveAt > 3000) {
            lastDbSaveAt = now;
            savePositionToDb();
          }
          
          if (!mapState.has(currentMapId)) {
            mapState.set(currentMapId, new Map());
          }

          const playersOnMap = mapState.get(currentMapId)!;
          playersOnMap.set(characterId, {
            id: characterId,
            mapId: currentMapId,
            x: payload.payload.x,
            y: payload.payload.y,
            realX: payload.payload.realX,
            realY: payload.payload.realY,
            isMoving: payload.payload.isMoving,
            direction: payload.payload.direction,
            speed: payload.payload.speed,
            characterName: payload.payload.characterName,
            characterIndex: payload.payload.characterIndex,
            followers: payload.payload.followers,
            socket: socket
          });

          fastify.log.info({ characterId, mapId: currentMapId, x: payload.payload.x, y: payload.payload.y }, '[MapSync] MAP_MOVE_REQ received');
          broadcastMapUpdate(currentMapId);
        }
      } catch (err: any) {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'ERROR_RES', message: err.message || 'Erro desconhecido' }));
        }
      }
    });
  });

  // Alias legacy — clients that still have /battle/sync cached will connect here
  fastify.get('/battle/sync', { websocket: true }, (connection, req: FastifyRequest) => {
    const socket: any = (connection as any).socket || connection;
    socket.send(JSON.stringify({ type: 'ERROR_RES', message: 'Rota descontinuada. Conecte em /sync' }));
    socket.close();
  });
}
