# Deploy on aftersale.tidyflowapp.com (port 4500)

## Process model

One public port. Nginx/Caddy terminates TLS and proxies to Node:

```
Internet → :443 (TLS) → 127.0.0.1:4500 (gateway)
                              ├─ /admin/*  → Admin Next (internal :4501)
                              ├─ /*        → Web Next   (internal :4502)
                              └─ worker    → BullMQ (no HTTP port)
```

## .env

```env
APP_URL=https://aftersale.tidyflowapp.com
NEXT_PUBLIC_APP_URL=https://aftersale.tidyflowapp.com
ADMIN_URL=https://aftersale.tidyflowapp.com/admin
NEXT_PUBLIC_ADMIN_BASE_PATH=/admin
PORT=4500
HOST=0.0.0.0
NODE_ENV=production
```

`APP_URL` and `NEXT_PUBLIC_APP_URL` must both be set (same value). They power theme embeds, `assetPrefix` for `/_next` assets, and customer API calls from storefront iframes.

## Run

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run build
npm start
```

## Nginx example

```nginx
server {
  server_name aftersale.tidyflowapp.com;
  location / {
    proxy_pass http://127.0.0.1:4500;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Shopify Partner App URL and redirect must be `https://aftersale.tidyflowapp.com` and `https://aftersale.tidyflowapp.com/api/auth/callback`.

## Optional integrations

```env
# Logo upload (Settings → Branding)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Transactional email (worker)
RESEND_API_KEY=
RESEND_FROM_EMAIL=notifications@yourdomain.com
RESEND_FROM_NAME=AfterSale OS

# Redis (worker queues — required in production)
REDIS_URL=redis://127.0.0.1:6379
```

## Shopify CLI

After code changes that touch the theme extension or app config:

```bash
shopify app deploy
```

New theme blocks: **AfterSale portal/register/claim embed** — add in the theme editor under Apps.

## Protected customer data (orders / refunds)

Order and refund webhooks stay disabled in `shopify.app.toml` until Partners approves PCD. Steps: [PCD_WEBHOOKS.md](./PCD_WEBHOOKS.md).

## Build order (monorepo)

```bash
npm install
npm run build -w @aftersale/db   # merchant-ops exports land in dist/
npm run build                    # web, worker, admin
```

Restart **web** and **worker** after deploy so GraphQL, email templates, and webhooks pick up changes.

Post-deploy verification: [SMOKE_CHECKLIST.md](./SMOKE_CHECKLIST.md).

Theme embeds / refused to connect: [THEME_BLOCKS.md](./THEME_BLOCKS.md).  
Thank-you page register button: [CHECKOUT_REGISTER.md](./CHECKOUT_REGISTER.md).
