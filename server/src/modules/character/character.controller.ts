import { CharacterService } from './character.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateCharacterRequestSchema, ErrorCodes } from '@nythera/shared';
import { logger } from '../../infra/logger';

export class CharacterController {
  private characterService: CharacterService;

  constructor() {
    this.characterService = new CharacterService();
  }

  async createCharacter(request: FastifyRequest, reply: FastifyReply) {
    // Validate request body
    const parseResult = CreateCharacterRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({ success: false, error: 'Invalid request', details: parseResult.error.format() });
      return;
    }
    const { actorTemplateId, mzActorId, name } = parseResult.data;
    const resolvedTemplateId = actorTemplateId || mzActorId!;

    // Get userId from request (set by auth middleware)
    const userId = request.user?.id;
    if (!userId) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const character = await this.characterService.createCharacter(userId, resolvedTemplateId, name);
      reply.status(201).send({ success: true, data: character });
    } catch (error: any) {
      if (error.code === 'INVALID_CHARACTER_NAME' || error.code === 'CHARACTER_NAME_TAKEN') {
        reply.status(400).send({ success: false, error: error.message });
      } else if (error.code === ErrorCodes.CHARACTER_ACTOR_NOT_FOUND || error.code === ErrorCodes.CHARACTER_CLASS_NOT_FOUND) {
        reply.status(404).send({ success: false, error: error.message });
      } else {
        logger.error({ err: error }, 'Error in createCharacter');
        reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  }

  async getCharacters(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.id;
    if (!userId) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const characters = await this.characterService.getCharactersByUserId(userId);
      reply.send({ success: true, data: characters });
    } catch (error) {
      logger.error({ err: error }, 'Error in getCharacters');
      reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }

  async getCharacterById(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.id;
    if (!userId) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
      return;
    }
    const { id } = request.params as { id: string };

    try {
      const character = await this.characterService.getCharacterById(id, userId);
      reply.send({ success: true, data: character });
    } catch (error: any) {
      if (error.code === 'CHARACTER_NOT_FOUND' || error.code === ErrorCodes.CHARACTER_NOT_FOUND) {
        reply.status(404).send({ success: false, error: error.message });
      } else {
        logger.error({ err: error }, 'Error in getCharacterById');
        reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  }

  async deleteCharacter(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.id;
    if (!userId) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
      return;
    }
    const { id } = request.params as { id: string };

    try {
      await this.characterService.deleteCharacter(id, userId);
      reply.send({ success: true, message: 'Personagem deletado com sucesso' });
    } catch (error: any) {
      if (error.code === 'CHARACTER_NOT_FOUND' || error.code === ErrorCodes.CHARACTER_NOT_FOUND) {
        reply.status(404).send({ success: false, error: error.message });
      } else {
        logger.error({ err: error }, 'Error in deleteCharacter');
        reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  }

  async getMzData(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await this.characterService.getMzData();
      reply.send(data);
    } catch (error) {
      logger.error({ err: error }, 'Error in getMzData');
      reply.status(500).send({ error: 'Failed to read MZ database' });
    }
  }
}

