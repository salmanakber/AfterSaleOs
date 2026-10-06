"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { friendlyError } from "@/lib/merchant-errors";
import { appHref } from "@/lib/shop-context";
import { clearSessionTokenCache, merchantAuthHeaders } from "@/lib/session-token";

type HomeShop = {
  shopName: string | null;
  shopDomain: string;
  needsPlanSelection: boolean;
  brandingLogoUrl: string | null;
  brandingAccentColor: string | null;
  plan: { name: string } | null;
};

type Rule = { id: string; name: string };

const HOME = `#graphql
  query SetupWizardHome {
    home {
      shop {
        shopName shopDomain needsPlanSelection
        brandingLogoUrl brandingAccentColor
        plan { name }
      }
      setupChecklist { id title href }
    }
    warrantyRules { id name }
  }
`;

const CREATE_RULE = `#graphql
  mutation CreateDefaultRule($input: CreateRuleInput!) {
    createWarrantyRule(input: $input) { id name }
  }
`;

const SAVE_SETTINGS = `#graphql
  mutation SaveBrand($logo: String, $accent: String) {
    updateShopSettings(brandingLogoUrl: $logo, brandingAccentColor: $accent) {
      brandingLogoUrl brandingAccentColor
    }
  }
`;

const STEPS = [
  { id: "welcome", title: "Welcome" },
  { id: "plan", title: "Plan" },
  { id: "brand", title: "Brand" },
  { id: "rule", title: "Coverage" },
  { id: "storefront", title: "Storefront" },
  { id: "done", title: "Done" },
] as const;

function appEmbedsUrl(shopDomain: string) {
  const store = shopDomain.replace(".myshopify.com", "");
  return `https://admin.shopify.com/store/${store}/themes/current/editor?context=apps`;
}

function checkoutEditorUrl(shopDomain: string) {
  const store = shopDomain.replace(".myshopify.com", "");
  return `https://admin.shopify.com/store/${store}/settings/checkout/editor`;
}

