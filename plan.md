# plan.md — Idle/MMO-lite RPG (RPG Maker MV + Backend Autoritativo)

## 1. Visão do produto
Jogo online no estilo **idle RPG / MMO-lite** com:
- Frontend: **RPG Maker MV** (mapas, UI, sideview battle presentation)
- Backend: **servidor autoritativo** (Node.js + TypeScript)
- Combate: **mesmo motor no servidor** para manual e auto-battle
- Progressão offline com teto de tempo (cap: 12h)
- Conteúdo de design originado do **Database do RPG Maker MV** (`www/data/*.json`)
- Sincronização via watcher (Chokidar com debounce de 2s) + export manual + CI

Não é um MMO massivo estilo WoW. É:
- Cidades/mapas com presença limitada
- Batalhas instanciadas no servidor
- Guildas, chat, ranking, mercado, eventos
- Farm idle + intervenção manual opcional (vantajosa, ~20% mais eficiente)

## 2. Princípios não negociáveis
1. Cliente **nunca** decide dano, drop, XP, ouro, craft, compra, cooldown real.
2. Cliente envia **intenções/comandos**; servidor valida e responde **eventos**.
3. Manual e auto-battle usam o **mesmo battle engine**.
4. Conteúdo estático (skills, items, enemies…) flui **RPG Maker → Backend** (unidirecional).
5. Economia e inventário: **PostgreSQL transacional** + ledger imutável para moedas e itens críticos.
6. Redis só para sessão, presença, cache, rate limit, filas leves — nunca fonte de verdade de itens/ouro.
7. Toda recompensa/compra usa **idempotency key**.
8. Conteúdo versionado (content_version); batalhas em andamento referenciam a versão ativa no início.
9. Fórmulas do MV (ex: `a.atk * 4 - b.def * 2`) rodam em **sandbox segura (isolated-vm)** – NUNCA usar `eval` puro.

## 3. Arquitetura alvo
[RPG Maker MV Client]
   | HTTPS (REST): auth, inventário, mercado, missões, sync offline
   | WSS: chat, presença, batalha, notificações
   v
[API Gateway / App monólito modular Node+TS]
   |-- AuthModule
   |-- PlayerModule
   |-- InventoryModule
   |-- BattleModule          << motor único manual/auto
   |-- ProgressionModule     << idle offline catch-up
   |-- EconomyModule
   |-- SocialModule
   |-- WorldModule           << mapas/canais
   |-- ContentModule         << import RM MV JSON
   |-- Admin/LiveOpsModule
   |
   |-- PostgreSQL (source of truth)
   |-- Redis (ephemeral)
   |-- Queue + Workers (offline progress, mail, rankings rebuild)

