# Theme blocks — why you might not see them

Shopify **never auto-adds** theme app blocks. After deploy you must place or enable them.

## Fastest path (recommended)

1. `shopify app deploy` succeeds.
2. Online Store → Themes → **Customize**.
3. Left sidebar → **App embeds** (sometimes under the theme settings gear).
4. Enable **Warranty opt-in embed**.
5. Open a product page in the preview — the register checkbox appears under the buy form.

## Product page block

1. Customize → open the **Product** template.
2. Click the Product information section → **Add block**.
3. Under **Apps**, choose **Warranty register card**.
4. Save.

Or: Product template → **Add section** → **Apps**.

## If Apps is empty

- Confirm deploy released the `aftersale-theme` extension.
- App must be **installed** on that shop.
- Theme should be Online Store 2.0 (JSON templates). Vintage themes often lack Apps.
- Partners → Apps → AfterSale OS → Extensions → turn on **Development store preview** for dev stores.
- Hard-refresh the theme editor.

## Checkout

Liquid theme blocks **cannot** run on checkout. Use:

- Product-page opt-in (sets cart attribute `aftersale_register_intent`)
- Registration after purchase (portal / email / thank-you page extension later)

## Block names

| Name in editor | Type |
|----------------|------|
| Warranty opt-in embed | App embed (body) |
| Warranty register card | App block (product) |
| AfterSale register / claim / lookup | App blocks |
| AfterSale … embed | Iframe app blocks |
