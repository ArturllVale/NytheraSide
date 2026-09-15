# 🗣️ Sistema de Eventos Nativos e NPCs (Replay Sincronizado)

No **NytheraSide**, valorizamos o ecossistema do **RPG Maker MZ**. Para que você possa usar 100% dos recursos nativos do editor (Show Text, Show Choices, Faces, Plugins visuais), nós não bloqueamos o processamento visual dos eventos.

Em vez disso, usamos um sistema de **Replay de Eventos Sincronizado (Server-Authoritative)**. O cliente roda o evento localmente usando os comandos normais, mas é impedido de conceder recompensas falsas a si mesmo (Ouro, XP, Itens). Ao terminar, o cliente envia seu histórico de "escolhas" para o backend, que repete o mesmo fluxo logicamente e concede as recompensas de forma segura.

## 1. Arquitetura Geral

```text
[ Editor RPG Maker MZ ]
  Cria evento visualmente (Mensagens, Escolhas, Recompensas)
         │
   (Ao salvar o projeto)
         │
 [ tools/content-sync ]
  Lê os arquivos Map*.json e envia pro DB do Servidor
         │
         ▼
[ Cliente (Durante o Jogo) ]
  1. Interage com um Evento
  2. Roda localmente (desenha rostos, caixas de diálogo)
  3. Se houver comandos "Change Gold" ou "Change Items", o cliente ignora (bloqueado).
  4. O cliente grava todas as respostas de "Show Choices" dadas pelo jogador.
  5. Ao final, envia `EVENT_SYNC_REQ { mapId, eventId, choices: [0, 1] }`.
         │
         ▼
 [ Servidor Node.js (EventService) ]
  1. Recebe a requisição de Sync.
  2. Carrega o Map*.json correspondente do DB.
  3. Re-executa as lógicas de "Branching" usando as `choices` passadas.
  4. Se o caminho cruzar comandos de Ouro/Item (125, 126, etc), ele soma.
  5. Aplica a recompensa real no Banco de Dados (EconomyService).
```

## 2. Como usar no Editor (Guia do Desenvolvedor)

Você **não precisa** programar nada extra em JavaScript! Faça seus NPCs exatamente como você faz em qualquer jogo de RPG Maker:

1. Crie um evento no mapa.
2. Adicione os comandos `Show Text`, `Show Choices` e `Change Gold`.
3. Para que o servidor saiba que esse evento deve ser validado no final, você deve marcá-lo como um **Evento Sincronizado**.
   - **Forma 1:** Coloque `[NPC]` no nome do Evento.
   - **Forma 2:** Coloque `<sync>` ou `<npcId: X>` na caixa de Notas do Evento.

Pronto! O plugin `NET_Events.js` interceptará a execução e cuidará de toda a sincronização com o Fastify.

## 3. O que o Servidor Valida?

Atualmente, o `EventService` (em `src/modules/world/npc.service.ts`) reconhece e valida os seguintes comandos nativos do RM MZ durante o replay:
- **102 / 402:** Controle de Ramificações (Choices)
- **125:** Change Gold (Adicionar / Remover Ouro)
- **126:** Change Items (Adicionar / Remover Itens)
- **127:** Change Weapons
- **128:** Change Armors

*Aviso de Segurança:* Como as recompensas usam **Idempotency Keys** únicas baseadas na data e ID do evento, exploits de duplicação são impossíveis. O servidor sempre confirmará o caminho lógico tomado antes de conceder a recompensa.
