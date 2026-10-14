# Protected Customer Data (PCD) webhooks

Order and customer webhooks are required for **live warranty creation after checkout**.

## Setup

1. Partners → App → **API access** → request / enable **Protected customer data**.
2. Deploy the app so `shopify.app.toml` subscriptions include:

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

3. Run `shopify app deploy` and reinstall (or sync webhooks) on the store.

## What unlocks

- Live warranty creation when a customer checks “Register for warranty” and places an order
- Optional paid warranty fee line detection
- Void/sync on refund when **Void warranty on refund** is enabled
- Customer profile sync from `customers/update`

Without PCD approval Shopify may reject these subscriptions — use **Historical backfill** on Warranties until approved.

Worker handler: `apps/worker/src/processors/webhooks.ts`.
