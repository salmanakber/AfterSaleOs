# Theme blocks — storefront placement

## Recommended: one App embed (auto)

Shopify never injects theme UI without merchant consent. Closest to “automatic”:

1. Online Store → Themes → **Customize**
2. Theme gear → **App embeds**
3. Enable **Warranty opt-in (auto)**
4. Set title / colors / style → **Save**

That places a clickable checkbox **next to Add to cart** on product pages and **near checkout** on the cart. No need to add a block on each template.

## Optional: manual block

**Warranty register card** can still be added on Product or Cart if you want a specific spot. Prefer the App embed for most stores.

## Form embeds (portal / register / claim)

These are live iframes. Theme editor shows a short note + “Preview” link — no fake Mac window chrome. Customers interact with the real form on the storefront.

## Checkout

Liquid cannot run on checkout payment. Use:

- Product / cart opt-in (auto embed)
- Thank-you page app block after purchase

## Hosted origin

Links and iframes use the hosted AfterSale app. Blocks no longer expose an App URL setting.
