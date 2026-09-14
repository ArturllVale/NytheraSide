import { describe, it, expect, beforeAll } from 'vitest';
import { BattleService } from '../modules/battle/battle.service';
import { CharacterService } from '../modules/character/character.service';
import { prisma } from '../infra/prisma';
import { ContentService } from '../modules/content/content.service';

describe('BattleService - Start Battle Encounters', () => {
  const battleService = new BattleService();
  let characterId: string;

  beforeAll(async () => {
    await prisma.battle.deleteMany();
    await prisma.character.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        id: 'user-battle-test',
        email: 'battletest@example.com',
        password_hash: 'hashed',
      }
    });

    const payload = {
      Actors: [
        null,
        { id: 1, name: 'Hero', classId: 1, params: [200, 20, 20, 10, 10, 10, 10, 10] },
      ],
      Classes: [
        null,
        { id: 1, name: 'Warrior', params: [200, 20, 20, 10, 10, 10, 10, 10] },
      ],
      Skills: [null, { id: 1, name: 'Attack', mpCost: 0, damage: { type: 1, formula: 'a.atk * 4 - b.def * 2' } }],
      Items: [null],
      Weapons: [null],
      Armors: [null],
      Enemies: [
        null,
        { id: 1, name: 'Goblin', params: [100, 10, 15, 8, 5, 5, 10, 5], dropItems: [] },
        { id: 2, name: 'Gnome', params: [120, 15, 12, 10, 8, 8, 8, 5], dropItems: [] }
      ],
      Troops: [
        null,
        { id: 1, name: 'Goblin Pair', members: [{ enemyId: 1 }, { enemyId: 1 }] }
      ],
      States: [null],
      System: {}
    };

    const contentService = new ContentService();
    await contentService.importDraft(payload);
    await contentService.publishLatestDraft();

    const characterService = new CharacterService();
    const character = await characterService.createCharacter(user.id, 1, 'BattleHero');
    characterId = character.id;
  });

  it('should start battle with troopId (database troop)', async () => {
    const { state } = await battleService.startBattle(characterId, 1);
    expect(state).toBeDefined();
    expect(state.status).toBe('ACTIVE');
    expect(state.troop).toHaveLength(2);
    expect(state.troop[0].name).toBe('Goblin');
    expect(state.troop[1].name).toBe('Goblin');
    expect(state.party[0].name).toBe('BattleHero');
  });

  it('should start battle with dynamic enemyIds (region monster tags)', async () => {
    const { state } = await battleService.startBattle(characterId, undefined, [1, 2]);
    expect(state).toBeDefined();
    expect(state.status).toBe('ACTIVE');
    expect(state.troop).toHaveLength(2);
    expect(state.troop[0].templateId).toBe(1);
    expect(state.troop[0].name).toBe('Goblin');
    expect(state.troop[1].templateId).toBe(2);
    expect(state.troop[1].name).toBe('Gnome');
  });

  it('should throw error when neither troopId nor enemyIds is provided', async () => {
    await expect(battleService.startBattle(characterId)).rejects.toThrow(
      'Either troopId or enemyIds must be provided'
    );
  });
});
