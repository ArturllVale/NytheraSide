import 'dotenv/config';

export type DatabaseProvider = 'sqlite' | 'postgresql';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function boolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  return value === undefined ? defaultValue : value === 'true';
}

export function loadConfig() {
  const databaseProvider = (process.env.DATABASE_PROVIDER ?? 'sqlite') as DatabaseProvider;
  if (databaseProvider !== 'sqlite' && databaseProvider !== 'postgresql') {
    throw new Error('DATABASE_PROVIDER must be sqlite or postgresql');
  }
  const databaseUrl = required('DATABASE_URL');
  if (databaseProvider === 'sqlite' && !databaseUrl.startsWith('file:')) {
    throw new Error('SQLite DATABASE_URL must start with file:');
  }
  if (databaseProvider === 'postgresql' && !databaseUrl.startsWith('postgres')) {
    throw new Error('PostgreSQL DATABASE_URL must start with postgresql: or postgres:');
  }
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const redisEnabled = boolean('REDIS_ENABLED', nodeEnv === 'production');
  if (redisEnabled && !process.env.REDIS_URL) throw new Error('REDIS_URL is required when REDIS_ENABLED=true');
  return {
    nodeEnv,
    host: process.env.HOST ?? '0.0.0.0',
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    databaseProvider,
    databaseUrl,
    redisEnabled,
    redisRequired: boolean('REDIS_REQUIRED', false),
    redisUrl: process.env.REDIS_URL,
    adminApiKey: process.env.ADMIN_API_KEY,
  };
}
export type AppConfig = ReturnType<typeof loadConfig>;
