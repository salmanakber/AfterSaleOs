# Deploy smoke checklist

Run after `npm install && npm run build && npm start` (and worker restart) on the server.

## 0. Preflight

- [ ] `npm install` completed (includes `pdf-lib`)
- [ ] `npm run build` succeeds for all workspaces
- [ ] Web + worker + Redis are running
- [ ] Env: `APP_URL`, Shopify keys, `DATABASE_URL`, `REDIS_URL`
- [ ] Optional: `RESEND_*`, `CLOUDINARY_*`
- [ ] `shopify app deploy` if theme blocks / toml changed

## 1. Install & billing

- [ ] Open app from Shopify admin (embedded)
- [ ] New install shows plan selection (or bypass in admin test mode)
- [ ] After plan choose / billing return, dashboard loads without GraphQL `UNAUTHORIZED`
- [ ] Sidebar + Shopify NavMenu links keep `?shop=`

## 2. Rules & serials

- [ ] Products & rules → create default rule
- [ ] Edit rule → save & publish version
- [ ] Create serial list → import a few serials → success banner (no browser alert)
- [ ] Set serial mode to **Validated against list** → link list → save

## 3. Warranties

- [ ] Run backfill (or create manual warranty)
- [ ] Extend via modal (not prompt)
- [ ] Void via modal with reason

## 4. Registrations / claims

- [ ] Customer register (proxy or hosted) with linked serial → approve/reject in merchant UI (modal)
- [ ] Open a claim → override eligibility via modal
- [ ] Change claim status → customer email job logs `email.sent` or `email.skipped` in worker

## 5. Team / QR / automations

- [ ] Team shows seat usage; adding past limit shows friendly error
- [ ] Create QR → scan/open `/q/{code}` → lands on register
- [ ] Automations → rename status + save email template (modals)

## 6. Customer surfaces

- [ ] Portal / register / claim pages load (not 404)
- [ ] Certificate page → **Download PDF** returns branded PDF (logo if set)
- [ ] Settings → Embed snippets copy; theme embed blocks available after deploy

## 7. Observability spot-check

Worker logs should be JSON lines, e.g.:

```json
{"service":"worker","processor":"email","event":"email.sent",...}
{"service":"worker","processor":"webhook","event":"webhook.completed","topic":"products/update",...}
```

Failed webhooks set `webhook_events.status=FAILED` and `lastError`.

## 8. PCD (when approved)

- [ ] Follow [PCD_WEBHOOKS.md](./PCD_WEBHOOKS.md)
- [ ] Place a test order → warranty created without backfill
- [ ] Refund with void-on-refund enabled → warranty voided

## Done when

Merchant can install → configure rule → create/manage warranties → handle claim → customer gets certificate PDF — without browser prompts or raw GraphQL errors.
