import axios from 'axios';
import { readFileSync } from 'fs';
import { normalizeContent } from '@nythera/content-schema';
import path from 'path';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

export async function importOnce() {
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

  const payload: Record<string, any> = {};

  for (const file of files) {
    const filePath = path.join(contentDataPath, file);
    try {
      const raw = readFileSync(filePath, 'utf8');
      const json = JSON.parse(raw);
      const normalized = normalizeContent(file, json);
      payload[file.replace('.json', '')] = normalized;
    } catch (error) {
      console.error(`Error reading or normalizing ${file}:`, error);
      throw error;
    }
  }

  try {
    const response = await axios.post(`${SERVER_URL}/admin/content/import`, payload, {
      headers: {
        'x-admin-key': ADMIN_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    console.log('Import successful:', response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios error:', error.response?.data || error.message);
    } else {
      console.error('Error:', error);
    }
    throw error;
  }
}

export async function importContent(filePaths: string[]) {
  const payload: Record<string, any> = {};

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    try {
      const raw = readFileSync(filePath, 'utf8');
      const json = JSON.parse(raw);
      const normalized = normalizeContent(fileName, json);
      payload[fileName.replace('.json', '')] = normalized;
    } catch (error) {
      console.error(`Error reading or normalizing ${fileName}:`, error);
      throw error;
    }
  }

  try {
    const response = await axios.post(`${SERVER_URL}/admin/content/import`, payload, {
      headers: {
        'x-admin-key': ADMIN_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    console.log('Import successful:', response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios error:', error.response?.data || error.message);
    } else {
      console.error('Error:', error);
    }
    throw error;
  }
}
