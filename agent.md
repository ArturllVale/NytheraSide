# agent.md — Regras para agentes de IA neste repositório

## Papel
Você é um engenheiro sênior implementando um **idle/MMO-lite** com:
- Cliente: RPG Maker MZ (apresentação visual, inputs e áudio)
- Servidor: Node.js + TypeScript autoritativo (Fastify, Prisma, WebSockets)
- Conteúdo: exportado de `data/*.json` do RPG Maker MZ

Leia sempre `plan.md` antes de codar. Se houver conflito entre pedido pontual e `plan.md`, **siga o plan.md** e avise.

---

## Regras de Ouro
1. **Server authoritative.** Proibido confiar em dano/drop/xp/gold vindos do cliente.
2. **Um único battle engine** para manual e auto.
3. **Content flow unidirecional:** RM MZ JSON → draft → validate → publish version.
4. **Banco de Dados:** Prisma ORM como camada de persistência. SQLite (`server/dev.db`) para desenvolvimento local rápido; PostgreSQL para ambiente produtivo.
5. **Redis:** Efêmero (presença, cache, rate limit, fila meta).
6. **Idempotency** em claim de reward, compra, offline catch-up, grant de item.
7. **NUNCA use `eval` ou `new Function`** para fórmulas do MZ. Use **isolated-vm** com timeout de 10ms e sem acesso ao sistema.
8. **Não implemente exploits, cheat clients ou bypass.** Apenas defesas e validação.
9. **Monólito modular.** Sem complexidade desnecessária de microsserviços.
10. **TypeScript strict**, Zod nas boundaries, testes automatizados no motor de combate e regras de negócio.

---

## RPG Maker MZ — Fatos que o agente deve respeitar (CRÍTICO)
- Arquivos de dados em `data/*.json`.
- Na maioria dos DB files: **array com index 0 = null**; IDs 1-based.
- Fórmulas de damage são strings estilo `a.atk * 4 - b.def * 2`.
- Configurações customizadas vivem em **notetags** no campo `note`.
- Combate vanilla: `Scene_Battle` + `BattleManager` é local/single-player. No nosso design, o plugin MZ **não** usa o BattleManager como autoridade; atua apenas como apresentação/input.
- Plugins do cliente residem em `js/plugins/` e são configurados em `js/plugins.js`.
- O cliente de desenvolvimento é iniciado via `python run_game.py` (porta 8000 com headers anti-cache).

---

## Estrutura do Projeto
```
NytheraSide/
├── server/                   # Backend Fastify + TypeScript (monólito modular)
│   ├── src/
│   │   ├── modules/          # auth, character, battle, progress, content, etc.
│   │   ├── infra/            # prisma db client, isolated-vm sandbox
│   │   └── index.ts          # ponto de entrada do servidor
│   ├── prisma/               # schemas Prisma (sqlite e postgresql)
│   ├── src/__tests__/        # testes automatizados Vitest
│   └── package.json
├── packages/
│   ├── shared/               # DTOs, interfaces e schemas Zod compartilhados
│   └── content-schema/       # Schemas e validação dos dados JSON do RPG Maker
├── tools/
│   └── content-sync/         # Watcher (chokidar) e script de sincronização de conteúdo
├── data/                     # Dados JSON gerados pelo editor RPG Maker MZ
├── js/
│   ├── plugins/              # Plugins do jogo (NET_Client, NET_Auth, NET_BattleBridge, Nythera_HUD, etc.)
│   └── plugins.js            # Registro e ativação dos plugins no RPG Maker
├── docs/                     # Documentação de arquitetura, banco, protocolo e APIs
├── run_game.py               # Servidor HTTP local e inicializador do jogo
├── plan.md                   # Roadmap arquitetural do projeto
└── agent.md                  # Este guia de regras para agentes
```
