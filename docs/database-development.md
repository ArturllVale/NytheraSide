# SQLite development

```bash
cp .env.development.example .env
npm install
npm run db:generate:sqlite --workspace=server
npm run db:migrate:sqlite --workspace=server
npm run dev --workspace=server
```

`db:migrate:sqlite` currently uses `prisma db push` because the inherited project has no historical Prisma migration baseline. Reset only local disposable data with `npm run db:reset:sqlite --workspace=server`. Back up by copying `server/prisma/dev.db` while the server is stopped.
