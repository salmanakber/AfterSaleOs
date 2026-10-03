"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  FormLayout,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { clearSessionTokenCache, merchantAuthHeaders } from "@/lib/session-token";
import { TourTrigger, useOptionalTour } from "./ProductTour";

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
  return (
    (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

function openOutsideAdmin(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

type PreviewKind = "portal" | "register" | "claim";

export function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [accent, setAccent] = useState("#3B82F6");
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
  const [activeTab, setActiveTab] = useState<"brand" | "share" | "embed" | "preview" | "guide">("guide");
  const [previewKind, setPreviewKind] = useState<PreviewKind>("portal");
  const [embedHeight, setEmbedHeight] = useState(720);
  const tour = useOptionalTour();

  useEffect(() => {
    if (!tour) return;
    tour.setTabHandler((tab) => {
      if (tab === "brand" || tab === "share" || tab === "embed" || tab === "preview" || tab === "guide") {
        setActiveTab(tab);
      }
    });
    return () => tour.setTabHandler(null);
  }, [tour]);

  useEffect(() => {
    gqlRequest<{ home: { shop: ShopSettings } }>(QUERY)
      .then((d) => {
        setLogoUrl(d.home.shop.brandingLogoUrl ?? "");
        setAccent(d.home.shop.brandingAccentColor ?? "#3B82F6");
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
      `<iframe\n  src="${src}&embed=1"\n  title="${title}"\n  style="width:100%;min-height:${embedHeight}px;border:0;border-radius:12px;"\n  loading="lazy"\n  allow="clipboard-write"\n></iframe>`;
    return {
      portal: frame(hosted.portal, "Warranty portal"),
      register: frame(hosted.register, "Warranty registration"),
      claim: frame(hosted.claim, "Warranty claim"),
    };
  }, [hosted, embedHeight]);

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
        const headers = await merchantAuthHeaders();
        delete headers["Content-Type"];
        const fd = new FormData();
        fd.append("file", file);
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
      window.setTimeout(() => setCopied(null), 1600);
    });
  }

  if (loading) {
    return (
      <Page title="Customer pages">
        <div className="as-m-skeleton">
          <div className="as-m-skel as-m-skel-hero" />
          <div className="as-m-skel" style={{ height: 240, borderRadius: 12 }} />
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Customer pages"
      subtitle="Brand, share, preview, and embed warranty experiences"
      backAction={{ url: "/" }}
    >
      <div className="as-m-hero">
        <div className="as-m-hero-kicker">
          <span className="as-m-hero-dot" />
          Storefront & embed
        </div>
        <h2>Customer experience kit</h2>
        <p>
          One branding kit. Three ways to publish: Shopify theme blocks (Liquid), iframe embeds, or
          shareable links.
        </p>
        <div className="as-m-hero-actions">
          <button type="button" className="as-m-chip as-m-chip-accent" onClick={() => openOutsideAdmin(hosted.portal)}>
            Open portal
          </button>
          <button type="button" className="as-m-chip" onClick={() => setActiveTab("guide")}>
            How it works
          </button>
          <button type="button" className="as-m-chip" onClick={() => setActiveTab("preview")}>
            Live preview
          </button>
          <TourTrigger tourId="customer-pages" label="Take customer pages tour" />
        </div>
      </div>

      {error ? (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        </div>
      ) : null}
      {saved ? (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="success" onDismiss={() => setSaved(false)}>
            Settings saved.
          </Banner>
        </div>
      ) : null}

      <div className="as-m-tabs">
        {(
          [
            ["guide", "How it works"],
            ["brand", "Branding"],
            ["share", "Share & Liquid"],
            ["embed", "Embed code"],
            ["preview", "Live preview"],
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

      {activeTab === "guide" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }} data-tour="cx-ways">
          <div className="as-m-panel-title">
            <h3>How Liquid & embeds work</h3>
            <TourTrigger tourId="customer-pages" className="as-m-chip as-m-chip-accent" />
          </div>
          <p className="as-m-guide-lead">
            Customers always use the same AfterSale pages (portal, register, claim). You choose{" "}
            <strong>where</strong> those pages appear.
          </p>
          <div className="as-m-way-grid">
            <button type="button" className="as-m-way-card" onClick={() => setActiveTab("share")} data-tour="cx-liquid">
              <span className="as-m-way-num">01</span>
              <strong>Shopify theme blocks</strong>
              <p>
                After <code>shopify app deploy</code>, enable <em>App embeds</em> (easiest) or add an
                Apps block on the product template. Includes the warranty checkbox card.
              </p>
              <ul>
                <li>Warranty opt-in embed (App embeds toggle)</li>
                <li>Warranty register card (product Add block)</li>
                <li>Register / claim / lookup buttons &amp; iframes</li>
              </ul>
              <span className="as-m-way-cta">Open Share &amp; Liquid →</span>
            </button>
            <button type="button" className="as-m-way-card" onClick={() => setActiveTab("embed")} data-tour="cx-embed">
              <span className="as-m-way-num">02</span>
              <strong>Embed iframe code</strong>
              <p>
                Copy HTML into a custom page, help center, or landing builder. Uses{" "}
                <code>embed=1</code> for a compact chrome-free layout.
              </p>
              <ul>
                <li>Works outside Shopify theme</li>
                <li>Same branding as hosted pages</li>
              </ul>
              <span className="as-m-way-cta">Get embed code →</span>
            </button>
            <button type="button" className="as-m-way-card" onClick={() => setActiveTab("share")}>
              <span className="as-m-way-num">03</span>
              <strong>Share links</strong>
              <p>
                Hosted URLs always work. Storefront proxy URLs (
                <code>/apps/aftersale/…</code>) keep customers on your shop domain.
              </p>
              <ul>
                <li>Email, SMS, QR packaging</li>
                <li>Support macros &amp; order notes</li>
              </ul>
              <span className="as-m-way-cta">Copy links →</span>
            </button>
          </div>
          <div className="as-m-flow">
            <div className="as-m-flow-step">
              <strong>Brand</strong>
              <span>Logo + accent</span>
            </div>
            <span className="as-m-flow-arrow" aria-hidden>
              →
            </span>
            <div className="as-m-flow-step">
              <strong>Publish</strong>
              <span>Liquid / embed / link</span>
            </div>
            <span className="as-m-flow-arrow" aria-hidden>
              →
            </span>
            <div className="as-m-flow-step">
              <strong>Customer</strong>
              <span>Register · claim · portal</span>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "brand" ? (
        <div className="as-m-settings-grid" style={{ marginTop: 14 }} data-tour="cx-brand">
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
                    Upload to Cloudinary (PNG, JPG, WEBP, GIF, SVG · max 5MB).
                  </Text>
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
                </div>

                <FormLayout>
                  <div className="as-m-color-row">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Accent color"
                        value={accent}
                        onChange={setAccent}
                        autoComplete="off"
                      />
                    </div>
                    <label className="as-m-color-input" title="Pick color">
                      <input
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : "#3B82F6"}
                        onChange={(e) => setAccent(e.target.value.toUpperCase())}
                      />
                    </label>
                  </div>
                  <div className="as-m-color-swatch" style={{ background: accent || "#3B82F6" }} />
                  <TextField label="Timezone" value={timezone} onChange={setTimezone} autoComplete="off" />
                  <label className="as-m-toggle">
                    <input
                      type="checkbox"
                      checked={voidOnRefund}
                      onChange={(e) => setVoidOnRefund(e.target.checked)}
                    />
                    <span>
                      <strong style={{ display: "block", fontSize: 13 }}>Void warranty on refund</strong>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        Keep coverage aligned with refunded orders
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

          <div>
            <div
              className="as-m-preview"
              style={{ ["--as-preview-accent" as string]: accent || "#3B82F6" }}
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
                    style={{ height: 36, marginBottom: 12, objectFit: "contain", maxWidth: "70%" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : null}
                <h4>{shopName || "Your store"} warranty portal</h4>
                <p>Look up coverage, register a product, or start a claim.</p>
                <span className="as-m-preview-cta">Open my warranties</span>
              </div>
            </div>
            <p className="as-m-hint">Instant brand preview. Use Live preview for the real pages.</p>
          </div>
        </div>
      ) : null}

      {activeTab === "share" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }} data-tour="cx-liquid">
          <div className="as-m-panel-title">
            <h3>Share links & theme blocks</h3>
          </div>
          <Text as="p" tone="subdued">
            Hosted links always work. Storefront links need the app proxy from{" "}
            <code>shopify app deploy</code>.
          </Text>

          <div className="as-m-liquid-guide">
            <strong>Where to find AfterSale in the theme editor</strong>
            <ol>
              <li>
                Deploy first: <code>shopify app deploy</code> (blocks only appear after a successful
                release).
              </li>
              <li>
                <strong>Easiest — App embeds:</strong> Customize theme → left sidebar gear /{" "}
                <em>App embeds</em> → enable <strong>Warranty opt-in embed</strong>. Shows the
                checkbox on product pages automatically.
              </li>
              <li>
                <strong>Or Add block:</strong> open a <em>Product</em> template → Product information
                → <strong>Add block</strong> → <strong>Apps</strong> →{" "}
                <strong>Warranty register card</strong>.
              </li>
              <li>
                <strong>Or Add section:</strong> Product template → <strong>Add section</strong> →{" "}
                <strong>Apps</strong> → AfterSale blocks.
              </li>
              <li>
                Partners → your app → Extensions → turn on <em>Development store preview</em> if
                blocks still missing on a dev store.
              </li>
            </ol>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#1e3a8a" }}>
              Checkout pages cannot use Liquid theme blocks. Use the product-page opt-in (cart note)
              plus registration after purchase / thank-you email for now.
            </p>
          </div>

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
        </div>
      ) : null}

      {activeTab === "embed" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }} data-tour="cx-embed">
          <div className="as-m-panel-title">
            <h3>Embed anywhere</h3>
          </div>
          <Text as="p" tone="subdued">
            Paste into Shopify custom HTML, help centers, or landing builders. Compact mode uses{" "}
            <code>embed=1</code>. Prefer theme embed blocks when staying inside Online Store.
          </Text>
          <div style={{ marginTop: 12, maxWidth: 280 }}>
            <TextField
              label="Iframe height (px)"
              type="number"
              value={String(embedHeight)}
              onChange={(v) => setEmbedHeight(Math.max(400, Number(v) || 720))}
              autoComplete="off"
            />
          </div>
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
                    {copied === `embed-${key}` ? "Copied" : "Copy embed"}
                  </Button>
                  <Button
                    size="slim"
                    onClick={() => {
                      setPreviewKind(key);
                      setActiveTab("preview");
                    }}
                  >
                    Preview
                  </Button>
                </InlineStack>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "preview" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }} data-tour="cx-preview">
          <div className="as-m-panel-title">
            <h3>Live preview</h3>
            <InlineStack gap="200">
              {(
                [
                  ["portal", "Portal"],
                  ["register", "Register"],
                  ["claim", "Claim"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  size="slim"
                  variant={previewKind === id ? "primary" : "secondary"}
                  onClick={() => setPreviewKind(id)}
                >
                  {label}
                </Button>
              ))}
              <Button size="slim" onClick={() => openOutsideAdmin(`${hosted[previewKind]}&embed=1`)}>
                Open tab
              </Button>
            </InlineStack>
          </div>
          <iframe
            className="as-m-iframe-preview"
            title={`Preview ${previewKind}`}
            src={`${hosted[previewKind]}&embed=1`}
          />
          <p className="as-m-hint">
            Preview loads the hosted customer page with your branding. Save branding first if you just
            changed the logo.
          </p>
        </div>
      ) : null}
    </Page>
  );
}
