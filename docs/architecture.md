# Architecture Overview

NytheraSide is built on an authoritative server architecture paired with an RPG Maker MZ client presentation layer.

```
+-------------------------------------------------------------+
|                     RPG Maker MZ Client                     |
|  - Presentation, Sprites, Animations, Sound, User Input     |
|  - Plugins: NET_Client, NET_Auth, NET_BattleBridge,         |
|             NET_ContentGuard, Nythera_HUD                   |
+-------------------------------------------------------------+
                              |
                 REST (HTTP)  |  WebSockets (WSS)
              /auth, /chars   |  /battle/sync
                              v
+-------------------------------------------------------------+
|                Fastify Authoritative Monolith               |
|  - Fastify 5 + @fastify/websocket 11 + TypeScript           |
|  - Modules: Auth, Character, Battle, Progress, Content      |
|  - Battle Engine: Pure deterministic TypeScript engine      |
|  - Formula Sandbox: isolated-vm sandbox (10ms timeout)      |
|  - Map & World Sync: Multi-player map state broadcaster     |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                     Persistence Layer                       |
|  - Prisma ORM                                               |
|  - Development: SQLite (server/dev.db)                      |
|  - Production: PostgreSQL                                   |
+-------------------------------------------------------------+
```

---

## 1. Architectural Principles

1. **Server Authority**: The client never calculates damage, experience, gold, item drops, or authoritative character progression. The client sends intents; the server resolves outcomes.
2. **Deterministic Battle Engine**: Manual and auto-battles share the exact same server-side simulation engine, utilizing seeded RNG and sandbox formula execution via `isolated-vm`.
3. **Unidirectional Content Flow**: Game design data (classes, enemies, skills, items) originates in the RPG Maker database (`data/*.json`), synced to the server via `tools/content-sync`.
4. **Resilient Local Development**: Designed for immediate local execution using SQLite (`dev.db`) without requiring Docker or external services.

---

## 2. Monorepo Structure

- **`server/`**: Authoritative backend (Fastify, Prisma, Zod, isolated-vm, WebSocket gateway).
- **`packages/shared/`**: Shared TypeScript DTOs, schemas, and contract interfaces.
- **`packages/content-schema/`**: Schemas, parsers, and sanitizers for RPG Maker data.
- **`tools/content-sync/`**: Sync tool and watcher for RPG Maker data updates.
- **`js/plugins/`**: Custom RPG Maker MZ networking and UI plugins.
- **`data/`**: RPG Maker MZ database files (JSON).
- **`run_game.py`**: Local HTTP server and auto-browser launcher for client playtesting.
