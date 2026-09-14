import { AuthService } from '../modules/auth/auth.service';
import { CharacterService } from '../modules/character/character.service';
import { prisma } from '../infra/prisma';
import { ContentService } from '../modules/content/content.service';
import { isUserVip, getUserMaxSlots } from '@nythera/shared';

describe('VIP and Role System', () => {
  const normalEmail = 'jogador_comum@game.com';
  const testEmail = 'jogador_teste@teste.com';
  const adminEmail = 'super_admin@portal.com';
  const password = 'password123';

  let normalUserId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Cleanup
    await prisma.character.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany({
      where: {
        email: { in: [normalEmail, testEmail, adminEmail] }
      }
    });

    // Content setup for character creation
    const payload = {
      Actors: [
        { id: 1, name: 'Guerreiro', nickname: '', profile: '', classId: 1, level: 1,
          params: [100, 10, 10, 5, 5, 5, 5, 5] },
      ],
      Classes: [
        { id: 1, name: 'Guerreiro',
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
    await prisma.session.deleteMany();
    await prisma.user.deleteMany({
      where: {
        email: { in: [normalEmail, testEmail, adminEmail] }
      }
    });
  });

  it('should assign role "normal" to standard users and "admin" to test/admin emails', async () => {
    const authService = new AuthService();

    const normalUser = await authService.register(normalEmail, password);
    expect(normalUser.role).toBe('normal');
    expect(normalUser.isVip).toBe(false);
    expect(getUserMaxSlots(normalUser)).toBe(4);
    normalUserId = normalUser.id;

    const testUser = await authService.register(testEmail, password);
    expect(testUser.role).toBe('admin');
    expect(testUser.isVip).toBe(true);
    expect(getUserMaxSlots(testUser)).toBe(6);

    const adminUser = await authService.register(adminEmail, password);
    expect(adminUser.role).toBe('admin');
    expect(adminUser.isVip).toBe(true);
    expect(getUserMaxSlots(adminUser)).toBe(6);
    adminUserId = adminUser.id;
  });

  it('should allow normal user to create 4 characters, and reject 5th character with VIP_SLOT_LOCKED', async () => {
    const characterService = new CharacterService();

    // Create 4 characters
    for (let i = 1; i <= 4; i++) {
      const char = await characterService.createCharacter(normalUserId, 1, `HeroNorm_${i}`);
      expect(char).toHaveProperty('id');
    }

    const chars = await characterService.getCharactersByUserId(normalUserId);
    expect(chars.length).toBe(4);

    // 5th character attempt should fail
    await expect(
      characterService.createCharacter(normalUserId, 1, 'HeroNorm_5')
    ).rejects.toMatchObject({
      code: 'VIP_SLOT_LOCKED'
    });
  });

  it('should grant VIP via updateVipStatus and allow creating slots 5 and 6', async () => {
    const authService = new AuthService();
    const characterService = new CharacterService();

    // Grant 7 days VIP
    const vipRes = await authService.updateVipStatus(normalUserId, 1, 7);
    expect(vipRes.success).toBe(true);
    expect(vipRes.isVip).toBe(true);
    expect(vipRes.role).toBe('vip');
    expect(vipRes.vipUntil).not.toBeNull();

    // Now create 5th and 6th character
    const char5 = await characterService.createCharacter(normalUserId, 1, 'HeroNorm_5');
    expect(char5).toHaveProperty('id');

    const char6 = await characterService.createCharacter(normalUserId, 1, 'HeroNorm_6');
    expect(char6).toHaveProperty('id');

    const chars = await characterService.getCharactersByUserId(normalUserId);
    expect(chars.length).toBe(6);

    // 7th character attempt should fail with MAX_CHARACTERS_REACHED
    await expect(
      characterService.createCharacter(normalUserId, 1, 'HeroNorm_7')
    ).rejects.toMatchObject({
      code: 'MAX_CHARACTERS_REACHED'
    });
  });

  it('should retain existing 6 characters when VIP expires/is revoked without disabling them', async () => {
    const authService = new AuthService();
    const characterService = new CharacterService();

    // Revoke VIP (action = 0)
    const revokeRes = await authService.updateVipStatus(normalUserId, 0);
    expect(revokeRes.success).toBe(true);
    expect(revokeRes.isVip).toBe(false);
    expect(revokeRes.role).toBe('normal');

    // Characters in slot 5 and 6 MUST remain active and retrieved
    const chars = await characterService.getCharactersByUserId(normalUserId);
    expect(chars.length).toBe(6);
    expect(chars.some(c => c.name === 'HeroNorm_5')).toBe(true);
    expect(chars.some(c => c.name === 'HeroNorm_6')).toBe(true);

    // Creating another character still fails because currentCount (6) >= maxSlots (4)
    await expect(
      characterService.createCharacter(normalUserId, 1, 'HeroNorm_New')
    ).rejects.toMatchObject({
      code: 'VIP_SLOT_LOCKED'
    });

    // Delete one character -> count becomes 5
    const charToDelete = chars.find(c => c.name === 'HeroNorm_6')!;
    await characterService.deleteCharacter(charToDelete.id, normalUserId);

    const charsAfterDel = await characterService.getCharactersByUserId(normalUserId);
    expect(charsAfterDel.length).toBe(5);

    // Still cannot create because 5 >= 4 (non-vip slot locked)
    await expect(
      characterService.createCharacter(normalUserId, 1, 'HeroNorm_New')
    ).rejects.toMatchObject({
      code: 'VIP_SLOT_LOCKED'
    });
  });
});
