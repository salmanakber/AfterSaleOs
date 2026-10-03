import "@shopify/ui-extensions/preact";
import { render } from "preact";

/**
 * Thank-you page: Register this product for warranty.
 * Enable in Checkout editor → Thank you → Add app block → AfterSale thank you
 */
export default async function extension() {
  render(<ThankYouRegister />, document.body);
}

function ThankYouRegister() {
  const shopDomain = shopify.shop.myshopifyDomain;
  const registerUrl = `https://aftersale.tidyflowapp.com/apps/aftersale/register?shop=${encodeURIComponent(shopDomain)}`;

  return (
    <s-banner heading="Register for warranty" tone="info">
      <s-stack direction="block" gap="base">
        <s-text>
          Protect your purchase — register your product for warranty coverage. It only takes a
          minute.
        </s-text>
        <s-button href={registerUrl} target="_blank">
          Register this product
        </s-button>
      </s-stack>
    </s-banner>
  );
}
