# Theme blocks — storefront placement

Shopify never auto-adds theme app blocks. Merchants place or enable them in the theme editor.

## Hosted app origin

Iframes and register links always use the hosted AfterSale app (`https://aftersale.tidyflowapp.com`). Theme blocks no longer expose an “App URL” setting — the snippet resolves the host automatically. Never point embeds at `*.myshopify.com` (browsers refuse to connect).

## Embed stuck on “Loading…”

Theme iframes must load the **hosted app**, not the shop proxy (`/apps/aftersale/...`). Proxy HTML cannot load Next.js `/_next` bundles from the shop domain.

Embed blocks show a **visual preview card** in the theme editor (Shopify often blocks live iframes inside the editor).

After pulling theme changes, redeploy the theme extension from the repo root.

## Fastest path (recommended)

1. Online Store → Themes → **Customize**.
2. Left sidebar → **App embeds** (theme settings gear).
3. Enable **Warranty opt-in embed**.
4. In the block settings, choose style (checkbox, soft banner, or button) and set accent / background to match the brand.
5. Open a product page in the preview — the opt-in appears near the buy form.

## Product or cart block

1. Customize → open the **Product** or **Cart** template.
2. **Add block** → **Apps** → **Warranty register card**.
3. Customize style, colors, and copy → Save.

## If Apps is empty

- Confirm the theme extension is released and the app is installed on that shop.
- Theme should be Online Store 2.0 (JSON templates). Vintage themes often lack Apps.
- On a development store: Partners → Apps → Extensions → **Development store preview**.
- Hard-refresh the theme editor.

## Checkout

Liquid theme blocks cannot run on checkout. Use:

- Product / cart opt-in (sets cart attribute `aftersale_register_intent`)
- Thank-you page app block after purchase (see [CHECKOUT_REGISTER.md](./CHECKOUT_REGISTER.md))

## Block names

| Name in editor | Type |
|----------------|------|
| Warranty opt-in embed | App embed (body) |
| Warranty register card | App block (product / cart) |
| Warranty register / claim / lookup buttons | App blocks |
| Register / claim / portal form embeds | Iframe app blocks |
