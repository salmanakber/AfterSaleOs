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
