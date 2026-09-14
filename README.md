# 🗡️ NytheraSide

> **MMO-lite / Idle RPG** moderno com apresentação visual clássica no **RPG Maker MZ** e backend de alta performance **Server-Authoritative** em **Node.js (Fastify 5 + TypeScript + Prisma + WebSockets)**.

O cliente é responsável unicamente pela renderização de sprites, animações, mapas, efeitos sonoros e envio de intenções de input. Toda a lógica de combate, status, progressão, movimentação e economia é estritamente validada e executada no servidor.

---

## 📑 Sumário

- [Visão Geral e Arquitetura](#-visão-geral-e-arquitetura)
- [Funcionalidades do Jogo](#-funcionalidades-do-jogo)
- [Sistema de Encontros por Região (Region Control)](#-sistema-de-encontros-por-região-region-control)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [Início Rápido para Desenvolvedores](#-início-rápido-para-desenvolvedores)
- [Protocolo de Comunicação WebSocket](#-protocolo-de-comunicação-websocket)
- [Pipeline de Dados e Conteúdo](#-pipeline-de-dados-e-conteúdo)
- [Testes Automatizados](#-testes-automatizados)
- [Regras de Ouro do Projeto](#-regras-de-ouro-do-projeto)
- [Documentação Detalhada](#-documentação-detalhada)

---

## 🏛️ Visão Geral e Arquitetura

O NytheraSide adota um modelo híbrido voltado a jogos online persistentes:

```text
[ Cliente RPG Maker MZ ] 
   │   (Apresentação gráfica, input do usuário, Web Worker 60 FPS)
   │
   ├── WebSocket (/sync) ──► [ Fastify Gateway ]
   │                              │
   │                              ├── Auth & Session Module
   │                              ├── Map & Movement Bridge (20 ticks/s)
   │                              ├── Server Battle Engine (Manual & Auto)
   │                              └── Offline & Progression Module
   │
   └── HTTP REST ──────────► [ Prisma ORM ] ──► SQLite (dev) / PostgreSQL (prod)
```

- **Cliente Burro, Servidor Inteligente**: O cliente nunca decide quanto de dano foi causado, que monstro apareceu, que itens caíram ou quanta experiência foi ganha.
- **Engine de Combate Unificada**: O mesmo motor determinístico no servidor roda tanto o combate manual (comando a comando por turnos) quanto o auto-battle / farm offline.
- **Isolamento de Fórmulas**: Fórmulas de dano herdadas do RPG Maker MZ rodam em sandbox segura com timeout estrito.

---

## ✨ Funcionalidades do Jogo

### 1. Interface e Identidade Visual (Dark Glassmorphism)
- **Design System Exclusivo (`NET_Auth.js`)**: Modais em vidro escuro translúcido com acabamento em acentos dourados e brilhos de foco.
- **Login e Registro In-Game**: Autenticação em tempo real integrada à tela de título customizada do jogo.
- **Criação de Heróis em 3 Etapas**:
  1. *Seleção de Vocação/Classe*: Cards interativos com descrições e ícones estilizados.
  2. *Customização de Visual*: Canvas interativo com iluminação e rotação 360° em 4 direções (`↻`).
  3. *Nome e Confirmação*: Validação de caracteres e verificação de duplicidade no banco.
- **Seleção de Personagens**:
  - Até 4 slots de heróis por conta.
  - Painel com resumo detalhado (nível, atributos base, classe, mapa atual).
  - Ações para entrar diretamente no mapa ou excluir herói com modal de confirmação.

### 2. HUD MMORPG Integrada (`Nythera_HUD.js`)
- Barras em pixel-style com vida (HP), mana (MP) e progresso de experiência (EXP).
- Indicador de classe, avatar, nível e nome do herói.
- Painel de coordenadas e minimapa de apoio.

### 3. Sincronização de Mapa Multiplayer (`NET_MapBridge.js`)
- **Presença em Tempo Real**: Renderização de outros jogadores online no mapa com seus respectivos nomes e direções.
- **Followers e Companions**: Suporte nativo a seguidores/mascotes seguindo o jogador de forma sincronizada.
- **Execução em Segundo Plano**: Web Worker dedicado garantindo estabilidade de 60 FPS mesmo quando a janela ou aba do navegador for minimizada.
- **Bloqueio de Clique no Chão**: O jogador navega pelas teclas direcionais/WASD, evitando comportamentos indesejados de pathfinding por mouse.

### 4. Sistema de Combate Autoritativo (`NET_BattleBridge.js`)
- Interceptação de `BattleManager` do RPG Maker MZ para apresentação visual.
- Envio de comandos de ataque e habilidades ao servidor (`BATTLE_COMMAND_REQ`).
- Sincronização de eventos de animação (`ACTION_START`, `DAMAGE`, `HEAL`, `DEATH`, `BATTLE_WON`, `BATTLE_LOST`).

---

## 🗺️ Sistema de Encontros por Região (Region Control)

O plugin **`Nythera_RegionControl.js`** permite aos desenvolvedores e game designers controlar com máxima precisão quais monstros aparecem em quais áreas do mapa, usando os **Region IDs** (camada de regiões de 1 a 255) desenhados no editor do RPG Maker MZ.

### Como Funciona:
Ao caminhar sobre um tile com Região definida, o sistema verifica a chance configurada (`<rate: X>`). Caso o encontro ocorra:
1. O jogador exibe um balão de alerta/exclamação (`!`).
2. O estado do jogador é travado (`_inBattle = true`).
3. Uma batalha é disparada e enviada para o servidor autoritativo (`BATTLE_START_REQ`).
4. Ao final da batalha, os passos de graça (`graceSteps`) são ativados para impedir encontros repetidos imediatos.

### Hierarquia de Configuração (da maior prioridade para a menor):
1. **Sobrescritas por Mapa (Map Overrides)** nos parâmetros do plugin.
2. **Notas do Mapa (Map Note-tags)** nas propriedades do mapa no editor.
3. **Comentários em Eventos do Mapa** (qualquer evento com comando Comentário).
4. **Regiões Globais (Global Regions)** nos parâmetros do plugin.
5. **Padrão da Região 1 (Fallback)** nos parâmetros do plugin.

### Tags Suportadas:

| Tag | Descrição | Exemplo |
|---|---|---|
| `<mob: ID>` | Inicia batalha contra um monstro individual da aba Inimigos (Enemies). | `<mob: 1>` *(Enfrenta 1 Goblin)* |
| `<mob: ID1,ID2,...>` | Cria dinamicamente um grupo com os monstros informados posicionados no campo. | `<mob: 1, 2>` *(Goblin + Gnome juntos)* |
| `<mobs: ID>` | Dispara uma Tropa pré-cadastrada no banco de dados (`Troops.json`). | `<mobs: 1>` *(Tropa ID 1)* |
| `<mobs: ID1,ID2,...>` | Sorteia aleatoriamente entre uma das Tropas da lista. | `<mobs: 1, 2, 3>` *(Sorteia entre as tropas 1, 2 ou 3)* |
| `<rate: Chance>` | Chance percentual a cada passo dado sobre o tile da região (padrão: 8%). | `<rate: 15>` *(15% de chance por passo)* |

### Exemplos Práticos:

#### Exemplo 1: Configuração via Comentário de Evento (Recomendado)
Crie um evento invisível no mapa (por exemplo, nomeado `Encontros`) e adicione comandos de **Comentário**:
```text
<Region 1: <mob: 1> <rate: 15>>
<Region 2: <mob: 2> <rate: 12>>
<Region 3: <mob: 1, 2> <rate: 20>>
<Region 4: <mobs: 3, 4> <rate: 25>>
```

#### Exemplo 2: Configuração nas Notas do Mapa
No painel esquerdo inferior do RPG Maker MZ, clique com botão direito no mapa desejado -> **Editar** -> Campo **Notas**:
```text
<Region 1: <mob: 1> <rate: 10>>
<Region 2: <mobs: 2> <rate: 15>>
```

#### Exemplo 3: Configuração nos Parâmetros do Plugin
Pelo **Gerenciador de Plugins (`F10`)** em `Nythera_RegionControl`:
- Configure a `Região 1` padrão.
- Adicione structs em `Regiões Globais` ou `Sobrescritas por Mapa`.
- Ajuste os `Passos de Graça` (padrão: 5 passos livres após vencer um combate).

---

## 📁 Estrutura do Repositório

```text
NytheraSide/
├── server/                     # Backend Fastify + TypeScript
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/           # Login, registro e emissão de tokens
│   │   │   ├── character/      # Criação, listagem e persistência de heróis
│   │   │   ├── battle/         # Gateway WebSocket e BattleService autoritativo
│   │   │   ├── content/        # Validação e publicação versionada de dados
│   │   │   └── progress/       # Batch save de movimentação e progresso offline
│   │   ├── infra/              # Conexão Prisma e utilitários
│   │   └── __tests__/          # Suíte completa de testes Vitest
│   ├── prisma/                 # Schemas Prisma (SQLite e PostgreSQL)
│   └── package.json
├── packages/
│   ├── shared/                 # DTOs, schemas Zod e interfaces compartilhadas
│   └── content-schema/         # Schemas de validação para os JSONs do RPG Maker
├── tools/
│   └── content-sync/           # Watcher e importador de dados MZ -> Backend
├── data/                       # Arquivos JSON do RPG Maker MZ (Enemies, Troops, Maps...)
├── js/
│   ├── plugins/                # Plugins MZ customizados
│   │   ├── NET_Client.js       # Gerenciador de conexão WebSocket
│   │   ├── NET_Auth.js         # Interface Dark Glassmorphism (Login/CharSelect)
│   │   ├── NET_BattleBridge.js # Bridge de combate autoritativo
│   │   ├── NET_MapBridge.js    # Sincronização fluida de mapa e outros players
│   │   ├── Nythera_HUD.js      # HUD compacta em pixel art
│   │   └── Nythera_RegionControl.js # Sistema de encontros por região
│   └── plugins.js              # Manifesto de ativação dos plugins
├── docs/                       # Documentação técnica e arquitetural
├── run_game.py                 # Servidor HTTP local com anti-cache para dev
├── plan.md                     # Roadmap técnico e visões do projeto
├── agent.md                    # Diretrizes e regras invioláveis para agentes de IA
└── README.md                   # Este documento
```

---

## 🚀 Início Rápido para Desenvolvedores

### Pré-requisitos
- **Node.js 20+ LTS**
- **npm 9+**
- **Python 3.8+** (utilizado para iniciar o cliente com headers anti-cache)

### 1. Clonar e Configurar Ambiente
```bash
# Copiar as variáveis de ambiente padrão
cp .env.development.example .env
```

### 2. Preparar e Iniciar o Backend
```bash
# 1. Instalar dependências no servidor
cd server
npm install

# 2. Gerar Prisma Client e migrar banco de dados SQLite local (dev.db)
npm run db:generate:sqlite
npm run db:migrate:sqlite

# 3. Iniciar servidor Fastify em modo Watch
npm run dev
```
O servidor estará ativo em `http://localhost:3000`. O endpoint de saúde pode ser testado em `http://localhost:3000/health`.

### 3. Iniciar o Cliente do Jogo
Em outro terminal, a partir da raiz do projeto:
```bash
python run_game.py
```
O script abrirá o navegador apontando para `http://localhost:8000/index.html` com flags anti-cache habilitadas.

---

## 📡 Protocolo de Comunicação WebSocket

A comunicação em tempo real acontece via WebSocket no endpoint `/sync`:

### Cliente ➔ Servidor (Payloads)

| Tipo | Argumentos Principais | Descrição |
|---|---|---|
| `AUTH_REQ` | `{ token, characterId? }` | Autentica a sessão do jogador conectado. |
| `MAP_MOVE_REQ` | `{ mapId, x, y, direction, isMoving, speed, followers }` | Sincroniza a posição e movimentação a cada 50ms. |
| `BATTLE_START_REQ` | `{ troopId?, enemyIds? }` | Solicita início de combate (suporta Tropa ou Inimigos dinâmicos). |
| `BATTLE_COMMAND_REQ` | `{ command: { type, skillId, targetId } }` | Executa ação em batalha (ataque/skill/item). |
| `BATTLE_SET_AUTO_REQ` | `{ isAuto }` | Alterna modo de combate automático controlado por IA. |

### Servidor ➔ Cliente (Payloads)

| Tipo | Argumentos Principais | Descrição |
|---|---|---|
| `AUTH_RES` | `{ success, character }` | Confirmação e dados do herói ativo. |
| `MAP_UPDATE_RES` | `{ players: [...] }` | Snapshot contínuo das posições de todos os jogadores no mapa. |
| `BATTLE_UPDATE_RES` | `{ state, events: [...] }` | Estado do combate e fila visual de animações (dano, heal, vitória). |

---

## 🔄 Pipeline de Dados e Conteúdo

1. O game designer edita classes, monstros, habilidades e tropas no editor do **RPG Maker MZ**.
2. Ao salvar o projeto, os dados são exportados para a pasta `data/*.json`.
3. A ferramenta `tools/content-sync` detecta alterações (via Chokidar com debounce de 2 segundos).
4. O backend valida a estrutura dos JSONs via schemas **Zod** (`packages/content-schema`).
5. As fórmulas de dano são validadas em sandbox segura.
6. Um snapshot imutável é salvo no banco de dados como uma nova `content_version`.

---

## 🧪 Testes Automatizados

O projeto conta com suíte automatizada cobrindo autenticação, criação de personagens, sistema de combate e cálculo determinístico de fórmulas.

Para executar os testes do backend:
```bash
cd server
npm test
```

Para validar a compilação do pacote compartilhado:
```bash
cd packages/shared
npm run build
```

---

## 🔒 Regras de Ouro do Projeto

1. **Server-Authoritative**: O cliente nunca decide dano, HP, nível, EXP ou drops.
2. **Motor Único de Combate**: Manual e combate automático compartilham exatamente a mesma simulação.
3. **Fluxo Unidirecional de Conteúdo**: RPG Maker MZ JSON → Draft → Validação → Publicação de Versão.
4. **Sem `eval` em Produção**: Fórmulas de dano são interpretadas com timeout e isolamento.
5. **Idempotência**: Resgate de recompensas, compras e entregas de itens utilizam chaves únicas.

---

## 📚 Documentação Detalhada

Para se aprofundar em cada subsistema do jogo, leia os guias dedicados na pasta [`docs/`](docs/):

- 📐 [docs/architecture.md](docs/architecture.md) — Filosofia, design de sistemas e modelo de dados.
- 🔐 [docs/authentication.md](docs/authentication.md) — Segurança, senhas com Argon2, ciclo de vida de personagens.
- ⚡ [docs/protocol.md](docs/protocol.md) — Especificação completa das mensagens WebSocket.
- 📦 [docs/content-pipeline.md](docs/content-pipeline.md) — Pipeline de sincronização e validação de dados MZ.
- 🗄️ [docs/database.md](docs/database.md) — Configuração do Prisma para SQLite e migração para PostgreSQL.
- 📋 [plan.md](plan.md) — Roadmap do projeto e funcionalidades futuras.
- 🤖 [agent.md](agent.md) — Diretrizes arquiteturais para agentes de inteligência artificial.
