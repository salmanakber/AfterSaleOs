"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { getSessionToken, clearSessionTokenCache } from "@/lib/session-token";

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

function appBase() {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : "");
}

function openOutsideAdmin(url: string) {
  // App Bridge intercepts Polaris Button urls → Shopify admin 404.
  // Always break out of the iframe for storefront / hosted customer pages.
  window.open(url, "_blank", "noopener,noreferrer");
}

export function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [accent, setAccent] = useState("#F59E0B");
  const [timezone, setTimezone] = useState("UTC");
  const [voidOnRefund, setVoidOnRefund] = useState(true);
  const [shopDomain, setShopDomain] = useState("");
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"brand" | "share" | "embed">("brand");

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

  const hosted = useMemo(() => {
    const base = appBase();
    const q = `shop=${encodeURIComponent(shopDomain)}`;
    return {
      portal: `${base}/apps/aftersale/portal?${q}`,
      register: `${base}/apps/aftersale/register?${q}`,
      claim: `${base}/apps/aftersale/claim?${q}`,
    };
  }, [shopDomain]);

  const storefront = useMemo(() => {
    const q = `shop=${encodeURIComponent(shopDomain)}`;
    return {
      portal: `https://${shopDomain}/apps/aftersale/portal?${q}`,
      register: `https://${shopDomain}/apps/aftersale/register?${q}`,
      claim: `https://${shopDomain}/apps/aftersale/claim?${q}`,
    };
  }, [shopDomain]);

  const embeds = useMemo(() => {
    const frame = (src: string, title: string) =>
      `<iframe src="${src}&embed=1" title="${title}" style="width:100%;min-height:720px;border:0;border-radius:16px;overflow:hidden;" loading="lazy" allow="clipboard-write"></iframe>`;
    return {
      portal: frame(hosted.portal, "Warranty portal"),
      register: frame(hosted.register, "Warranty registration"),
      claim: frame(hosted.claim, "Warranty claim"),
    };
  }, [hosted]);

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

  const uploadLogo = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      async function once() {
        const token = await getSessionToken();
        const fd = new FormData();
        fd.append("file", file);
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const shop = new URLSearchParams(window.location.search).get("shop");
        if (shop) headers["x-aftersale-shop"] = shop;
        return fetch("/api/merchant/branding/upload", { method: "POST", headers, body: fd });
      }
      let res = await once();
      if (res.status === 401) {
        clearSessionTokenCache();
        res = await once();
      }
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      if (json.url) setLogoUrl(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  function copyText(key: string, value: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    });
  }

  if (loading) {
    return (
      <Page title="Customer pages">
        <div className="as-m-skeleton">
          <div className="as-m-skel as-m-skel-hero" />
          <div className="as-m-skel" style={{ height: 280, borderRadius: 18 }} />
        </div>
      </Page>
    );
  }

  return (
    <Page title="Customer pages" subtitle="Brand, share, and embed warranty experiences" backAction={{ url: "/" }}>
      <Layout>
        <Layout.Section>
          <div className="as-m-hero">
            <div className="as-m-hero-grid" aria-hidden />
            <div className="as-m-hero-kicker">
              <span className="as-m-hero-dot" />
              Customer experience
            </div>
            <h2>Pages your buyers actually use</h2>
            <p>
              Portal, registration, and claims — branded for {shopName || "your store"}, shareable on your
              storefront, or embedded anywhere with an iframe.
            </p>
            <div className="as-m-hero-actions">
              <button type="button" className="as-m-chip as-m-chip-accent" onClick={() => openOutsideAdmin(hosted.portal)}>
                Preview portal
              </button>
              <button type="button" className="as-m-chip" onClick={() => openOutsideAdmin(hosted.register)}>
                Preview register
              </button>
              <button type="button" className="as-m-chip" onClick={() => openOutsideAdmin(hosted.claim)}>
                Preview claim
              </button>
            </div>
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
              Customer page settings saved.
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <div className="as-m-tabs">
            {(
              [
                ["brand", "Branding"],
                ["share", "Share links"],
                ["embed", "Embed anywhere"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="as-m-tab"
                data-active={activeTab === id}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </Layout.Section>

        {activeTab === "brand" ? (
          <>
            <Layout.Section variant="oneHalf">
              <div className="as-m-panel">
                <div className="as-m-panel-title">
                  <h3>Brand kit</h3>
                </div>
                <form onSubmit={onSave}>
                  <BlockStack gap="400">
                    <div>
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        Logo
                      </Text>
                      <Text as="p" tone="subdued">
                        Upload PNG, JPG, WEBP, GIF, or SVG (max 5MB). Stored on Cloudinary.
                      </Text>
                      <div className="as-m-logo-picker">
                        <div className="as-m-logo-preview">
                          {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt="Logo preview" />
                          ) : (
                            <span>No logo yet</span>
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
                            <Button
                              tone="critical"
                              variant="plain"
                              onClick={() => setLogoUrl("")}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <FormLayout>
                      <div className="as-m-color-row">
                        <div style={{ flex: 1 }}>
                          <TextField
                            label="Accent color"
                            value={accent}
                            onChange={setAccent}
                            autoComplete="off"
                            helpText="Used on customer highlights and CTAs"
                          />
                        </div>
                        <label className="as-m-color-input" title="Pick color">
                          <input
                            type="color"
                            value={/^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : "#F59E0B"}
                            onChange={(e) => setAccent(e.target.value.toUpperCase())}
                          />
                        </label>
                      </div>
                      <div className="as-m-color-swatch" style={{ background: accent || "#F59E0B" }} />
                      <TextField label="Timezone" value={timezone} onChange={setTimezone} autoComplete="off" />
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
                        Save branding
                      </Button>
                    </FormLayout>
                  </BlockStack>
                </form>
              </div>
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
                      style={{ height: 40, marginBottom: 14, objectFit: "contain", maxWidth: "70%" }}
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
              <p className="as-m-hint">
                Live preview uses your logo + accent. Open a full page with the buttons above — opens outside
                Shopify Admin so you never hit a fake 404.
              </p>
            </Layout.Section>
          </>
        ) : null}

        {activeTab === "share" ? (
          <Layout.Section>
            <div className="as-m-panel">
              <div className="as-m-panel-title">
                <h3>Share links</h3>
              </div>
              <Text as="p" tone="subdued">
                <strong>Hosted</strong> links always work (open on AfterSale).{" "}
                <strong>Storefront</strong> links use your shop domain via app proxy — run{" "}
                <code>shopify app deploy</code> once so `/apps/aftersale/*` is installed on the store.
              </Text>
              <div className="as-m-link-grid">
                {(
                  [
                    ["Portal", "portal"],
                    ["Registration", "register"],
                    ["Claim form", "claim"],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className="as-m-link-card">
                    <strong>{label}</strong>
                    <div className="as-m-link-row">
                      <span className="as-m-link-label">Hosted</span>
                      <code>{hosted[key]}</code>
                      <InlineStack gap="200">
                        <Button size="slim" onClick={() => openOutsideAdmin(hosted[key])}>
                          Open
                        </Button>
                        <Button size="slim" onClick={() => copyText(`${key}-h`, hosted[key])}>
                          {copied === `${key}-h` ? "Copied" : "Copy"}
                        </Button>
                      </InlineStack>
                    </div>
                    <div className="as-m-link-row">
                      <span className="as-m-link-label">Storefront</span>
                      <code>{storefront[key]}</code>
                      <InlineStack gap="200">
                        <Button size="slim" onClick={() => openOutsideAdmin(storefront[key])}>
                          Open
                        </Button>
                        <Button size="slim" onClick={() => copyText(`${key}-s`, storefront[key])}>
                          {copied === `${key}-s` ? "Copied" : "Copy"}
                        </Button>
                      </InlineStack>
                    </div>
                  </div>
                ))}
              </div>
              <div className="as-m-callout">
                Theme editor: add <strong>AfterSale register / lookup / claim</strong> blocks from the theme app
                extension for on-brand product and footer entry points.
              </div>
            </div>
          </Layout.Section>
        ) : null}

        {activeTab === "embed" ? (
          <Layout.Section>
            <div className="as-m-panel">
              <div className="as-m-panel-title">
                <h3>Embed anywhere</h3>
              </div>
              <Text as="p" tone="subdued">
                Paste these iframes into a Shopify page, landing page builder, help center, or any site that
                allows embeds. Compact chrome via <code>embed=1</code>.
              </Text>
              <div className="as-m-link-grid">
                {(
                  [
                    ["Warranty portal", "portal"],
                    ["Registration", "register"],
                    ["Claim form", "claim"],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className="as-m-link-card">
                    <strong>{label}</strong>
                    <pre className="as-m-embed-code">{embeds[key]}</pre>
                    <InlineStack gap="200">
                      <Button
                        size="slim"
                        variant="primary"
                        onClick={() => copyText(`embed-${key}`, embeds[key])}
                      >
                        {copied === `embed-${key}` ? "Copied" : "Copy embed code"}
                      </Button>
                      <Button size="slim" onClick={() => openOutsideAdmin(`${hosted[key]}&embed=1`)}>
                        Preview embed
                      </Button>
                    </InlineStack>
                  </div>
                ))}
              </div>
            </div>
          </Layout.Section>
        ) : null}
      </Layout>
    </Page>
  );
}
