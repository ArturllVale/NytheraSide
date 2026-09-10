# Phase 0 Checklist - Repository Foundation

## Completed
- [x] Monorepo structure with pnpm workspaces:
    - apps/server
    - apps/rmmv-client (placeholder)
    - packages/shared
    - packages/content-schema
    - tools/content-sync
- [x] Package manager: pnpm workspaces configured
- [x] TypeScript strict across all packages (via tsconfig.base.json)
- [x] apps/server: minimal Fastify with GET /health endpoint
- [x] docker-compose.yml with PostgreSQL 16 and Redis 7 (named volumes, healthchecks)
- [x] .env.example with required variables
- [x] Basic eslint + prettier + vitest skeleton (root configs, extendable per workspace)
- [x] apps/server README with folder conventions for modular monolith
- [x] packages/shared: empty package, ready for protocol types and PROTOCOL_VERSION
- [x] CI-friendly scripts: build, test, typecheck, lint (in root package.json)

## Next (Phase 1)
- [ ] Implement content pipeline (tools/content-sync) with chokidar watcher and debounce
- [ ] Set up PostgreSQL and Redis connections in apps/server/infra
- [ ] Create initial content import from RPG Maker MV JSON (draft/publish flow)
- [ ] Define shared protocol types and PROTOCOL_VERSION in packages/shared
- [ ] Add basic AuthModule (login/logout) with session tokens (Redis + PostgreSQL)
- [ ] Create PlayerModule for character creation and loading
- [ ] Begin BattleModule core (server-authoritized battle engine using isolated-vm for formulas)
- [ ] Start Plugin bridge for RPG Maker MV (apps/rmmv-client) to send intentions via WebSocket