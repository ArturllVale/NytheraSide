# NytheraSide

Um RPG Idle/MMO-lite com cliente no **RPG Maker MV** e servidor autoritário em **Node.js/Fastify**. O cliente roda apenas animações visuais, toda a lógica de batalha e progresso é gerenciada no backend.

## Pré-requisitos
- [Node.js 20+](https://nodejs.org/)
- [RPG Maker MV](https://www.rpgmakerweb.com/products/rpg-maker-mv) (opcional, para editar o projeto)

*(Nota: O projeto foi atualizado para utilizar o Prisma e o SQLite localmente, removendo totalmente a necessidade do Docker ou Redis para simplificar o desenvolvimento.)*

---

## 🚀 Como Iniciar (Backend)

**1. Instalar dependências**
O projeto usa `npm workspaces`.
```bash
npm install
```

**2. Variáveis de ambiente**
Copie o arquivo de exemplo na raiz do projeto para criar o `.env`:
```bash
cp .env.example .env
```
*(O padrão de `.env` configurará o banco local `dev.db` na pasta do servidor).*

**3. Sincronizar o Banco de Dados (Prisma + SQLite)**
Crie as tabelas necessárias no arquivo SQLite local:
```bash
npm run db:push --workspace=apps/server
```

**4. Iniciar o Servidor**
Rode o servidor em modo de desenvolvimento:
```bash
npm run dev --workspace=apps/server
```
O servidor estará rodando em `http://localhost:3000`.

---

## 🎮 Como Configurar o Cliente (RPG Maker MV)

1. Os plugins de rede estão em `apps/rmmv-client/js/plugins`.
2. Para que o jogo funcione, adicione os plugins na lista do Gerenciador de Plugins (Plugin Manager) do RPG Maker MV na seguinte **ordem exata**:
   - `NET_Client`
   - `NET_Auth`
   - `NET_BattleBridge`
   - `NET_ContentGuard`
3. O servidor precisa estar rodando. Ao iniciar o jogo localmente, o `NET_Auth` vai pedir seu Token de Sessão (que pode ser obtido enviando um POST para `/auth/login` no backend).

---

## 🛠️ Estrutura do Monorepo

- `apps/server`: Servidor autoritário (Fastify, Prisma, Zod, isolated-vm, WebSockets).
- `apps/rmmv-client`: O cliente jogo (arquivos do RPG Maker MV + plugins de rede customizados).
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
