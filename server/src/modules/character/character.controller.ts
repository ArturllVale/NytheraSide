import { CharacterService } from './character.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateCharacterRequestSchema, ErrorCodes } from '@nythera/shared';
import { z } from 'zod';

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
    const { actorTemplateId, name } = parseResult.data;

    // Get userId from request (set by auth middleware)
    const userId = request.user?.id;
    if (!userId) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const character = await this.characterService.createCharacter(userId, actorTemplateId, name);
      reply.status(201).send({ success: true, data: character });
    } catch (error: any) {
      if (error.code === ErrorCodes.CHARACTER_ACTOR_NOT_FOUND || error.code === ErrorCodes.CHARACTER_CLASS_NOT_FOUND) {
        reply.status(404).send({ success: false, error: error.message });
      } else {
        console.error('Error in createCharacter:', error);
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
      console.error('Error in getCharacters:', error);
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
      if (error.code === 'CHARACTER_NOT_FOUND') {
        reply.status(404).send({ success: false, error: error.message });
      } else {
        console.error('Error in getCharacterById:', error);
        reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  }
}
