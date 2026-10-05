# Theme blocks — storefront placement

## Recommended: one App embed (auto checkbox)

1. Online Store → Themes → **Customize**
2. Theme gear → **App embeds**
3. Enable **Warranty opt-in (auto)**
4. Save

That places a **clickable checkbox** next to Add to cart and near checkout on cart.
Checking it sets cart attribute `aftersale_register_intent=yes`. On order create, warranties
are created from your rules **automatically — no email confirmation**.

## Form embeds (portal / register / claim)

Theme editor often blocks third-party iframes. Blocks show a **simple preview card** (not a Mac
window) plus **Open live preview**. On the live storefront the iframe is fully interactive.

If you still see an old Mac-style frame, redeploy the theme extension — the store is serving a
cached old version.

## Broken links

Links must be `https://aftersale.tidyflowapp.com/...` — never `myshopify.com`. Current blocks
hardcode the hosted app origin.

## Logged-in customers

Portal/register embeds append `email=` when Shopify `customer` is logged in, so the form is
pre-filled. After email+order verify once, the portal lists orders to register from without
another email confirmation. Manual “bought elsewhere” still needs merchant verification.