export function SetupWizardPage() {
  const [step, setStep] = useState(0);
  const [shop, setShop] = useState<HomeShop | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accent, setAccent] = useState("#3B82F6");
  const [logoUrl, setLogoUrl] = useState("");
  const [ruleName, setRuleName] = useState("Store warranty");
  const [duration, setDuration] = useState("12");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    gqlRequest<{
      home: { shop: HomeShop; setupChecklist: { id: string }[] };
      warrantyRules: Rule[];
    }>(HOME)
      .then((d) => {
        setShop(d.home.shop);
        setRules(d.warrantyRules);
        setAccent(d.home.shop.brandingAccentColor ?? "#3B82F6");
        setLogoUrl(d.home.shop.brandingLogoUrl ?? "");
      })
      .catch((e) => setError(friendlyError(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  async function uploadLogo(file: File) {
    setUploading(true);
    setError(null);
    try {
      clearSessionTokenCache();
      const headers = await merchantAuthHeaders();
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/merchant/branding/upload", { method: "POST", headers, body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setLogoUrl(json.url);
    } catch (e) {
      setError(friendlyError(e, "Logo upload failed"));
    } finally {
      setUploading(false);
    }
  }

  async function saveBrand() {
    setBusy(true);
    setError(null);
    try {
      clearSessionTokenCache();
      await gqlRequest(SAVE_SETTINGS, {
        logo: logoUrl || null,
        accent: accent || null,
      });
      setStep(3);
      load();
    } catch (e) {
      setError(friendlyError(e, "Could not save branding"));
    } finally {
      setBusy(false);
    }
  }

  async function createRule() {
    setBusy(true);
    setError(null);
    try {
      const months = duration.trim() === "" ? null : Number(duration);
      await gqlRequest(CREATE_RULE, {
        input: {
          name: ruleName || "Store warranty",
          priority: 100,
          version: {
            warrantyType: "store",
            durationMonths: months,
            startDateRule: "FULFILLMENT_DATE",
            serialMode: "NOT_REQUIRED",
            gracePeriodDays: 0,
            termsHtml: "<p>Standard store warranty terms.</p>",
          },
          assignments: [{ targetType: "default", targetId: null }],
        },
      });
      setStep(4);
      load();
    } catch (e) {
      setError(friendlyError(e, "Could not create rule"));
    } finally {
      setBusy(false);
    }
  }

  if (!shop) {
    return (
      <Page title="Setup">
        <Text as="p">{error ?? "Loading setup…"}</Text>
      </Page>
    );
  }

  const storeHandle = shop.shopDomain.replace(".myshopify.com", "");

  return (
    <Page
      title="Setup wizard"
      subtitle="Configure AfterSale in a few guided steps"
      backAction={{ url: appHref("/") }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  {STEPS[step]?.title}
                </Text>
                <Text as="span" tone="subdued">
                  Step {step + 1} of {STEPS.length}
                </Text>
              </InlineStack>
              <ProgressBar progress={progress} size="small" />
              <div className="as-m-wizard-steps">
                {STEPS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className="as-m-wizard-step"
                    data-active={i === step}
                    data-done={i < step}
                    onClick={() => setStep(i)}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {step === 0 ? (
                <>
                  <Text as="h3" variant="headingLg">
                    Welcome{shop.shopName ? `, ${shop.shopName}` : ""}
                  </Text>
                  <Text as="p" tone="subdued">
                    We’ll walk through plan, branding, warranty coverage, and where customers register
                    — product page, cart, and after checkout.
                  </Text>
                  <Button variant="primary" onClick={() => setStep(1)}>
                    Start setup
                  </Button>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <Text as="h3" variant="headingMd">
                    Choose your plan
                  </Text>
                  <Text as="p" tone="subdued">
                    {shop.plan
                      ? `You’re on ${shop.plan.name}. You can change this anytime.`
                      : "Select a plan to unlock warranties, claims, and storefront tools."}
                  </Text>
                  <InlineStack gap="200">
                    <Button url={appHref("/plans")} variant={shop.plan ? "secondary" : "primary"}>
                      {shop.plan ? "Manage plan" : "Choose a plan"}
                    </Button>
                    <Button variant="primary" onClick={() => setStep(2)} disabled={shop.needsPlanSelection && !shop.plan}>
                      Continue
                    </Button>
                  </InlineStack>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <Text as="h3" variant="headingMd">
                    Your brand on customer pages
                  </Text>
                  <Text as="p" tone="subdued">
                    Logo and accent color appear on hosted registration, claims, portal, and PDF
                    certificates. Theme Liquid blocks use their own colors in the theme editor.
                  </Text>
                  <FormLayout>
                    <div className="as-m-logo-picker">
                      <div className="as-m-logo-preview">
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoUrl} alt="Logo preview" />
                        ) : (
                          <span>No logo</span>
                        )}
                      </div>
                      <div className="as-m-logo-actions">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadLogo(f);
                            e.target.value = "";
                          }}
                        />
                        <Button loading={uploading} onClick={() => fileRef.current?.click()}>
                          {logoUrl ? "Replace logo" : "Upload logo"}
                        </Button>
                        {logoUrl ? (
                          <Button tone="critical" variant="plain" onClick={() => setLogoUrl("")}>
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="as-m-color-row">
                      <div style={{ flex: 1 }}>
                        <TextField label="Accent color" value={accent} onChange={setAccent} autoComplete="off" />
                      </div>
                      <label className="as-m-color-input" title="Pick color">
                        <input
                          type="color"
                          value={/^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : "#3B82F6"}
                          onChange={(e) => setAccent(e.target.value.toUpperCase())}
                        />
                      </label>
                    </div>
                  </FormLayout>
                  <div
                    className="as-m-preview"
                    style={{ ["--as-preview-accent" as string]: accent, maxWidth: 360 }}
                  >
                    <div className="as-m-preview-body">
                      <h4>{shop.shopName ?? "Your store"}</h4>
                      <p>Customer warranty experience preview</p>
                      <span className="as-m-preview-cta">Continue</span>
                    </div>
                  </div>
                  <InlineStack gap="200">
                    <Button onClick={() => setStep(1)}>Back</Button>
                    <Button variant="primary" loading={busy} onClick={() => void saveBrand()}>
                      Save & continue
                    </Button>
                  </InlineStack>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <Text as="h3" variant="headingMd">
                    Default warranty coverage
                  </Text>
                  <Text as="p" tone="subdued">
                    {rules.length > 0
                      ? `You already have ${rules.length} rule${rules.length === 1 ? "" : "s"} (e.g. ${rules[0]?.name}). You can skip or create another.`
                      : "Create a default rule so new orders and registrations get coverage."}
                  </Text>
                  <FormLayout>
                    <TextField label="Rule name" value={ruleName} onChange={setRuleName} autoComplete="off" />
                    <TextField
                      label="Duration (months, blank = lifetime)"
                      value={duration}
                      onChange={setDuration}
                      autoComplete="off"
                    />
                  </FormLayout>
                  <InlineStack gap="200">
                    <Button onClick={() => setStep(2)}>Back</Button>
                    {rules.length > 0 ? (
                      <Button onClick={() => setStep(4)}>Skip</Button>
                    ) : null}
                    <Button variant="primary" loading={busy} onClick={() => void createRule()}>
                      {rules.length > 0 ? "Create another rule" : "Create rule & continue"}
                    </Button>
                  </InlineStack>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <Text as="h3" variant="headingMd">
                    Show the warranty checkbox on your store
                  </Text>
                  <Text as="p" tone="subdued">
                    Enable one App embed — it appears next to Add to cart and again on the cart near
                    checkout. Then add the thank-you prompt after payment.
                  </Text>
                  <div className="as-m-way-grid">
                    <div className="as-m-way-card" style={{ cursor: "default" }}>
                      <span className="as-m-way-num">01</span>
                      <strong>Product + cart (auto)</strong>
                      <p>
                        Theme gear → App embeds → enable <em>Warranty opt-in (auto)</em>. Set your
                        own title and colors — no block to place on each page.
                      </p>
                      <Button url={appEmbedsUrl(shop.shopDomain)} target="_blank" variant="primary">
                        Open App embeds
                      </Button>
                    </div>
                    <div className="as-m-way-card" style={{ cursor: "default" }}>
                      <span className="as-m-way-num">02</span>
                      <strong>After checkout</strong>
                      <p>
                        Checkout editor → Thank you → add <em>AfterSale thank you</em> so customers
                        can register after the order.
                      </p>
                      <Button url={checkoutEditorUrl(shop.shopDomain)} target="_blank">
                        Open checkout editor
                      </Button>
                    </div>
                  </div>
                  <InlineStack gap="200">
                    <Button onClick={() => setStep(3)}>Back</Button>
                    <Button variant="primary" onClick={() => setStep(5)}>
                      Continue
                    </Button>
                  </InlineStack>
                </>
              ) : null}

              {step === 5 ? (
                <>
                  <Text as="h3" variant="headingLg">
                    You’re ready
                  </Text>
                  <Text as="p" tone="subdued">
                    Branding, coverage, and storefront entry points are set. You can refine anytime from
                    the sidebar.
                  </Text>
                  <InlineStack gap="200">
                    <Button variant="primary" url={appHref("/")}>
                      Go to home
                    </Button>
                    <Button url={appHref("/settings")}>Customer pages</Button>
                    <Button url={appHref("/warranties")}>Warranties</Button>
                    <Button
                      url={`https://admin.shopify.com/store/${storeHandle}/themes/current/editor`}
                      target="_blank"
                    >
                      Customize theme
                    </Button>
                  </InlineStack>
                </>
              ) : null}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
