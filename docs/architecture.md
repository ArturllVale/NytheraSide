# Architecture

NytheraSide is a modular Fastify monolith. The RPG Maker client is presentation and input only; authoritative account, character, battle and persistent state live in the server. Prisma is the persistence boundary. SQLite is the default local provider; PostgreSQL is the production provider. Redis is deliberately optional in local development and is reserved for ephemeral cross-instance concerns.

The current multiplayer implementation is battle-oriented. Map-world movement, interest management, inventory/equipment mutations and a complete character-select/enter-world protocol are not yet implemented; they must not be represented as completed functionality.

> Validation note: the checked-in lockfile originally installed `@fastify/websocket` 11 with Fastify 4, which is an incompatible major-version pair. The manifest now requests the Fastify-4-compatible websocket 8 line. The restricted environment could not download that package, so an HTTP bootstrap test could not be run here; reinstall dependencies before running the server.
