# Protected Customer Data (PCD) webhooks

Order and customer webhooks are **implemented in the worker** but **commented out** in `shopify.app.toml` until Shopify approves PCD for your app.

## After approval

1. In Partners → App → **API access** → enable **Protected customer data**.
2. Uncomment in `shopify.app.toml`:

```toml
  [[webhooks.subscriptions]]
  topics = [
    "orders/create",
    "orders/updated",
    "orders/cancelled",
    "refunds/create",
    "customers/update"
  ]
  uri = "/api/webhooks/shopify"
```

3. Run `shopify app deploy` and reinstall or sync webhooks on dev stores.

## What unlocks

- Live warranty creation from orders (not only backfill)
- Void/sync on refund when **Void warranty on refund** is enabled
- Customer profile sync from `customers/update`

Worker handler: `apps/worker/src/processors/webhooks.ts`.
