# Checkout, cart & product warranty placement

Liquid theme blocks **cannot** run on Shopify Checkout. AfterSale uses these surfaces:

| Place | What we ship | How to enable |
|-------|----------------|---------------|
| **Product page** | Warranty register card (checkbox, banner, or button) | Theme editor → Product → Add block / App embeds |
| **Cart** | Same Warranty register card on the cart template | Theme editor → Cart → Add block → Apps |
| **Thank you page** | Checkout UI block “Register this product” | Checkout editor → Thank you → Add app block → AfterSale thank you |

The product/cart opt-in can also set cart attribute `aftersale_register_intent` when the customer checks the box.

## Thank you page (order confirmed)

Extension: `extensions/aftersale-thank-you`

1. From the repo root: `npm install` (workspace includes `extensions/*`)
2. Redeploy the app so the thank-you extension is available
3. Shopify admin → **Settings → Checkout** → customize **Thank you** / **Order status**
4. **Add app block** → **AfterSale thank you**
5. Save

The button opens the hosted register form with the shop pre-filled.

## Brand customization

- **Customer pages** (logo + accent): portal, registration, claims, embeds, PDF certificates
- **Theme block settings**: style, accent color, background, corner radius, and copy for the storefront opt-in

## PCD note

Automatic warranty creation from the order still needs Protected Customer Data webhooks (see [PCD_WEBHOOKS.md](./PCD_WEBHOOKS.md)). Registration after purchase works without PCD.
