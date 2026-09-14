import { CharacterService } from '../modules/character/character.service';
import { prisma } from '../infra/prisma';
import { ContentService } from '../modules/content/content.service';
import { ErrorCodes } from '@nythera/shared';

describe('CharacterService', () => {
  const userId = 'user-id-for-test';
  const actorTemplateId = 1;
  const name = 'Test Character';

  let authUserId: string;

  beforeAll(async () => {
    // Clean up before tests
    await prisma.character.deleteMany();
    await prisma.user.deleteMany();

    // Create a test user
    const user = await prisma.user.create({
      data: {
        id: 'user-id-for-test',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        role: 'admin',
      }
    });
    authUserId = user.id;

    const payload = {
      Actors: [
        { id: 1, name: 'Warrior', nickname: '', profile: '', classId: 1, level: 1,
          params: [100, 10, 10, 5, 5, 5, 5, 5] },
      ],
      Classes: [
        { id: 1, name: 'Warrior',
          params: [100, 10, 10, 5, 5, 5, 5, 5],
          learns: [] },
      ],
      Skills: [null],
      Items: [null],
      Weapons: [null],
      Armors: [null],
      Enemies: [null],
      Troops: [null],
      States: [null],
      System: {},
    };

    const contentService = new ContentService();
    await contentService.importDraft(payload);
    await contentService.publishLatestDraft();
  });

  afterAll(async () => {
    await prisma.character.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should create a character with valid actor template id', async () => {
    const characterService = new CharacterService();
    const character = await characterService.createCharacter(userId, actorTemplateId, name);
    expect(character).toHaveProperty('id');
    expect(character.user_id).toBe(userId);
    expect(character.actor_template_id).toBe(actorTemplateId);
    expect(character.name).toBe(name);
    expect(character.base_stats).toHaveProperty('actor');
    expect(character.base_stats).toHaveProperty('class');
    const stats = character.base_stats as any;
    expect(stats.actor.id).toBe(1);
    expect(stats.actor.name).toBe('Warrior');
    expect(stats.class.id).toBe(1);
    expect(stats.class.name).toBe('Warrior');
  });

  it('should not create a character with unknown actor template id', async () => {
    const characterService = new CharacterService();
    await expect(characterService.createCharacter(userId, 999, 'Invalid Template')).rejects.toMatchObject({
      code: ErrorCodes.CHARACTER_ACTOR_NOT_FOUND,
    });
  });

  it('should reject creating character with duplicate name', async () => {
    const characterService = new CharacterService();
    await expect(characterService.createCharacter(userId, actorTemplateId, name)).rejects.toMatchObject({
      code: 'CHARACTER_NAME_TAKEN',
    });
  });

  it('should get characters by user id', async () => {
    const characterService = new CharacterService();
    await characterService.createCharacter(userId, actorTemplateId, 'Warrior Two');
    const characters = await characterService.getCharactersByUserId(userId);
    expect(characters.length).toBeGreaterThan(1);
    expect(characters.some(c => c.name === 'Warrior Two')).toBe(true);
  });

  it('should get a character by id', async () => {
    const characterService = new CharacterService();
    const created = await characterService.createCharacter(userId, actorTemplateId, 'Warrior Three');
    const fetched = await characterService.getCharacterById(created.id, userId);
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe('Warrior Three');
  });

  it('should not get a character by id for another user', async () => {
    const characterService = new CharacterService();
    const created = await characterService.createCharacter(userId, actorTemplateId, 'Warrior Four');
    await expect(characterService.getCharacterById(created.id, 'different-user-id')).rejects.toMatchObject({
      code: ErrorCodes.CHARACTER_NOT_FOUND,
    });
  });

  it('should delete a character', async () => {
    const characterService = new CharacterService();
    const toDelete = await characterService.createCharacter(userId, actorTemplateId, 'To Delete');
    const deleteRes = await characterService.deleteCharacter(toDelete.id, userId);
    expect(deleteRes.success).toBe(true);
    await expect(characterService.getCharacterById(toDelete.id, userId)).rejects.toMatchObject({
      code: ErrorCodes.CHARACTER_NOT_FOUND,
    });
  });

  it('should return mzData with classes, actors, and maps', async () => {
    const characterService = new CharacterService();
    const mzData = await characterService.getMzData();
    expect(mzData).toHaveProperty('classes');
    expect(mzData).toHaveProperty('actors');
    expect(mzData).toHaveProperty('maps');
    expect(Array.isArray(mzData.classes)).toBe(true);
    expect(Array.isArray(mzData.actors)).toBe(true);
    expect(Array.isArray(mzData.maps)).toBe(true);
  });
});