/// <reference types="@shopify/ui-extensions" />

declare const shopify: {
  shop: {
    myshopifyDomain: string;
  };
  order?: {
    id?: string | number;
    name?: string;
    confirmationNumber?: string;
    email?: string;
  };
};
