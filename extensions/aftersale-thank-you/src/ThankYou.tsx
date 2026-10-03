import {
  reactExtension,
  Banner,
  BlockStack,
  Button,
  Text,
  useShop,
} from "@shopify/ui-extensions-react/checkout";

/**
 * Thank-you page block: "Register this product for warranty"
 * Enable: Checkout editor → Thank you → Add app block → AfterSale thank you
 */
export default reactExtension("purchase.thank-you.block.render", () => <ThankYouRegister />);

function ThankYouRegister() {
  const shop = useShop();
  const registerUrl = `https://aftersale.tidyflowapp.com/apps/aftersale/register?shop=${encodeURIComponent(shop.myshopifyDomain)}`;

  return (
    <Banner title="Register for warranty" status="info">
      <BlockStack spacing="base">
        <Text>
          Protect your purchase — register your product for warranty coverage. It only takes a
          minute.
        </Text>
        <Button to={registerUrl}>Register this product</Button>
      </BlockStack>
    </Banner>
  );
}
