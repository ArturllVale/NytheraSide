import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

export default {
  schema: './src/infra/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public', 'content', 'auth', 'character', 'battle', 'progress'],
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://nythera:nythera_pass@localhost:5432/nythera',
  },
} satisfies Config;

