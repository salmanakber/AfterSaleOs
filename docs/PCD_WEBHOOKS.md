# Protected Customer Data (PCD) webhooks

Order and customer webhooks are required for **live warranty creation after checkout**.

Until Shopify approves PCD access, those topics **must stay commented out** in `shopify.app.toml` or `shopify app deploy` fails with:

> This app is not approved to subscribe to webhook topics containing protected customer data.

## Setup

1. Partners → your app → **API access** → request / enable **Protected customer data** (and Customer data level your app needs).
2. Wait until status is approved (not pending).
3. In `shopify.app.toml`, **uncomment** the order/customer subscription block:

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

4. Run `shopify app deploy` again and reinstall (or sync webhooks) on the store.

## What unlocks after approval

- Live warranty creation when an order is placed (and checkbox / rules match)
- Optional paid warranty fee line detection
- Void/sync on refund when **Void warranty on refund** is enabled
- Customer profile sync from `customers/update`

## Until approved

- Deploy theme / thank-you extensions with PCD topics **commented out** (current default)
- Use **Historical backfill** on Warranties for existing Shopify orders
- Customer portal / register / claim still work via email + order verify

Worker handler: `apps/worker/src/processors/webhooks.ts`  
Inline order sync (when webhooks fire): `apps/web/src/app/api/webhooks/shopify/route.ts`
