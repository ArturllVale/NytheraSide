# NytheraSide

Um RPG Idle/MMO-lite com cliente no **RPG Maker MV** e servidor autoritário em **Node.js/Fastify**. O cliente roda apenas animações visuais, toda a lógica de batalha e progresso é gerenciada no backend.

## Pré-requisitos
- Node.js 20+
- RPG Maker MV/MZ-compatible project runtime for the first client test (not validated in this environment)

SQLite is the default development database. PostgreSQL and Redis are **not** required to boot locally.

## 🚀 Backend local (SQLite)

```bash
npm install
cp .env.development.example .env
npm run db:generate:sqlite --workspace=server
npm run db:migrate:sqlite --workspace=server
npm run dev --workspace=server
```

The API listens on `http://localhost:3000`; check `GET /health` and `GET /ready`.

For the first RPG Maker test, import and publish content with the configured admin key, register/login through the REST API, then use the emitted session token in the current `NET_Auth` prompt. The client integration has **not** been executed end-to-end yet.

Production PostgreSQL setup, migration caveats and all current limitations are documented in `docs/`.

## 🎮 Como Configurar o Cliente (RPG Maker MV)

1. Os plugins de rede estão em `js/plugins`.
2. Para que o jogo funcione, adicione os plugins na lista do Gerenciador de Plugins (Plugin Manager) do RPG Maker MV na seguinte **ordem exata**:
   - `NET_Client`
   - `NET_Auth`
   - `NET_BattleBridge`
   - `NET_ContentGuard`
3. O servidor precisa estar rodando. Ao iniciar o jogo localmente, o `NET_Auth` vai pedir seu Token de Sessão (que pode ser obtido enviando um POST para `/auth/login` no backend).

---

## 🛠️ Estrutura do Monorepo

- `server`: Servidor autoritário (Fastify, Prisma, Zod, isolated-vm, WebSockets).
- repository root (RPG Maker project): O cliente jogo (arquivos do RPG Maker MV + plugins de rede customizados).
- `packages/shared`: DTOs (Data Transfer Objects) e Tipos compartilhados.
- `packages/content-schema`: Normalizadores e Validadores dos arquivos de dados (JSON) do RPG Maker.

## 🧪 Testes

Testar todos os pacotes:
```bash
npm run test --workspaces
```

Testar apenas a engine de batalha em isolamento:
```bash
npm run test --workspace=apps/server
```
