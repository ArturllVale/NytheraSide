import { FastifyInstance, FastifyRequest } from 'fastify';
import { BattleService } from './battle.service';
import { BattleWsPayloadSchema } from '@nythera/shared';
import { prisma } from '../../infra/prisma';

export default async function battleGateway(fastify: FastifyInstance) {
  const battleService = new BattleService();

  fastify.get('/battle/sync', { websocket: true }, (connection, req: FastifyRequest) => {
    let characterId: string | null = null;
    let activeBattleId: string | null = null;

    connection.socket.on('message', async (message: Buffer) => {
      try {
        const raw = JSON.parse(message.toString());
        
        // Parse against the client payload schema first
        const parsed = BattleWsPayloadSchema.safeParse(raw);
        if (!parsed.success) {
          connection.socket.send(JSON.stringify({ type: 'ERROR_RES', message: 'Payload inválido' }));
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
          
          const char = await prisma.character.findFirst({ where: { user_id: session.user_id } });
          if (!char) {
            throw new Error('Nenhum personagem encontrado para este usuário');
          }
          
          characterId = char.id;
          connection.socket.send(JSON.stringify({ type: 'AUTH_RES', success: true }));
          return;
        }

        // 2. Todas as outras rotas exigem autenticação prévia
        if (!characterId) {
          throw new Error('Autentique-se primeiro com AUTH_REQ');
        }

        if (payload.type === 'BATTLE_START_REQ') {
          const { state } = await battleService.startBattle(characterId, payload.troopId);
          activeBattleId = state.id;
          connection.socket.send(JSON.stringify({
            type: 'BATTLE_UPDATE_RES',
            state,
            events: []
          }));
        } 
        else if (payload.type === 'BATTLE_COMMAND_REQ') {
          if (!activeBattleId) throw new Error('Nenhuma batalha ativa');
          const { state, events } = await battleService.submitCommand(activeBattleId, characterId, payload.command);
          connection.socket.send(JSON.stringify({
            type: 'BATTLE_UPDATE_RES',
            state,
            events
          }));
        }
        else if (payload.type === 'BATTLE_SET_AUTO_REQ') {
          // TODO: implementar modo automático persistente
        }
      } catch (err: any) {
        connection.socket.send(JSON.stringify({ type: 'ERROR_RES', message: err.message || 'Erro desconhecido' }));
      }
    });
  });
}
