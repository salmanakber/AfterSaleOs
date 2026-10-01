# AfterSale OS

Warranty registration and claims for Shopify — full-scope 1.0 (see `AfterSale_OS_Full_Scope_Addendum.md`).

## Stack

| Package | Role |
|---------|------|
| `apps/web` | Embedded merchant app (Next.js + Polaris + App Bridge) + API routes |
| `apps/worker` | BullMQ workers (webhooks, email, later backfill/PDF/AI) |
| `apps/admin` | Super Admin dashboard (separate deploy) |
| `packages/db` | Prisma + tenant-scoped client + session storage |
| `packages/shared` | Plans, date math, eligibility, theme tokens |
| `extensions/` | Shopify CLI extensions (theme, customer-account, Flow, admin blocks) |

## Prerequisites

- Node 20+
- Docker (Postgres 16 + Redis 7)
- Shopify Partner app credentials

## Quick start

```bash
cp .env.example .env
# Fill SHOPIFY_API_KEY, SHOPIFY_API_SECRET, NEXT_PUBLIC_SHOPIFY_API_KEY

docker compose up -d
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run build -w @aftersale/shared
npm run build -w @aftersale/db
npm run dev
```

- Merchant app: http://localhost:3000/?shop=YOUR_STORE.myshopify.com  
- GraphQL API: http://localhost:3000/api/graphql  
- Super Admin: http://localhost:3001 (seed: `admin@aftersale.local` / `changeme123`)  
- Worker starts via `turbo dev` alongside web/admin

Update `shopify.app.toml` with your Partner `client_id` and public URL (Cloudflare tunnel / ngrok for local webhooks).

## M0 exit checklist

- [ ] Install → OAuth → embedded UI loads
- [ ] Uninstall → reinstall restores shop row
- [ ] Privacy webhooks (`customers/redact`, `shop/redact`) delete data
- [ ] Tenant isolation test: `npm run test -w @aftersale/db` (with `DATABASE_URL`)
- [ ] Billing skeleton: `GET/POST /api/billing`
- [ ] Usage counters visible on Home dashboard

## Milestones

Build order is M0→M11 per the addendum. Recommended App Store submission after **M3** (claims core).

## Security rules

- Merchant feature code must use `createTenantClient(shopId)` — never unscoped `prisma` for shop data.
- Super Admin uses `adminPrisma` + `audit()` only from `apps/admin`.
- Customer claim/registration is **never** blocked by plan limits.
