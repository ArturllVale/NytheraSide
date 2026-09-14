import { FastifyPluginAsync } from 'fastify';
import { CharacterController } from './character.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import fp from 'fastify-plugin';

const characterPlugin: FastifyPluginAsync = async (fastify) => {
  const characterController = new CharacterController();

  fastify.post(
    '/characters',
    { preHandler: [authMiddleware] },
    characterController.createCharacter.bind(characterController)
  );
  fastify.get(
    '/characters',
    { preHandler: [authMiddleware] },
    characterController.getCharacters.bind(characterController)
  );
  fastify.get(
    '/characters/:id',
    { preHandler: [authMiddleware] },
    characterController.getCharacterById.bind(characterController)
  );
  fastify.delete(
    '/characters/:id',
    { preHandler: [authMiddleware] },
    characterController.deleteCharacter.bind(characterController)
  );

  // Public endpoint for RPG Maker MZ game data (classes, heroes/actors, maps)
  fastify.get('/game/mzdata', characterController.getMzData.bind(characterController));
  fastify.get('/characters/mzdata', characterController.getMzData.bind(characterController));
};

export default fp(characterPlugin, { name: 'character' });