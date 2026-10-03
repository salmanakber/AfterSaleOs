# Checkout & cart warranty registration

Liquid theme blocks **cannot** run on Shopify Checkout. AfterSale uses these surfaces:

| Place | What we ship | How to enable |
|-------|----------------|---------------|
| **Product page** | Warranty register card / opt-in checkbox | Theme editor → Product → Add block / App embeds |
| **Thank you page** | Checkout UI block “Register this product” | After `shopify app deploy` → Checkout editor → Thank you → Add app block |
| **Cart** | Optional cart attribute `aftersale_register_intent` from product opt-in | Automatic when customer checks the product-page box |

## Thank you page (order confirmed)

Extension: `extensions/aftersale-thank-you`

1. `shopify app deploy`
2. Shopify admin → **Settings → Checkout** → customize **Thank you** / **Order status**
3. **Add app block** → **AfterSale thank you**
4. Save

The button opens the hosted register form with the shop pre-filled.

## Why not classic cart drawer Liquid?

Checkout Extensibility replaced checkout.liquid. Cart drawers can use theme app blocks only if the theme section supports `@app` blocks; product opt-in + thank-you CTA is the reliable path.

## PCD note

Automatic warranty creation from the order still needs Protected Customer Data webhooks (see [PCD_WEBHOOKS.md](./PCD_WEBHOOKS.md)). Registration after purchase works without PCD.
