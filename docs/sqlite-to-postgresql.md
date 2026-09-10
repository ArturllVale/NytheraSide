# SQLite to PostgreSQL

SQLite and PostgreSQL Prisma schemas are separate (`schema.sqlite.prisma` and `schema.postgresql.prisma`) because Prisma's provider is generation-time configuration. Select the provider with the corresponding `db:generate:*` command before running the server. Export/import player data through a reviewed migration process; never point a PostgreSQL client at a SQLite file or run destructive automatic conversion.
