# Database Configuration & Operations

NytheraSide utilizes **Prisma ORM** supporting both **SQLite** (for zero-config local development) and **PostgreSQL** (for production environments).

---

## 1. Dual-Provider Architecture

Prisma determines its database provider at code-generation time. To maintain clean schemas for both environments, the server maintains two schema templates:
- `server/prisma/schema.sqlite.prisma`
- `server/prisma/schema.postgresql.prisma`

The script `server/scripts/select-prisma-schema.mjs` copies the active schema to `server/prisma/schema.prisma` depending on the targeted environment.

---

## 2. Local Development (SQLite)

SQLite is the default development database. It requires no external server or Docker container.

### Setup
```bash
cd server

# 1. Generate SQLite Prisma Client
npm run db:generate:sqlite

# 2. Push schema to local database (server/dev.db)
npm run db:migrate:sqlite

# 3. Start development server
npm run dev
```

### Database Management
- **Local file**: `server/dev.db` (auto-created on migrate/push).
- **Reset data**: `npm run db:reset:sqlite` (executed inside `server/`, forces schema push with table drop).
- **Backup**: Simply copy `server/dev.db` while the server is stopped.

---

## 3. Production Environment (PostgreSQL)

For production deployment, PostgreSQL 15+ is required.

### Setup
Configure your environment variables in `.env` (or set environment variables):
```env
DATABASE_PROVIDER="postgresql"
DATABASE_URL="postgresql://user:password@localhost:5432/nytheraside?schema=public"
```

### Deployment Commands
```bash
cd server

# 1. Generate PostgreSQL Prisma Client
DATABASE_PROVIDER=postgresql npm run db:generate:postgresql

# 2. Push schema or apply migrations
DATABASE_PROVIDER=postgresql npm run db:migrate:postgresql

# 3. Build & Run
npm run build
npm run start
```

---

## 4. Automated Tests

Backend unit and integration tests automatically use an isolated SQLite test database:
```bash
npm --prefix server test
# ou: cd server && npm test
```
Vitest executes tests using `server/test.db` with `--pool=forks` and `singleFork=true` to ensure clean transactional execution across all test suites.
