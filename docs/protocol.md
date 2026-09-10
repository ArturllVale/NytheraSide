# Current realtime protocol

`/battle/sync` accepts JSON only and has a 16 KiB payload limit. The first message must be `AUTH_REQ` with an opaque session token. The server then binds the socket to the authenticated account's character; subsequent battle start/command payloads are Zod-validated. Current message schemas live in `packages/shared/src/dto/battle.dto.ts`. A map-world protocol with `SELECT_CHARACTER`, `ENTER_WORLD`, movement sequences and interest events remains pending.
