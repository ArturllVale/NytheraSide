import { z } from 'zod';
import { BaseRMObject, RmArray } from '../schemas/common';
import { System } from '../schemas/system';
import { Actors } from '../schemas/actors';
import { Classes } from '../schemas/classes';
import { Skills } from '../schemas/skills';
import { Items } from '../schemas/items';
import { Weapons } from '../schemas/weapons';
import { Armors } from '../schemas/armors';
import { Enemies } from '../schemas/enemies';
import { Troops } from '../schemas/troops';
import { States } from '../schemas/states';


// We'll create a normalizer for each file type.
// The normalizer will:
// 1. Parse the JSON with the zod schema (which will filter out nulls and validate the structure?)
//    Actually, our schemas are arrays of nullable objects. Zod will parse and then we can filter out nulls.
// 2. Extract notetags from the `note` field and add a `notetags` field.
// 3. For now, we'll keep the original RM ids (they are 1-based, and we removed the null at index 0).
// 4. We'll also convert the note field to a notetags map and remove the note field? Or keep both?
//    Let's keep both for now, but we can remove the note field if we want to save space.
//    We'll keep the note field for reference and add a notetags field.

// Notetag parser: extract tags like <key>, <key:value>, <key: a, b>
// We'll support:
//   <key> -> { key: true }
//   <key:value> <key:value> -> { key: value }
//   <key: a, b> -> { key: ['a', 'b'] }
//   Also, we can have multiple tags in one note: <key1> <key2:value>
//   We'll split by spaces? But note that the value might contain spaces.
//   We'll use a simple regex to match <...> and then parse the content.

export interface NotetagMap {
  [key: string]: string | string[] | boolean;
}

export function parseNotetags(note: string): NotetagMap {
  const map: NotetagMap = {};
  // Regex to match <...> non-greedy
  const regex = /<([^>]+)>/g;
  let match;
  while ((match = regex.exec(note)) !== null) {
    const content = match[1];
    // Split by colon, but only the first colon because the value might contain colons.
    const parts = content.split(':');
    const key = parts[0].trim();
    if (parts.length === 1) {
      // <key>
      map[key] = true;
    } else {
      const value = parts.slice(1).join(':').trim();
      // Check if the value is a comma-separated list (without spaces? We'll split by comma and trim)
      if (value.includes(',')) {
        const arrayValue = value.split(',').map(v => v.trim()).filter(v => v.length > 0);
        map[key] = arrayValue;
      } else {
        map[key] = value;
      }
    }
  }
  return map;
}

// We'll create a generic normalizer for array-based files.
export function normalizeArrayFile<T extends z.ZodTypeAny>(schema: z.ZodArray<z.ZodNullable<T>>, data: unknown) {
  // Parse the data with the schema (this will throw if invalid)
  const parsed = schema.parse(data);
  // Filter out nulls
  const filtered = parsed.filter((item: any): item is z.infer<T> => item !== null);
  // For each item, parse notetags and add a notetags field
  const withNotetags = filtered.map((item: any) => ({
    ...item,
    notetags: parseNotetags(item.note || ''),
  }));
  return withNotetags;
}

// For System.json, it's a single object.
export function normalizeSystem(data: unknown) {
  const parsed = System.parse(data);
  // System.json doesn't have a note field? Actually, it might not. But we can still check.
  // We'll just return the parsed object and add a notetags field if there's a note.
  // However, System.json in RM MV doesn't have a note field. We'll skip.
  // But to be consistent, we'll check if there's a note and parse it.
  if (typeof parsed === 'object' && parsed !== null && 'note' in parsed && typeof parsed.note === 'string') {
    return {
      ...parsed,
      notetags: parseNotetags(parsed.note),
    };
  }
  return parsed;
}

// We'll export a function that takes the filename and the data and returns the normalized data.
export function normalizeContent(filename: string, data: unknown) {
  switch (filename) {
    case 'Actors.json':
      return normalizeArrayFile(Actors, data);
    case 'Classes.json':
      return normalizeArrayFile(Classes, data);
    case 'Skills.json':
      return normalizeArrayFile(Skills, data);
    case 'Items.json':
      return normalizeArrayFile(Items, data);
    case 'Weapons.json':
      return normalizeArrayFile(Weapons, data);
    case 'Armors.json':
      return normalizeArrayFile(Armors, data);
    case 'Enemies.json':
      return normalizeArrayFile(Enemies, data);
    case 'Troops.json':
      return normalizeArrayFile(Troops, data);
    case 'States.json':
      return normalizeArrayFile(States, data);
    case 'System.json':
      return normalizeSystem(data);
    default:
      throw new Error(`Unknown file: ${filename}`);
  }
}
