"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";

type ShopSettings = {
  brandingLogoUrl: string | null;
  brandingAccentColor: string | null;
  voidWarrantyOnRefund: boolean;
  timezone: string;
  shopDomain: string;
  shopName: string | null;
};

const QUERY = `#graphql
  query SettingsHome {
    home {
      shop {
        brandingLogoUrl
        brandingAccentColor
        voidWarrantyOnRefund
        timezone
        shopDomain
        shopName
      }
    }
  }
`;

export function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState("");
  const [accent, setAccent] = useState("#F59E0B");
  const [timezone, setTimezone] = useState("UTC");
  const [voidOnRefund, setVoidOnRefund] = useState(true);
  const [shopDomain, setShopDomain] = useState("");
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gqlRequest<{ home: { shop: ShopSettings } }>(QUERY)
      .then((d) => {
        setLogoUrl(d.home.shop.brandingLogoUrl ?? "");
        setAccent(d.home.shop.brandingAccentColor ?? "#F59E0B");
        setTimezone(d.home.shop.timezone ?? "UTC");
        setVoidOnRefund(d.home.shop.voidWarrantyOnRefund);
        setShopDomain(d.home.shop.shopDomain);
        setShopName(d.home.shop.shopName ?? d.home.shop.shopDomain);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await gqlRequest(
        `#graphql
        mutation SaveSettings(
          $logo: String
          $accent: String
          $timezone: String
          $voidWarrantyOnRefund: Boolean
        ) {
          updateShopSettings(
            brandingLogoUrl: $logo
            brandingAccentColor: $accent
            timezone: $timezone
            voidWarrantyOnRefund: $voidWarrantyOnRefund
          ) {
            id
            onboardingCompleted
            brandingAccentColor
          }
        }`,
        {
          logo: logoUrl || null,
          accent: accent || null,
          timezone,
          voidWarrantyOnRefund: voidOnRefund,
        },
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Page title="Customer pages">
        <div className="as-m-skeleton">
          <div className="as-m-skel as-m-skel-hero" />
          <div className="as-m-skel" style={{ height: 220, borderRadius: 18 }} />
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Customer pages"
      subtitle="Brand the portal, certificate, and claim experience"
      backAction={{ url: "/" }}
    >
      <Layout>
        <Layout.Section>
          <div className="as-m-hero">
            <div className="as-m-hero-grid" aria-hidden />
            <div className="as-m-hero-kicker">
              <span className="as-m-hero-dot" />
              Storefront experience
            </div>
            <h2>Make every warranty touch feel on-brand</h2>
            <p>
              Accent color and logo flow into the customer portal, registration, and claim pages —
              so aftercare matches your storefront.
            </p>
          </div>
        </Layout.Section>

        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        ) : null}
        {saved ? (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSaved(false)}>
              Customer page branding saved.
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section variant="oneHalf">
          <Card>
            <form onSubmit={onSave}>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Branding
                </Text>
                <FormLayout>
                  <TextField
                    label="Logo URL"
                    value={logoUrl}
                    onChange={setLogoUrl}
                    autoComplete="off"
                    helpText="Shown on warranty certificates and portal header"
                  />
                  <TextField
                    label="Accent color"
                    value={accent}
                    onChange={setAccent}
                    autoComplete="off"
                    helpText="Hex color used on customer highlights and CTAs"
                  />
                  <div className="as-m-color-swatch" style={{ background: accent || "#F59E0B" }} />
                  <TextField
                    label="Timezone"
                    value={timezone}
                    onChange={setTimezone}
                    autoComplete="off"
                  />
                  <label className="as-m-toggle">
                    <input
                      type="checkbox"
                      checked={voidOnRefund}
                      onChange={(e) => setVoidOnRefund(e.target.checked)}
                    />
                    <span>
                      <strong style={{ display: "block" }}>Void warranty on refund</strong>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        Keep coverage honest when orders are refunded
                      </span>
                    </span>
                  </label>
                  <Button submit variant="primary" loading={busy}>
                    Save customer pages
                  </Button>
                </FormLayout>
              </BlockStack>
            </form>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <div
            className="as-m-preview"
            style={{ ["--as-preview-accent" as string]: accent || "#F59E0B" }}
          >
            <div className="as-m-preview-bar">
              <i />
              <i />
              <i />
            </div>
            <div className="as-m-preview-body">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  style={{ height: 36, marginBottom: 14, objectFit: "contain" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
              <h4>{shopName || "Your store"} warranty portal</h4>
              <p>Look up coverage, register a product, or start a claim in seconds.</p>
              <span className="as-m-preview-cta">Open my warranties</span>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Preview on storefront
              </Text>
              <Text as="p" tone="subdued">
                Opens via app proxy on {shopDomain || "your shop"}.
              </Text>
              <BlockStack gap="200">
                <Button
                  url={`https://${shopDomain}/apps/aftersale/portal?shop=${encodeURIComponent(shopDomain)}`}
                  external
                >
                  Warranty portal
                </Button>
                <Button
                  url={`https://${shopDomain}/apps/aftersale/register?shop=${encodeURIComponent(shopDomain)}`}
                  external
                >
                  Registration page
                </Button>
                <Button
                  url={`https://${shopDomain}/apps/aftersale/claim?shop=${encodeURIComponent(shopDomain)}`}
                  external
                >
                  Claim form
                </Button>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
