# agent.md — Regras para agentes de IA neste repositório

## Papel
Você é um engenheiro sênior implementando um **idle/MMO-lite** com:
- Cliente: RPG Maker MV (apresentação)
- Servidor: Node.js + TypeScript autoritativo
- Conteúdo: exportado de `data/*.json` do RPG Maker MV

Leia sempre `plan.md` antes de codar. Se houver conflito entre pedido pontual e `plan.md`, **siga o plan.md** e avise.

## Regras de ouro
1. **Server authoritative.** Proibido confiar em dano/drop/xp/gold vindos do cliente.
2. **Um único battle engine** para manual e auto.
3. **Content flow unidirecional:** RM MV JSON → draft → validate → publish version.
4. **PostgreSQL = source of truth** para persistência de jogador/economia.
5. **Redis = efêmero** (session, presence, cache, rate limit, queue meta).
6. **Idempotency** em claim de reward, compra, offline catch-up, grant de item.
7. **NUNCA use `eval` ou `new Function`** para fórmulas do MV. Use **isolated-vm** com timeout e sem acesso ao sistema.
8. **Não implemente exploits, cheat clients ou bypass.** Apenas defesas e validação.
9. Prefira **monólito modular** na V1. Sem Kubernetes/microserviços cedo.
10. Código **TypeScript strict**, Zod nas boundaries, testes no motor de batalha e economia.

## RPG Maker MV — fatos que o agente deve respeitar (CRÍTICO)
- Arquivos em `www/data/*.json` (ou `data/` no projeto).
- Na maioria dos DB files: **array com index 0 = null**; IDs 1-based.
- Fórmulas de damage são strings estilo `a.atk * 4 - b.def * 2`.
- Muita config custom vive em **notetags** no campo `note`.
- Combate vanilla: `Scene_Battle` + `BattleManager` é local/single-player.
- No nosso design, o plugin MV **não** usa o BattleManager como autoridade; só UI/animação/input.

## Content sync
- Tool: `tools/content-sync`
- Dev watch: **chokidar** com:
  - `awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 }`
  - **debounce extra de 2000ms** (essencial: MV salva vários JSONs de uma vez)
  - ignore files temporários
- Também: `npm run sync-content` (one-shot) e modo CI `--ci --validate-only` / `--publish`
- Import cria **draft**; publish é passo explícito.
- Nunca sobrescrever content publicado sem nova versão.

## Estrutura de pastas sugerida
NytheraSide/
├─ apps/
│  ├─ server/                 # backend Node+TS (monolito modular)
│  │  ├─ src/
│  │  │  ├─ modules/          # Auth, Player, Inventory, Battle, Progression, Economy, Social, World, Content, Admin
│  │  │  ├─ lib/              # utilitários, sandbox, websocket wrapper, etc.
│  │  │  └─ index.ts          # entrypoint
│  │  ├─ tests/
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  └─ client-plugin/          # plugin RPG Maker MV (js)
│     ├─ js/
│     │  ├─ plugins/
│     │  │  └─ NytheraNetwork.js
│     │  └─ lib/
│     │     └─ utils.js
│     └─ package.json
├─ packages/
│  └─ shared/                 # tipos e interfaces compartilhadas (TS)
│     ├─ src/
│     │  ├─ types/
│     │  ├─ zod/
│     │  └─ constants.ts
│     ├─ tsconfig.json
│     └─ package.json
├─ tools/
│  └─ content-sync/           # watcher + import script
│     ├─ src/
│     │  ├─ watcher.ts
│     │  ├─ importer.ts
│     │  └─ validator.ts
│     ├─ tsconfig.json
│     ├─ package.json
│     └─ README.md
├─ www/                       # pasta exportada do RPG Maker MV (para referência)
│  └─ data/
│     ├─ Actors.json
│     ├─ Classes.json
│     ├─ Skills.json
│     ├─ Items.json
│     ├─ Weapons.json
│     ├─ Armors.json
│     ├─ Enemies.json
│     ├─ Troops.json
│     ├─ States.json
│     └─ System.json
├─ data/                      # cópia de trabalho para desenvolvimento (opcional)
│  └─ *.json
├─ prisma/                    # ou drizzle schema
│  └─ schema.prisma
├─ .gitignore
├─ README.md
├─ plan.md
└─ agent.md
## 2026-09-10 operational baseline
- SQLite + Prisma is the default local development/test path; PostgreSQL + Prisma is the production path.
- Select the Prisma provider before generating the client. Do not assume migrations are portable between providers.
- Redis is not persistent storage and is optional locally unless a feature explicitly declares it required.
- Do not claim CCU capacity without a PostgreSQL production-like benchmark.
