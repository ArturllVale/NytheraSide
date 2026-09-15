# 🗡️ NytheraSide

> **MMO-lite / Idle RPG** moderno com apresentação visual clássica no **RPG Maker MZ** e backend de alta performance **Server-Authoritative** em **Node.js (Fastify 5 + TypeScript + Prisma + WebSockets)**.

O cliente é responsável unicamente pela renderização de sprites, animações, mapas, efeitos sonoros e envio de intenções de input. Toda a lógica de combate, status, progressão, movimentação e economia é estritamente validada e executada no servidor.

---

## 📑 Sumário

- [Visão Geral e Arquitetura](#-visão-geral-e-arquitetura)
- [Funcionalidades do Jogo](#-funcionalidades-do-jogo)
- [Sistema de Roles e Privilégios VIP](#-sistema-de-roles-e-privilégios-vip)
- [Sistema de Encontros por Região (Region Control)](#-sistema-de-encontros-por-região-region-control)
- [Sistema de NPCs e Diálogos (Server-Authoritative)](#-sistema-de-npcs-e-diálogos-server-authoritative)
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
  - Grade 3x2 com até 6 slots (4 base para contas comuns + 2 slots para VIP/GM/Admin).
  - Slots 5 e 6 exibem status de bloqueio visual (`🔒`) para jogadores não-VIP.
  - **Retenção de Personagens**: Se o VIP expirar, os personagens já criados continuam 100% jogáveis.
  - Painel com resumo detalhado (tipo de conta, dias VIP restantes, nível, classe, mapa atual).
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

## 👑 Sistema de Roles e Privilégios VIP

O sistema de privilégios do NytheraSide é integrado ao banco de dados SQLite/PostgreSQL e sincronizado tanto na tela de seleção de heróis quanto durante o jogo nos mapas do RPG Maker MZ através do plugin **`NET_VIP.js`**.

### 1. Hierarquia de Roles no Banco de Dados

| Role | Descrição | Limite de Slots | Privilégios VIP |
|---|---|:---:|:---:|
| `normal` | Jogador comum sem privilégios extras. | 4 heróis | Não (a menos que tenha `vip_until` ativo) |
| `vip` | Jogador VIP com assinatura ou dias ativos. | 6 heróis (+2) | Sim |
| `gm` | Game Master (gerenciador de eventos e moderação). | 6 heróis (+2) | Sim (perpétuo) |
| `admin` | Administrador completo do sistema. | 6 heróis (+2) | Sim (perpétuo) |

> [!NOTE]
> **Padrão de Criação de Contas**:
> - Contas registradas com e-mails contendo `teste` ou `admin` (ex: `teste@teste.com`) são automaticamente criadas com o papel **`admin`** e VIP perpétuo.
> - Todas as demais novas contas registradas recebem a role **`normal`**.

---

### 2. Regra dos Slots de Personagens (+2 Slots) & Retenção

1. **Slots Base**: Jogadores comuns podem criar até 4 personagens.
2. **Slots VIP**: Jogadores VIP, GM ou Admin desbloqueiam os slots 5 e 6 na grade de seleção.
3. **Regra de Retenção Absoluta**:
   - Se um jogador cria heróis nos slots 5 e 6 enquanto VIP e posteriormente seu VIP expira, **os personagens já criados continuam 100% ativos, acessíveis e jogáveis normalmente!**
   - O servidor e o cliente nunca desativam, trancam ou apagam heróis existentes.
   - Apenas se o jogador deletar voluntariamente um herói de sua conta e não tiver mais VIP ativo, o slot voltará a ficar bloqueado para novas criações.

---

### 3. Comandos em Eventos do RPG Maker MZ

Você pode conceder VIP ou verificar acessos diretamente através de **Comentários de Evento** ou **Plugin Commands**:

#### A. Conceder ou Revogar VIP via Comentário:
Adicione um comando de **Comentário** no evento com a seguinte sintaxe:
- `<vip: 1, 7>` — Concede **7 dias** de VIP para a conta do jogador ativo. O jogo toca a fanfarra `Chime2` e exibe mensagem de confirmação.
- `<vip: 1, 30>` — Concede **30 dias** de VIP (se o jogador já for VIP, os dias são somados ao vencimento atual).
- `<vip: 0, 0>` — Revoga o status VIP da conta.

#### B. Bloqueio e Verificação de Acesso VIP:
Para restringir um NPC, baú de tesouro ou portal para membros VIP:
Coloque no início da lista de comandos do evento um Comentário com:
```text
<vip>
```
- Se o jogador **NÃO for VIP/GM/Admin**: A execução do evento é interrompida imediatamente, toca um sinal sonoro de Buzzer e exibe o aviso na tela: `[Acesso VIP] Este conteúdo é exclusivo para membros VIP!`.
- Se o jogador **FOR VIP**: O evento continua normalmente para os próximos comandos.

---

### 4. Integração Nativa com o Editor MZ (Switch 10 e Variável 10)

O plugin `NET_VIP.js` sincroniza automaticamente os dados com as switches e variáveis do jogo:

- **Switch 0010 (`VIP`)**:
  - `ON`: O jogador possui status VIP ativo (ou role `admin`/`gm`).
  - `OFF`: O jogador é conta comum sem VIP.
  - *Como usar no editor*: Crie uma **Página 2** no NPC com a Condição de Página `[x] Switch 0010 (VIP) está ON` para oferecer diálogos, lojas ou recompensas exclusivas para VIPs sem precisar de scripts.
  - Também pode ser usado no comando nativo do MZ: `Condição (Se / Senão) -> Switch [0010: VIP] == ON`.

- **Variável 0010 (`Dias VIP`)**:
  - Armazena o número inteiro de dias VIP restantes da conta.
  - *Como usar nas mensagens*: `Você ainda possui \V[10] dias de VIP restantes!`.

---

### 5. Chamadas de Script (Script Calls) para Desenvolvedores

Você pode utilizar diretamente em comandos de Script ou Condições em Script:

```javascript
// Verifica se o jogador tem status VIP ativo (ou se é GM/Admin)
if (NET.isVip()) {
  // Acesso liberado
}

// Verifica se a role é exatamente administrador
if (NET.isAdmin()) { ... }

// Verifica se a role é GM ou Admin
if (NET.isGm()) { ... }

// Retorna a role atual do usuário ('normal' | 'vip' | 'gm' | 'admin')
var role = NET.userRole();

// Retorna a quantidade de dias VIP restantes (número inteiro)
var dias = NET.vipDaysRemaining();

// Concede 7 dias de VIP via script
NET.grantVip(1, 7);

// Revoga VIP via script
NET.grantVip(0, 0);
```

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

## 🗣️ Sistema de Eventos Nativos e NPCs (Server-Authoritative Replay)

O NytheraSide valoriza o uso do editor nativo do RPG Maker MZ. Para criar diálogos e quests, você usa os comandos normais do editor (Show Text, Show Choices, Change Gold), e nós garantimos que não haja trapaças!

### Como Funciona (A Mágica)
Em vez de desenhar menus customizados que perdem os recursos do MZ, o cliente executa o evento localmente exibindo todos os diálogos normalmente. No entanto, o cliente é **bloqueado de receber recompensas locais**. Ao finalizar o diálogo, o cliente envia silenciosamente o histórico das suas escolhas para o servidor. 
O servidor então pega o `Map.json` original, **repete os passos do seu diálogo** utilizando o histórico de escolhas recebido, e caso o fluxo passe por um comando de "Change Gold" ou "Gain Item", o servidor concede o item diretamente no banco de dados, protegendo o jogo de hackers.

### Como Adicionar um NPC / Quest

1. **Crie no RPG Maker MZ:** Faça seu evento de NPC normalmente (adicione textos, escolhas e recompensas).
2. **Marque para Sincronização:** Para que o cliente saiba que esse evento deve enviar as recompensas pro servidor, você deve marcá-lo.
   - **Nome do Evento:** Insira `[NPC]` no nome (ex: `Ferreiro [NPC]`).
   - **Notas do Evento:** Adicione `<sync>` nas propriedades do evento.
3. **Salve e Publique:** Ao salvar o projeto, a ferramenta `tools/content-sync` enviará o novo `Map*.json` ao backend, que estará pronto para simular e entregar as recompensas desse evento de forma 100% segura.

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
│   │   ├── NET_VIP.js          # Sistema de Roles e Privilégios VIP
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
| `CMD_VIP_REQ` | `{ action, days? }` | Solicita concessão (`1`) ou revogação (`0`) de status VIP. |
| `MAP_MOVE_REQ` | `{ mapId, x, y, direction, isMoving, speed, followers }` | Sincroniza a posição e movimentação a cada 50ms. |
| `BATTLE_START_REQ` | `{ troopId?, enemyIds? }` | Solicita início de combate (suporta Tropa ou Inimigos dinâmicos). |
| `BATTLE_COMMAND_REQ` | `{ command: { type, skillId, targetId } }` | Executa ação em batalha (ataque/skill/item). |
| `BATTLE_SET_AUTO_REQ` | `{ isAuto }` | Alterna modo de combate automático controlado por IA. |

### Servidor ➔ Cliente (Payloads)

| Tipo | Argumentos Principais | Descrição |
|---|---|---|
| `AUTH_RES` | `{ success, character, user: { role, isVip, vipUntil } }` | Confirmação, dados do herói ativo e status/role da conta. |
| `CMD_VIP_RES` | `{ success, role, isVip, vipUntil, message }` | Confirmação da alteração de status VIP com dias restantes. |
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
