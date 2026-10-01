# Prisma commands (from repo root)

Do **not** run `prisma push` — that is not a Prisma command.

Use one of these:

```bash
# Recommended (loads root .env automatically)
npm run db:generate
npm run db:push
npm run db:seed

# Or from packages/db:
cd packages/db
npx prisma generate
npx prisma db push
```

Note the space: `db push`, not `push`.

## DATABASE_URL tip

If your password contains `@` or `!`, URL-encode them:

- `@` → `%40`
- `!` → `%21`

Example: password `AfterSaleDb12!@` becomes `AfterSaleDb12%21%40` in the URL.
