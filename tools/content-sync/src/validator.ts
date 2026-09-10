import { readFileSync } from 'fs';
import { normalizeContent } from '@nythera/content-schema';
import path from 'path';

export async function validateLocal() {
  const contentDataPath = process.env.CONTENT_DATA_PATH || './www/data';
  const files = [
    'Actors.json',
    'Classes.json',
    'Skills.json',
    'Items.json',
    'Weapons.json',
    'Armors.json',
    'Enemies.json',
    'Troops.json',
    'States.json',
    'System.json',
  ];

  for (const file of files) {
    const filePath = path.join(contentDataPath, file);
    try {
      const raw = readFileSync(filePath, 'utf8');
      const json = JSON.parse(raw);
      const normalized = normalizeContent(file, json);
      console.log(`✓ ${file}: ${Array.isArray(normalized) ? normalized.length : 1} records`);
    } catch (error) {
      console.error(`✗ ${file}:`, error);
      throw error;
    }
  }

  console.log('All files validated successfully.');
}
