import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ContentService } from '../content/content.service';
import { ErrorCodes, isUserVip } from '@nythera/shared';
import { prisma } from '../../infra/prisma';

export class CharacterService {
  private contentService: ContentService;

  constructor() {
    this.contentService = new ContentService();
  }

  // Helper to locate the RPG Maker MZ data folder
  private getMzDataDir(): string {
    const candidatePaths = [
      path.resolve(process.cwd(), '..', 'data'),
      path.resolve(process.cwd(), 'data'),
      path.resolve(__dirname, '../../../../data'),
      path.resolve(__dirname, '../../../data'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p) && fs.existsSync(path.join(p, 'Actors.json'))) {
        return p;
      }
    }

    return candidatePaths[0];
  }

  // Helper to get active content payload with fallback to raw MZ data files
  private async getActiveContent(): Promise<any> {
    try {
      const { payload } = await this.contentService.getActiveContent();
      if (payload && payload.Actors && payload.Classes) {
        return payload;
      }
    } catch {
      // Fall through to file fallback
    }

    const dataDir = this.getMzDataDir();
    try {
      const actorsRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'Actors.json'), 'utf-8')) as any[];
      const classesRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'Classes.json'), 'utf-8')) as any[];
      return {
        Actors: actorsRaw.filter((a) => a !== null),
        Classes: classesRaw.filter((c) => c !== null),
      };
    } catch {
      return { Actors: [], Classes: [] };
    }
  }

  // Validate that actorTemplateId exists in the active content's Actors array
  private async validateActorTemplateId(actorTemplateId: number, actors: any[]) {
    // Check by id property first (1-based RM ID) or array index
    let actor = actors.find((a) => a && a.id === actorTemplateId);
    if (!actor) {
      actor = actors[actorTemplateId - 1];
    }
    if (!actor) {
      throw { code: ErrorCodes.CHARACTER_ACTOR_NOT_FOUND, message: `Actor template with id ${actorTemplateId} not found` };
    }
    return actor;
  }

  // Validate that classTemplateId exists in the active content's Classes array
  private async validateClassTemplateId(classTemplateId: number, classes: any[]) {
    let cls = classes.find((c) => c && c.id === classTemplateId);
    if (!cls) {
      cls = classes[classTemplateId - 1];
    }
    if (!cls) {
      throw { code: ErrorCodes.CHARACTER_CLASS_NOT_FOUND, message: `Class template with id ${classTemplateId} not found` };
    }
    return cls;
  }

  // Snapshot base stats from actor and class
  private snapshotBaseStats(actor: any, cls: any) {
    const level = (actor.initialLevel || actor.level || 1);
    const params: number[] = [];
    if (cls.params && Array.isArray(cls.params)) {
      for (let i = 0; i < 8; i++) {
        params.push(cls.params[i]?.[level] ?? 0);
      }
    } else {
      params.push(500, 40, 20, 20, 20, 20, 20, 20); // sensible defaults
    }

    return {
      actor: {
        id: actor.id,
        name: actor.name,
        nickname: actor.nickname || '',
        profile: actor.profile || '',
        classId: actor.classId,
        characterName: actor.characterName || 'Actor1',
        characterIndex: actor.characterIndex !== undefined ? actor.characterIndex : 0,
        initialLevel: level,
        params,
      },
      class: {
        id: cls.id,
        name: cls.name,
        traits: cls.traits || [],
      },
    };
  }

  async getMzData() {
    const dataDir = this.getMzDataDir();
    const classesRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'Classes.json'), 'utf-8')) as any[];
    const actorsRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'Actors.json'), 'utf-8')) as any[];
    const mapInfosRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'MapInfos.json'), 'utf-8')) as any[];

    // Check if any class has <class: active>
    const hasActiveClassTag = classesRaw.some((c) => c && c.note && c.note.includes('<class: active>'));
    const activeClasses = classesRaw
      .filter((c) => c !== null && (!hasActiveClassTag || (c.note && c.note.includes('<class: active>'))))
      .map((c) => ({ id: c.id, name: c.name, note: c.note || '' }));

    // Check if any actor has <hero: active>
    const hasActiveHeroTag = actorsRaw.some((a) => a && a.note && a.note.includes('<hero: active>'));
    const activeActors = actorsRaw
      .filter((a) => a !== null && (!hasActiveHeroTag || (a.note && a.note.includes('<hero: active>'))))
      .map((a) => ({
        id: a.id,
        name: a.name,
        classId: a.classId,
        characterName: a.characterName,
        characterIndex: a.characterIndex,
        faceName: a.faceName || '',
        faceIndex: a.faceIndex || 0,
        profile: a.profile || '',
      }));

    const mapInfos = mapInfosRaw.filter((m) => m !== null).map((m) => ({
      id: m.id,
      name: m.name,
    }));

    return { classes: activeClasses, actors: activeActors, maps: mapInfos };
  }

  async createCharacter(userId: string, actorTemplateId: number, name: string) {
    const trimmedName = (name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      throw { code: 'INVALID_CHARACTER_NAME', message: 'O nome do personagem deve ter pelo menos 2 caracteres.' };
    }
    if (trimmedName.length > 20) {
      throw { code: 'INVALID_CHARACTER_NAME', message: 'O nome do personagem deve ter no máximo 20 caracteres.' };
    }

    // Validate user exists and check slot limits
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw { code: ErrorCodes.AUTH_TOKEN_INVALID, message: 'Usuário não encontrado' };
    }

    const currentCount = await prisma.character.count({ where: { user_id: userId } });
    const isVip = isUserVip(user);
    const maxSlots = isVip ? 6 : 4;

    if (currentCount >= maxSlots) {
      if (!isVip && currentCount >= 4) {
        throw {
          code: 'VIP_SLOT_LOCKED',
          message: 'Você atingiu o limite de 4 heróis da conta comum. Torne-se VIP para desbloquear +2 slots de criação!'
        };
      }
      throw {
        code: 'MAX_CHARACTERS_REACHED',
        message: `Você atingiu o limite máximo de ${maxSlots} heróis.`
      };
    }

    // Get active content
    const payload = await this.getActiveContent();
    const actors = payload.Actors || [];
    const classes = payload.Classes || [];

    // Validate actor template exists
    const actor = await this.validateActorTemplateId(actorTemplateId, actors);

    // Validate class template exists
    const classTemplateId = actor.classId;
    const cls = await this.validateClassTemplateId(classTemplateId, classes);

    // Check unique character name
    const existing = await prisma.character.findFirst({ where: { name: trimmedName } });
    if (existing) {
      throw { code: 'CHARACTER_NAME_TAKEN', message: 'Este nome de herói já está em uso.' };
    }

    // Snapshot base stats
    const baseStats = this.snapshotBaseStats(actor, cls);

    // Insert character
    const character = await prisma.character.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        actor_template_id: actorTemplateId,
        name: trimmedName,
        base_stats: JSON.stringify(baseStats),
      }
    });

    const parsedStats = JSON.parse(character.base_stats);
    return {
      ...character,
      actorTemplateId: character.actor_template_id,
      characterName: parsedStats?.actor?.characterName || 'Actor1',
      characterIndex: parsedStats?.actor?.characterIndex ?? 0,
      className: parsedStats?.class?.name || 'Aventureiro',
      base_stats: parsedStats,
    };
  }

  async getCharactersByUserId(userId: string) {
    const result = await prisma.character.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' },
    });

    return result.map(char => {
      const parsedStats = JSON.parse(char.base_stats);
      return {
        ...char,
        actorTemplateId: char.actor_template_id,
        characterName: parsedStats?.actor?.characterName || 'Actor1',
        characterIndex: parsedStats?.actor?.characterIndex ?? 0,
        className: parsedStats?.class?.name || 'Aventureiro',
        base_stats: parsedStats,
      };
    });
  }

  async getCharacterById(id: string, userId: string) {
    const result = await prisma.character.findFirst({ where: { id, user_id: userId } });
    if (!result) {
      throw { code: ErrorCodes.CHARACTER_NOT_FOUND, message: 'Character not found' };
    }
    const parsedStats = JSON.parse(result.base_stats);
    return {
      ...result,
      actorTemplateId: result.actor_template_id,
      characterName: parsedStats?.actor?.characterName || 'Actor1',
      characterIndex: parsedStats?.actor?.characterIndex ?? 0,
      className: parsedStats?.class?.name || 'Aventureiro',
      base_stats: parsedStats,
    };
  }

  async deleteCharacter(characterId: string, userId: string) {
    const character = await prisma.character.findFirst({ where: { id: characterId, user_id: userId } });
    if (!character) {
      throw { code: ErrorCodes.CHARACTER_NOT_FOUND, message: 'Personagem não encontrado' };
    }
    await prisma.character.delete({ where: { id: characterId } });
    return { success: true };
  }
}

