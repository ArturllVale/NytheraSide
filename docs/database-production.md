# PostgreSQL production

Set values from `.env.production.example`, provision PostgreSQL and a backup policy, then run:

```bash
DATABASE_PROVIDER=postgresql npm run db:generate:postgresql --workspace=server
DATABASE_PROVIDER=postgresql npm run db:migrate:postgresql --workspace=server
npm run build --workspace=server
npm run start --workspace=server
```

`db:migrate:postgresql` is an explicit schema-push staging procedure, not a claim that SQLite migrations are production migrations. Generate, review and apply versioned PostgreSQL SQL migrations before a release.
