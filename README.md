# NytheraSide

RPG Idle/MMO-lite com apresentação visual em **RPG Maker MZ** e backend autoritativo de alta performance em **Node.js / Fastify** com **Prisma**. O cliente é responsável pela renderização, efeitos e inputs, enquanto toda a lógica de combate, progressão, movimentação e economia é validada e gerenciada no servidor.

---

## ⚡ Início Rápido (Ambiente de Desenvolvimento)

### 1. Pré-requisitos
- **Node.js 20+**
- **Python 3.8+** (para executar o launcher do cliente de testes)

### 2. Iniciar o Backend (SQLite Local)
```bash
# 1. Configurar variáveis de ambiente na raiz
cp .env.development.example .env

# 2. Acessar a pasta do servidor e instalar dependências
cd server
npm install

# 3. Gerar Prisma Client e aplicar migrações no banco SQLite local (dev.db)
npm run db:generate:sqlite
npm run db:migrate:sqlite

# 4. Iniciar servidor Fastify com recarregamento automático
npm run dev
```
O servidor estará escutando em `http://localhost:3000`. Verifique o status em `GET /health`.

### 3. Iniciar o Jogo (Cliente RPG Maker MZ)
Em outro terminal na raiz do projeto:
```bash
python run_game.py
```
O script iniciará um servidor HTTP local na porta `8000` com headers anti-cache e abrirá o navegador automaticamente no jogo.

---

## 🎮 Funcionalidades do Cliente e Interface

- **Interface In-Game (Dark Glassmorphism)**: Telas integradas de Login, Registro, Criação e Seleção de Heróis com visual escuro, acentos dourados e auras luminosas.
- **Criação de Personagens (3 Etapas)**:
  1. **Escolha de Classe**: Seleção com cards e ícones estilizados.
  2. **Aparência**: Renderização do sprite em canvas com botão de rotação 360° em tempo real (`↻`).
  3. **Confirmação e Nome**: Campo de texto com validação e detecção de nomes duplicados.
- **Seleção de Personagens**:
  - Grid com até 4 heróis salvos por conta.
  - Pré-visualização de sprites, nível, classe e mapa atual.
  - Opções para entrar no jogo ou deletar personagem com segurança.
- **HUD Integrada (`Nythera_HUD`)**: Barras de vida, mana, experiência, dados do herói e minimapa.
- **Sincronização Multiplayer**: Posições e direções de jogadores sincronizadas em tempo real via WebSocket (`/battle/sync`).

---

## 🛠️ Estrutura do Repositório

```
NytheraSide/
├── server/               # Servidor autoritativo (Fastify 5, Prisma, WebSockets, Zod)
├── packages/
│   ├── shared/           # DTOs, schemas de validação e tipos compartilhados
│   └── content-schema/   # Schemas e validadores dos dados do RPG Maker
├── tools/
│   └── content-sync/     # Ferramenta e watcher de sincronização do banco de dados do MZ
├── data/                 # Banco de dados do RPG Maker MZ (Classes, Skills, Enemies, etc.)
├── js/plugins/           # Plugins customizados de rede e UI (NET_*, Nythera_HUD)
├── docs/                 # Documentação detalhada da arquitetura e protocolos
└── run_game.py           # Servidor e inicializador do cliente
```

---

## 🧪 Testes Automatizados

Executar todos os testes unitários e de integração do backend:
```bash
npm --prefix server test
# ou: cd server && npm test
```
*(Executa a suíte de testes Vitest isolada usando `server/test.db`)*

---

## 📚 Documentação Adicional

- [Arquitetura Geral](docs/architecture.md)
- [Protocolo WebSocket em Tempo Real](docs/protocol.md)
- [Autenticação e Ciclo de Vida do Personagem](docs/authentication.md)
- [Pipeline de Conteúdo e Fórmulas](docs/content-pipeline.md)
- [Configuração de Banco de Dados (SQLite & PostgreSQL)](docs/database.md)