### Content pipeline
RPG Maker Editor salva www/data/*.json
        |
   [tools/content-sync]  (Chokidar watch COM DEBOUNCE DE 2000ms OU npm run sync-content)
        |
   POST /admin/content/import  (draft)
        |
   validate + parse notetags + sandbox formulas
        |
   approve → publish content_version N
        |
   runtime carrega snapshot versionado

Arquivos RM MV prioritários na V1:
- Actors.json, Classes.json, Skills.json, Items.json
- Weapons.json, Armors.json, Enemies.json, Troops.json
- States.json, System.json (elements, types, terms parciais)

## 4. Stack recomendada (V1)
- Runtime: Node.js 20+ LTS, TypeScript
- HTTP: Fastify (ou NestJS se preferir DI rígido)
- WS: ws (avaliar Colyseus se salas crescerem)
- DB: PostgreSQL 16
- Cache/fila: Redis 7
- ORM/query: Drizzle (controle SQL explícito) ou Prisma
- Validação: Zod
- Auth: session tokens opacos (Redis + PG)
- Password: Argon2id
- Sandbox fórmulas: **isolated-vm**
- Watcher dev: **chokidar** com `awaitWriteFinish` + **debounce de 2000ms** (crítico: MV salva múltiplos JSONs)
- Monorepo: `apps/server`, `apps/client-plugin`, `packages/shared`, `tools/content-sync`
- Observability: pino logs, Sentry, métricas básicas

## 5. Modelo de batalha
### Servidor
- `BattleInstance` com id, content_version, seed RNG, participants, phase, timeline
- Comandos: `SELECT_ACTION`, `SET_AUTO_STRATEGY`, `FLEE`, `USE_ITEM`…
- Resolução gera `BattleEvent[]` (damage, death, buff, drop pending…)
- Drops/XP aplicados em transação ao fim (ou em checkpoints seguros)
- Auto: AI strategy escolhe action; mesma validação do manual

### Cliente MV
- Plugin de rede
- `Scene_Battle` (ou cena custom) **apenas apresentação**
- Recebe eventos e anima sideview; input manual vira comando WS
- Não usa BattleManager vanilla como autoridade de dano

## 6. Idle / offline
Ao desconectar, persistir:
- last_synced_at, party loadout, stage/route, auto strategy, stamina/energy, content_version

Ao reconectar:
- worker/API calcula elapsed (cap **12h**)
- simulação em lote determinística (seed + version) usando o mesmo motor da Fase 3
- aplica recompensas com idempotency (`offline_claim:{playerId}:{windowId}`)

## 7. Economia e anti-cheat (mínimo)
- Servidor autoritativo em tudo econômico
- Ledger de moedas (append-only)
- Rate limit por conta/IP
- Sequence numbers em battle commands
- Detecção de progresso impossível
- Admin audit log
- Mercado em transação única (FOR UPDATE nas rows)

## 8. Fases de entrega
- [x] **Fase 0 — Fundações**: Configuração do monorepo, Fastify 5, TypeScript strict, Prisma ORM e Vitest.
- [x] **Fase 1 — Content pipeline**: Normalizadores de JSON do RPG Maker, isolated-vm para fórmulas e auto-seed ativo.
- [x] **Fase 2 — Auth + Personagem**: Registro/login Argon2, criação e seleção de personagens (3 etapas) e persistência.
- [x] **Fase 3 — Battle engine core**: Motor autoritativo puro em TypeScript, comandos Zod, eventos e auto-battle.
- [x] **Fase 4 — Bridge cliente MZ (plugins)**: `NET_Auth`, `NET_Client`, `NET_BattleBridge`, `Nythera_HUD` e sincronização multiplayer de mapas via WebSocket.
- [ ] **Fase 5 — Idle progression**: Offline progress catch-up com cap de 12h e simulação determinística.
- [ ] **Fase 6 — Economia**: Inventário, mercado, trading e ledger transacional.
- [x] **Fase 7 — Social lite + World lite**: Chat global/canal implementado; pendente guildas e instanciamento de mapas.
- [ ] **Fase 8 — LiveOps + Admin**: Painel administrativo, auditoria e controle de eventos.
- [ ] **Fase 9 — Hardening**: Segurança reforçada, testes de carga e empacotamento.

## 9. Equilíbrio manual vs auto (design)
- Auto: bom no farm
- Manual: +20% eficiência (tunable) e necessário em bosses/desafios
- Nunca deixar auto “perfeito” nem inútil

## 10. Fora de escopo na V1
- Mundo aberto massivo sincronizado 60Hz
- Centenas de players no mesmo mapa com physics
- Microserviços desde o dia 1

## 11. Definição de pronto (MVP jogável)
- [x] Login + Gestão de personagens
- [x] Conteúdo importado do RPG Maker e versionado
- [x] Farm com auto-battle no server
- [x] Opção de lutar manualmente com o mesmo motor
- [ ] Inventário/equip persistente
- [ ] Offline progress com cap (12h)
- [x] Plugins MZ estáveis no playtest

## Atualização de Arquitetura
O projeto utiliza **Prisma ORM** com suporte duplo:
- **SQLite local (`dev.db`)** como caminho padrão para desenvolvimento ágil e sem necessidade de Docker/dependências externas.
- **PostgreSQL** para ambiente de produção, com schemas específicos alternáveis via scripts (`scripts/select-prisma-schema.mjs`).