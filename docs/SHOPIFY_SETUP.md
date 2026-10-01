# Shopify Partner setup (M0)

1. Create an app in Partners → **AfterSale OS**, embedded enabled.
2. Set App URL to your tunnel / production URL (same as `APP_URL`).
3. Allowed redirection URL(s): `{APP_URL}/api/auth/callback`
4. Copy Client ID / Secret into `.env` (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `NEXT_PUBLIC_SHOPIFY_API_KEY`).
5. Update `shopify.app.toml` `client_id` and URLs, then `shopify app deploy` for declarative webhooks.
6. Apply early for **protected customer data** and request `read_all_orders` (or current equivalent) for historical backfill beyond ~60 days.
7. Use optional scopes for `write_draft_orders` / refunds when those features are enabled.

Verify all Shopify-specific behavior against current docs at build time (addendum verification rule).
