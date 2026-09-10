import { copyFileSync } from 'node:fs';
const provider = process.env.DATABASE_PROVIDER ?? 'sqlite';
if (!['sqlite', 'postgresql'].includes(provider)) throw new Error('DATABASE_PROVIDER must be sqlite or postgresql');
copyFileSync(`prisma/schema.${provider}.prisma`, 'prisma/schema.prisma');
console.log(`Selected Prisma ${provider} schema.`);
