# Phase 2: Auth + Personagem

## Resumo das Entregas

A Fase 2 foca na fundação da gestão de contas, sessões e criação de personagens vinculada ao conteúdo importado do RPG Maker MV (Phase 1).
Abaixo estão detalhados os recursos implementados, seguindo rigorosamente os princípios do `plan.md` e `agent.md`.

### 1. Banco de Dados e Esquema
As tabelas necessárias foram definidas no Drizzle ORM (`apps/server/src/infra/db/schema.ts`):
- `auth.users`: Armazena os usuários com senhas em hash (usando `argon2`).
- `auth.sessions`: Gerencia os tokens de sessão opacos, vinculados aos usuários e com data de expiração.
- `character.characters`: Armazena os personagens, incluindo a referência ao `actor_template_id` e um snapshot JSON dos `base_stats` iniciais.

### 2. Autenticação (AuthModule)
Os fluxos de autenticação foram implementados usando Fastify:
- **`POST /auth/register`**: Registra novo usuário com `email` e `password`. A senha é salva usando `argon2`.
- **`POST /auth/login`**: Valida credenciais e emite um `token` opaco persistido no PostgreSQL (e cacheado no Redis).
- **`POST /auth/logout`**: Invalida o token atual (remove do PG e do Redis). Exige autenticação.
- **`GET /me`**: Retorna os detalhes do usuário atual baseado no token de sessão da requisição. Exige autenticação.

Além disso, adicionamos um rate limit via Redis tanto no Login quanto no Register (limite de 5 tentativas a cada 15 minutos para evitar abusos).

### 3. Middleware de Proteção
Implementamos `authMiddleware` em `apps/server/src/middleware/auth.middleware.ts` para proteger rotas autenticadas.
O middleware busca o token no header `Authorization`, valida contra Redis/PostgreSQL e injeta `request.user.id`.
- Adicionado para `/me`, `/auth/logout` e todas as rotas de `/characters` em seus respectivos plugins.

### 4. Gestão de Personagens (CharacterModule)
A lógica para criar e resgatar personagens foi adicionada:
- **`POST /characters`**: Recebe `{ actorTemplateId, name }`.
  - Verifica se o `actorTemplateId` e seu correspondente `classId` existem na versão de conteúdo ativa (*content_version* atualizada pela Fase 1).
  - Snapshot de `base_stats` gravado em JSON para que as dependências do servidor sejam autoritativas.
  - Como a batalha ainda não está presente, gravamos o estado "puro" original importado do RM para processamento futuro de atributos derivados.
- **`GET /characters`**: Retorna a lista de personagens do usuário logado.
- **`GET /characters/:id`**: Retorna os detalhes de um personagem específico do usuário logado.

### 5. DTOs e Compartilhamento de Tipos (`packages/shared`)
Os payloads das requisições e respostas, assim como os códigos de erro, foram centralizados em `packages/shared/src/`:
- `dto/auth.dto.ts` e `dto/character.dto.ts` expõem os `Zod Schemas` e as tipagens TypeScript extraídas.
- `constants/errorCodes.ts` padroniza códigos de erro (ex: `AUTH_INVALID_CREDENTIALS`, `CHARACTER_ACTOR_NOT_FOUND`) que fluem para a API de forma determinística.

### 6. Testes Automatizados
Testes cobrindo os caminhos felizes e falhas esperadas estão localizados em `apps/server/src/__tests__/`:
- *Auth*: Sucesso em login/registro, falha por senha incorreta, rate limit de tentativas excedidas, validação e deleção de sessão no logout.
- *Character*: Sucesso na criação com snapshot, falha ao tentar usar template de id desconhecido/nulo e bloqueio para visualizar personagens de outros usuários.

*Nota:* Testes utilizam Vitest (`vitest run`). O banco de dados PostgreSQL e o Redis precisam estar rodando localmente para execução completa do `npm test`.

---

## Migration Notes (Instruções de Deploy)

Como introduzimos novos schemas de banco de dados (`auth` e `character`) baseados em Drizzle, siga os passos abaixo para sincronizar seu PostgreSQL antes de iniciar o servidor:

1. Garanta que seu arquivo `apps/server/.env` contém a `DATABASE_URL` apontando para o seu PostgreSQL local:
   ```env
   DATABASE_URL=postgres://usuario:senha@localhost:5432/nytheraside
   ```
2. Instale as dependências (caso algum novo pacote tenha sido inserido localmente na área de workspace):
   ```bash
   npm install
   ```
3. Gere e aplique as migrations usando a CLI do Drizzle (ajuste o comando conforme estiver configurado nos scripts do seu projeto, ou use a ferramenta de sua preferência já que o schema está em TypeScript):
   ```bash
   # Exemplo genérico se usando drizzle-kit (adicione ao projeto caso necessário)
   cd apps/server
   npx drizzle-kit push
   ```
4. Verifique que o Redis está rodando (porta 6379 padrão), pois agora é exigido para Rate Limit e Cache de sessões de Login.
5. Inicie o servidor:
   ```bash
   npm run dev
   ```