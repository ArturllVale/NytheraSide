import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient(): PrismaClient {
  const provider = process.env.DATABASE_PROVIDER ?? 'sqlite';
  const url = process.env.DATABASE_URL ?? 'file:./test.db';

  if (provider === 'sqlite' || url.startsWith('file:')) {
    const adapter = new PrismaBetterSqlite3({ url });
    return new PrismaClient({ adapter });
  } else {
    const adapter = new PrismaPg(url);
    return new PrismaClient({ adapter });
  }
}

export const prisma = createPrismaClient();
