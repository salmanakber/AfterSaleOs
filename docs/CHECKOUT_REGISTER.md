# Checkout & cart warranty registration

Liquid theme blocks **cannot** run on Shopify Checkout. AfterSale uses these surfaces:

| Place | What we ship | How to enable |
|-------|----------------|---------------|
| **Product page** | Warranty register card / opt-in checkbox | Theme editor → Product → Add block / App embeds |
| **Thank you page** | Checkout UI block “Register this product” | After `shopify app deploy` → Checkout editor → Thank you → Add app block |
| **Cart** | Optional cart attribute `aftersale_register_intent` from product opt-in | Automatic when customer checks the product-page box |

## Thank you page (order confirmed)

Extension: `extensions/aftersale-thank-you` (Preact + `@shopify/ui-extensions` **2025.10**, not the old React package)

1. From the repo root: `npm install` (workspace includes `extensions/*`)
2. Confirm packages exist: `ls node_modules/@shopify/ui-extensions`
3. `shopify app deploy`
3. Shopify admin → **Settings → Checkout** → customize **Thank you** / **Order status**
4. **Add app block** → **AfterSale thank you**
5. Save

The button opens the hosted register form with the shop pre-filled.

If deploy fails on missing packages, run:

```bash
npm install -w aftersale-thank-you
shopify app deploy
```

## Why not classic cart drawer Liquid?

Checkout Extensibility replaced checkout.liquid. Cart drawers can use theme app blocks only if the theme section supports `@app` blocks; product opt-in + thank-you CTA is the reliable path.

## PCD note

Automatic warranty creation from the order still needs Protected Customer Data webhooks (see [PCD_WEBHOOKS.md](./PCD_WEBHOOKS.md)). Registration after purchase works without PCD.
