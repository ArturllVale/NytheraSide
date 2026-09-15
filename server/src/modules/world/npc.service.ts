import { prisma } from '../../infra/prisma';
import { EconomyService } from '../progress/economy.service';

export class EventService {
  private economy = new EconomyService();

  public async syncEvent(characterId: string, mapId: number, eventId: number, choices: number[]): Promise<void> {
    const activeVersion = await prisma.contentActive.findFirst({ include: { version: true } });
    if (!activeVersion?.version) return;

    const content = JSON.parse(activeVersion.version.payload);
    const mapName = `Map${String(mapId).padStart(3, '0')}`;
    const mapData = content[mapName];

    if (!mapData || !mapData.events) {
      console.warn(`[EventService] Map ${mapId} not found or has no events.`);
      return;
    }

    const event = mapData.events[eventId];
    if (!event || !event.pages || event.pages.length === 0) {
      console.warn(`[EventService] Event ${eventId} on Map ${mapId} not found.`);
      return;
    }

    // For simplicity, we assume page 0. A robust system would check page conditions.
    const list = event.pages[0].list;
    await this.replayEvent(characterId, list, choices, `${activeVersion.version.version}_${mapId}_${eventId}`);
  }

  private async replayEvent(characterId: string, list: any[], choices: number[], idempotencyPrefix: string) {
    let choiceIndex = 0;
    let skipDepth = 0;
    
    // Aggregated rewards to apply in a single transaction
    let goldChange = 0;
    const itemsGained: any[] = [];

    for (let i = 0; i < list.length; i++) {
      const cmd = list[i];
      
      // If we are skipping (because we took a different branch)
      if (skipDepth > 0) {
        if (cmd.code === 0) {
          // Branch end might not be 0, RM uses indent for branching.
          // RM MZ uses indent levels!
        }
      }

      // Instead of complex branching logic with skipDepth, we can just use the `indent` field 
      // provided by RM MZ. We only process commands whose indent matches our current active indent.
      // But actually, simple state machine:
      // When we hit 402 (When [Choice X]):
      //   Check if cmd.parameters[0] === choices[choiceIndex].
      //   If yes, we enter this branch.
      //   If no, we ignore until we hit the next 402 or 404 (End of Choices).
    }

    // ACTUALLY, a simpler way without full indent parsing: 
    // We can just filter the command list to the executed path!
    const executedPath = this.extractExecutedPath(list, choices);

    for (const cmd of executedPath) {
      switch (cmd.code) {
        case 125: { // Change Gold
          const operation = cmd.parameters[0]; // 0: Increase, 1: Decrease
          const operandType = cmd.parameters[1]; // 0: Constant
          const value = cmd.parameters[2];
          if (operandType === 0) {
            goldChange += (operation === 0 ? value : -value);
          }
          break;
        }
        case 126: { // Change Item
          const itemId = cmd.parameters[0];
          const operation = cmd.parameters[1];
          const operandType = cmd.parameters[2];
          const value = cmd.parameters[3];
          if (operandType === 0 && operation === 0) {
            itemsGained.push({ kind: 1, dataId: itemId, amount: value });
          }
          break;
        }
        case 127: { // Change Weapon
          const weaponId = cmd.parameters[0];
          const operation = cmd.parameters[1];
          const operandType = cmd.parameters[2];
          const value = cmd.parameters[3];
          if (operandType === 0 && operation === 0) {
            itemsGained.push({ kind: 2, dataId: weaponId, amount: value });
          }
          break;
        }
        case 128: { // Change Armor
          const armorId = cmd.parameters[0];
          const operation = cmd.parameters[1];
          const operandType = cmd.parameters[2];
          const value = cmd.parameters[3];
          if (operandType === 0 && operation === 0) {
            itemsGained.push({ kind: 3, dataId: armorId, amount: value });
          }
          break;
        }
      }
    }

    if (goldChange !== 0 || itemsGained.length > 0) {
      const idempotencyKey = `evt_${idempotencyPrefix}_${Date.now()}`;
      await this.economy.grantRewardsIdempotent(characterId, idempotencyKey, {
        xp: 0,
        gold: goldChange,
        drops: itemsGained
      });
      console.log(`[EventService] Applied rewards for ${characterId}: Gold ${goldChange}, Items ${itemsGained.length}`);
    }
  }

  private extractExecutedPath(list: any[], choices: number[]): any[] {
    const path: any[] = [];
    let choicePointer = 0;
    
    let ignoreIndentDepth = -1;

    for (let i = 0; i < list.length; i++) {
      const cmd = list[i];

      if (ignoreIndentDepth !== -1) {
        if (cmd.indent <= ignoreIndentDepth) {
          // Exited the ignored block
          ignoreIndentDepth = -1;
        } else {
          continue; // Still inside ignored block
        }
      }

      if (cmd.code === 102) {
        // Show Choices setup, does not execute anything but we consume a choice
        // The actual branching starts at 402
        continue;
      }

      if (cmd.code === 402) {
        // When [Choice X]
        const branchChoice = cmd.parameters[0];
        const userChoice = choices[choicePointer] !== undefined ? choices[choicePointer] : -1;
        
        if (branchChoice === userChoice) {
          // We took this branch! Move the pointer.
          choicePointer++;
        } else {
          // We did not take this branch. Ignore everything inside it.
          ignoreIndentDepth = cmd.indent;
        }
        continue;
      }

      if (cmd.code === 404) {
        // End of choices
        continue;
      }

      path.push(cmd);
    }

    return path;
  }
}
