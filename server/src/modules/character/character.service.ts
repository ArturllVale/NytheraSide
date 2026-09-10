import { randomUUID } from 'crypto';
import { ContentService } from '../content/content.service';
import { ErrorCodes } from '@nythera/shared';
import { prisma } from '../../infra/prisma';

export class CharacterService {
  private contentService: ContentService;

  constructor() {
    this.contentService = new ContentService();
  }

  // Helper to get active content payload
  private async getActiveContent() {
    const { payload } = await this.contentService.getActiveContent();
    return payload;
  }

  // Validate that actorTemplateId exists in the active content's Actors array
  private async validateActorTemplateId(actorTemplateId: number, actors: any[]) {
    // Actors array is 1-based, with index 0 being null in the raw RM data.
    // But our normalizer filters out nulls, so the array index is actorTemplateId - 1.
    const actor = actors[actorTemplateId - 1];
    if (!actor) {
      throw { code: ErrorCodes.CHARACTER_ACTOR_NOT_FOUND, message: `Actor template with id ${actorTemplateId} not found` };
    }
    return actor;
  }

  // Validate that classTemplateId exists in the active content's Classes array
  private async validateClassTemplateId(classTemplateId: number, classes: any[]) {
    const cls = classes[classTemplateId - 1];
    if (!cls) {
      throw { code: ErrorCodes.CHARACTER_CLASS_NOT_FOUND, message: `Class template with id ${classTemplateId} not found` };
    }
    return cls;
  }

  // Snapshot base stats from actor and class
  private snapshotBaseStats(actor: any, cls: any) {
    // Snapshot the stats needed for battle from actor and class data.
    // In RPG Maker MV, the Class holds the param curves (params[paramId][level]).
    // We compute level-1 stats from the class's params array.
    // cls.params is a 2D array: cls.params[paramId][level] = base value at that level.
    // paramId: 0=HP, 1=MP, 2=ATK, 3=DEF, 4=MAT, 5=MDF, 6=AGI, 7=LUK
    const level = (actor.initialLevel || actor.level || 1);
    const params: number[] = [];
    if (cls.params && Array.isArray(cls.params)) {
      for (let i = 0; i < 8; i++) {
        params.push(cls.params[i]?.[level] ?? 0);
      }
    } else {
      // Fallback if cls.params is unavailable
      params.push(500, 40, 20, 20, 20, 20, 20, 20); // sensible defaults
    }

    return {
      actor: {
        id: actor.id,
        name: actor.name,
        nickname: actor.nickname || '',
        profile: actor.profile || '',
        classId: actor.classId,
        initialLevel: level,
        // params[0..7] at snapshot level — used directly by BattleService
        params,
      },
      class: {
        id: cls.id,
        name: cls.name,
        traits: cls.traits || [],
      },
    };
  }

  async createCharacter(userId: string, actorTemplateId: number, name: string) {
    // Get active content
    const payload = await this.getActiveContent() as any;
    const actors = payload.Actors || [];
    const classes = payload.Classes || [];

    // Validate actor template exists
    const actor = await this.validateActorTemplateId(actorTemplateId, actors);

    // We need to get the class of the actor to snapshot class stats as well.
    // In RM MV, actor has a classId that points to the Classes array.
    const classTemplateId = actor.classId;
    // Validate class template exists
    const cls = await this.validateClassTemplateId(classTemplateId, classes);

    // Snapshot base stats
    const baseStats = this.snapshotBaseStats(actor, cls);

    // Insert character
    const character = await prisma.character.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        actor_template_id: actorTemplateId,
        name,
        base_stats: JSON.stringify(baseStats), // We'll store as JSON string in jsonb column
      }
    });

    // We'll parse the base_stats back to object for return
    return {
      ...character,
      base_stats: JSON.parse(character.base_stats),
    };
  }

  async getCharactersByUserId(userId: string) {
    const result = await prisma.character.findMany({ where: { user_id: userId } });
    return result.map(char => ({
      ...char,
      base_stats: JSON.parse(char.base_stats),
    }));
  }

  async getCharacterById(id: string, userId: string) {
    const result = await prisma.character.findFirst({ where: { id, user_id: userId } });
    if (!result) {
      throw { code: ErrorCodes.CHARACTER_NOT_FOUND, message: 'Character not found' };
    }
    return {
      ...result,
      base_stats: JSON.parse(result.base_stats),
    };
  }
}
