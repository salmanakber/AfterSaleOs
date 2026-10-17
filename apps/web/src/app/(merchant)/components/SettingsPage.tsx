"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  Banner,
  Button,
  FormLayout,
  Icon,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { gqlRequest } from "@/lib/graphql";
import { appHref } from "@/lib/shop-context";
import { clearSessionTokenCache, merchantAuthHeaders } from "@/lib/session-token";
import { TourTrigger, useOptionalTour } from "./ProductTour";
import { BrandingStudio, LiveCustomerPreview } from "./BrandingStudio";

type ShopSettings = {
  brandingLogoUrl: string | null;
  brandingAccentColor: string | null;
  brandingBgColor: string | null;
  brandingSurfaceColor: string | null;
  brandingTextColor: string | null;
  brandingFont: string | null;
  brandingRadius: number | null;
  brandingButtonStyle: string | null;
  brandingHeroStyle: string | null;
  voidWarrantyOnRefund: boolean;
  warrantyOptInRequired: boolean;
  warrantyOptInUiEnabled: boolean;
  warrantyFeeEnabled: boolean;
  warrantyFeeVariantId: string | null;
  warrantyFeeLabel: string | null;
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
        brandingBgColor
        brandingSurfaceColor
        brandingTextColor
        brandingFont
        brandingRadius
        brandingButtonStyle
        brandingHeroStyle
        voidWarrantyOnRefund
        warrantyOptInRequired
        warrantyOptInUiEnabled
        warrantyFeeEnabled
        warrantyFeeVariantId
        warrantyFeeLabel
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
  const [logoUrl, setLogoUrl] = useState("");
  const [accent, setAccent] = useState("#3B82F6");
  const [bgColor, setBgColor] = useState("#F4F6FB");
  const [surfaceColor, setSurfaceColor] = useState("#FFFFFF");
  const [textColor, setTextColor] = useState("#0F172A");
  const [font, setFont] = useState("sans");
  const [radius, setRadius] = useState("22");
  const [buttonStyle, setButtonStyle] = useState("solid");
  const [heroStyle, setHeroStyle] = useState("bold");
  const [timezone, setTimezone] = useState("UTC");
  const [voidOnRefund, setVoidOnRefund] = useState(true);
  const [optInRequired, setOptInRequired] = useState(false);
  const [optInUiEnabled, setOptInUiEnabled] = useState(true);
  const [feeEnabled, setFeeEnabled] = useState(false);
  const [feeVariantId, setFeeVariantId] = useState("");
  const [feeLabel, setFeeLabel] = useState("Product warranty registration");
  const [feeSearch, setFeeSearch] = useState("");
  const [feeOptions, setFeeOptions] = useState<{ value: string; label: string }[]>([]);
  const [feeSelectedLabel, setFeeSelectedLabel] = useState("");
  const [feeSearchBusy, setFeeSearchBusy] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "brand" | "share" | "embed" | "preview" | "guide" | "placement" | "warranty"
  >("brand");
  const [studioOpen, setStudioOpen] = useState(false);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("portal");
  const [canvaPage, setCanvaPage] = useState<"portal" | "register" | "claim">("portal");
  const [embedHeight, setEmbedHeight] = useState(720);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const tour = useOptionalTour();

  useEffect(() => {
    if (!tour) return;
    tour.setTabHandler((tab) => {
      if (
        tab === "brand" ||
        tab === "share" ||
        tab === "embed" ||
        tab === "preview" ||
        tab === "guide" ||
        tab === "placement" ||
        tab === "warranty"
      ) {
        setActiveTab(tab);
      }
    });
    return () => tour.setTabHandler(null);
  }, [tour]);

  const storeHandle = shopDomain.replace(".myshopify.com", "");
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";
  function themeEditorUrl(template: "product" | "cart" = "product") {
    if (apiKey && storeHandle) {
      return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?template=${template}&addAppBlockId=${apiKey}/register-optin&target=mainSection`;
    }
    return storeHandle
      ? `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?template=${template}`
      : "#";
  }
  function appEmbedsUrl() {
    return storeHandle
      ? `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?context=apps`
      : "#";
  }
  function checkoutEditorUrl() {
    return storeHandle
      ? `https://admin.shopify.com/store/${storeHandle}/settings/checkout/editor`
      : "#";
  }

  useEffect(() => {
    gqlRequest<{ home: { shop: ShopSettings } }>(QUERY)
      .then((d) => {
        setLogoUrl(d.home.shop.brandingLogoUrl ?? "");
        setAccent(d.home.shop.brandingAccentColor ?? "#3B82F6");
        setBgColor(d.home.shop.brandingBgColor ?? "#F4F6FB");
        setSurfaceColor(d.home.shop.brandingSurfaceColor ?? "#FFFFFF");
        setTextColor(d.home.shop.brandingTextColor ?? "#0F172A");
        setFont(d.home.shop.brandingFont ?? "sans");
        setRadius(String(d.home.shop.brandingRadius ?? 22));
        setButtonStyle(d.home.shop.brandingButtonStyle ?? "solid");
        setHeroStyle(d.home.shop.brandingHeroStyle ?? "bold");
        setTimezone(d.home.shop.timezone ?? "UTC");
        setVoidOnRefund(d.home.shop.voidWarrantyOnRefund);
        setOptInRequired(Boolean(d.home.shop.warrantyOptInRequired));
        setOptInUiEnabled(d.home.shop.warrantyOptInUiEnabled !== false);
        setFeeEnabled(Boolean(d.home.shop.warrantyFeeEnabled));
        setFeeVariantId(d.home.shop.warrantyFeeVariantId ?? "");
        setFeeLabel(d.home.shop.warrantyFeeLabel ?? "Product warranty registration");
        if (d.home.shop.warrantyFeeVariantId) {
          setFeeSelectedLabel(`Variant ${d.home.shop.warrantyFeeVariantId}`);
        }
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

  useEffect(() => {
    if (!feeEnabled) return;
    const q = feeSearch.trim();
    const handle = window.setTimeout(() => {
      setFeeSearchBusy(true);
      gqlRequest<{
        feeProductOptions: Array<{
          shopifyVariantId: string;
          label: string;
        }>;
      }>(
        `#graphql
        query FeeProducts($query: String) {
          feeProductOptions(query: $query, limit: 25) {
            shopifyVariantId
            label
          }
        }`,
        { query: q || null },
      )
        .then((d) => {
          setFeeOptions(
            d.feeProductOptions.map((o) => ({
              value: o.shopifyVariantId,
              label: o.label,
            })),
          );
        })
        .catch(() => setFeeOptions([]))
        .finally(() => setFeeSearchBusy(false));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [feeSearch, feeEnabled]);

  async function onSavePreferences(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await gqlRequest(
        `#graphql
        mutation SavePrefs(
          $timezone: String
          $voidWarrantyOnRefund: Boolean
          $warrantyOptInRequired: Boolean
          $warrantyOptInUiEnabled: Boolean
          $warrantyFeeEnabled: Boolean
          $warrantyFeeVariantId: String
          $warrantyFeeLabel: String
        ) {
          updateShopSettings(
            timezone: $timezone
            voidWarrantyOnRefund: $voidWarrantyOnRefund
            warrantyOptInRequired: $warrantyOptInRequired
            warrantyOptInUiEnabled: $warrantyOptInUiEnabled
            warrantyFeeEnabled: $warrantyFeeEnabled
            warrantyFeeVariantId: $warrantyFeeVariantId
            warrantyFeeLabel: $warrantyFeeLabel
          ) {
            id
            timezone
            voidWarrantyOnRefund
            warrantyOptInRequired
            warrantyOptInUiEnabled
            warrantyFeeEnabled
            warrantyFeeVariantId
            warrantyFeeLabel
          }
        }`,
        {
          timezone,
          voidWarrantyOnRefund: voidOnRefund,
          warrantyOptInRequired: optInRequired,
          warrantyOptInUiEnabled: optInUiEnabled,
          warrantyFeeEnabled: feeEnabled,
          warrantyFeeVariantId: feeVariantId.trim() || null,
          warrantyFeeLabel: feeLabel.trim() || "Product warranty registration",
        },
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveBranding() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await gqlRequest(
        `#graphql
        mutation SaveBranding(
          $logo: String
          $accent: String
          $bg: String
          $surface: String
          $text: String
          $font: String
          $radius: Int
          $buttonStyle: String
          $heroStyle: String
        ) {
          updateShopSettings(
            brandingLogoUrl: $logo
            brandingAccentColor: $accent
            brandingBgColor: $bg
            brandingSurfaceColor: $surface
            brandingTextColor: $text
            brandingFont: $font
            brandingRadius: $radius
            brandingButtonStyle: $buttonStyle
            brandingHeroStyle: $heroStyle
          ) {
            id
            onboardingCompleted
            brandingAccentColor
          }
        }`,
        {
          logo: logoUrl || null,
          accent: accent || null,
          bg: bgColor || null,
          surface: surfaceColor || null,
          text: textColor || null,
          font: font || null,
          radius: Number(radius) || 22,
          buttonStyle: buttonStyle || null,
          heroStyle: heroStyle || null,
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
      subtitle="Brand your warranty experience and place it on your storefront"
      backAction={{ url: appHref("/") }}
      secondaryActions={[{ content: "Setup wizard", url: appHref("/setup") }]}
    >
      <div className="as-m-hero">
        <div className="as-m-hero-kicker">
          <span className="as-m-hero-dot" />
          Client portal
        </div>
        <h2>One portal. Your colors.</h2>
        <p>
          Customers sign in once to activate warranties, see registered products, file claims, and
          track requests. Set logo and colors here — buttons, backgrounds, and text follow your brand.
        </p>
        <div className="as-m-hero-actions">
          <button type="button" className="as-m-chip as-m-chip-accent" onClick={() => setActiveTab("brand")}>
            Portal colors
          </button>
          <button type="button" className="as-m-chip" onClick={() => openOutsideAdmin(hosted.portal)}>
            Open client portal
          </button>
          <button type="button" className="as-m-chip" onClick={() => setActiveTab("share")}>
            Share link
          </button>
          <button type="button" className="as-m-chip" onClick={() => setActiveTab("warranty")}>
            Warranty fee
          </button>
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
            ["brand", "Portal colors"],
            ["share", "Share link"],
            ["warranty", "Warranty fee"],
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

      {activeTab === "brand" ? (
        <div className="as-m-panel as-m-canva-panel" style={{ marginTop: 14 }} data-tour="cx-brand">
          <div className="as-m-panel-title">
            <h3>Portal design studio</h3>
            <InlineStack gap="200">
              <Button onClick={() => setStudioOpen(true)}>Fullscreen canvas</Button>
              <Button variant="primary" loading={busy} onClick={() => void onSaveBranding()}>
                Save brand
              </Button>
            </InlineStack>
          </div>
          <p className="as-m-guide-lead">
            Edit on the left — the live canvas on the right updates instantly (logo, buttons,
            background, and text).
          </p>

          <div className="as-m-canva">
            <aside className="as-m-canva__rail">
              <div className="as-m-canva__section">
                <h4>Logo</h4>
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
                      ref={logoFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadLogo(f);
                        e.target.value = "";
                      }}
                    />
                    <Button loading={uploading} onClick={() => logoFileRef.current?.click()}>
                      {logoUrl ? "Replace logo" : "Upload logo"}
                    </Button>
                    {logoUrl ? (
                      <Button tone="critical" variant="plain" onClick={() => setLogoUrl("")}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="as-m-canva__hint">PNG, JPG, WEBP, GIF, or SVG · max 5MB</p>
              </div>

              <div className="as-m-canva__section">
                <h4>Colors</h4>
                <div className="as-m-color-kit">
                  {(
                    [
                      ["Accent / buttons", accent, setAccent],
                      ["Page background", bgColor, setBgColor],
                      ["Surface / cards", surfaceColor, setSurfaceColor],
                      ["Text", textColor, setTextColor],
                    ] as const
                  ).map(([label, value, setter]) => (
                    <label key={label} className="as-m-color-kit__swatch">
                      <span>{label}</span>
                      <span className="as-m-color-kit__row">
                        <input
                          type="color"
                          value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000"}
                          onChange={(e) => setter(e.target.value.toUpperCase())}
                        />
                        <input
                          className="as-m-input"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          placeholder="#000000"
                        />
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="as-m-canva__section">
                <h4>Style</h4>
                <label className="as-m-canva__field">
                  <span>Font</span>
                  <select
                    className="as-m-select"
                    value={font}
                    onChange={(e) => setFont(e.target.value)}
                  >
                    <option value="sans">Clean sans</option>
                    <option value="serif">Editorial serif</option>
                    <option value="display">Display + sans</option>
                  </select>
                </label>
                <label className="as-m-canva__field">
                  <span>Button style</span>
                  <select
                    className="as-m-select"
                    value={buttonStyle}
                    onChange={(e) => setButtonStyle(e.target.value)}
                  >
                    <option value="solid">Solid</option>
                    <option value="soft">Soft</option>
                    <option value="outline">Outline</option>
                  </select>
                </label>
                <label className="as-m-canva__field">
                  <span>Corner radius · {radius}px</span>
                  <input
                    type="range"
                    min={8}
                    max={36}
                    value={Number(radius) || 22}
                    onChange={(e) => setRadius(e.target.value)}
                  />
                </label>
              </div>
            </aside>

            <main className="as-m-canva__stage">
              <div className="as-m-canva__toolbar">
                {(
                  [
                    ["portal", "Portal"],
                    ["register", "Activate"],
                    ["claim", "Claim"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className="as-m-chip"
                    data-active={canvaPage === id}
                    onClick={() => setCanvaPage(id)}
                  >
                    {label}
                  </button>
                ))}
                <span className="as-m-canva__live">Live</span>
              </div>
              <div className="as-m-canva__frame">
                <LiveCustomerPreview
                  draft={{
                    logoUrl,
                    accent,
                    bgColor,
                    surfaceColor,
                    textColor,
                    font,
                    radius,
                    buttonStyle,
                    heroStyle,
                    shopName,
                  }}
                  page={canvaPage}
                  device="desktop"
                />
              </div>
            </main>
          </div>

          <BrandingStudio
            open={studioOpen}
            draft={{
              logoUrl,
              accent,
              bgColor,
              surfaceColor,
              textColor,
              font,
              radius,
              buttonStyle,
              heroStyle,
              shopName,
            }}
            onChange={(patch) => {
              if (patch.logoUrl !== undefined) setLogoUrl(patch.logoUrl);
              if (patch.accent !== undefined) setAccent(patch.accent);
              if (patch.bgColor !== undefined) setBgColor(patch.bgColor);
              if (patch.surfaceColor !== undefined) setSurfaceColor(patch.surfaceColor);
              if (patch.textColor !== undefined) setTextColor(patch.textColor);
              if (patch.font !== undefined) setFont(patch.font);
              if (patch.radius !== undefined) setRadius(patch.radius);
              if (patch.buttonStyle !== undefined) setButtonStyle(patch.buttonStyle);
              if (patch.heroStyle !== undefined) setHeroStyle(patch.heroStyle);
              if (patch.shopName !== undefined) setShopName(patch.shopName);
            }}
            onClose={() => setStudioOpen(false)}
            onSave={async () => {
              await onSaveBranding();
            }}
            onUploadLogo={uploadLogo}
            busy={busy}
            uploading={uploading}
            error={error}
            saved={saved}
          />
        </div>
      ) : null}

      {activeTab === "guide" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }} data-tour="cx-ways">
          <div className="as-m-panel-title">
            <h3>How customers find AfterSale</h3>
            <TourTrigger tourId="customer-pages" className="as-m-chip as-m-chip-accent" />
          </div>
          <p className="as-m-guide-lead">
            Customers always use the same branded pages (portal, register, claim). You choose{" "}
            <strong>where</strong> they appear on your store.
          </p>
          <div className="as-m-way-grid">
            <button
              type="button"
              className="as-m-way-card"
              onClick={() => setActiveTab("placement")}
              data-tour="cx-liquid"
            >
              <span className="as-m-way-num">01</span>
              <strong>Theme blocks &amp; embeds</strong>
              <p>
                Add a warranty checkbox or styled button on product and cart pages, or enable the App
                embed so it appears automatically. Customize colors, style, and copy in the theme
                editor.
              </p>
              <ul>
                <li>Warranty register card (product / cart)</li>
                <li>Warranty opt-in embed (App embeds)</li>
                <li>Thank-you prompt after checkout</li>
              </ul>
              <span className="as-m-way-cta">Open placement guide →</span>
            </button>
            <button type="button" className="as-m-way-card" onClick={() => setActiveTab("embed")} data-tour="cx-embed">
              <span className="as-m-way-num">02</span>
              <strong>Embed on any page</strong>
              <p>
                Copy a ready-made snippet into a help center, landing page, or custom HTML section.
                Compact layout keeps your brand front and center.
              </p>
              <ul>
                <li>Works outside the Online Store theme</li>
                <li>Uses your saved logo and accent color</li>
              </ul>
              <span className="as-m-way-cta">Get embed code →</span>
            </button>
            <button type="button" className="as-m-way-card" onClick={() => setActiveTab("share")}>
              <span className="as-m-way-num">03</span>
              <strong>Shareable links</strong>
              <p>
                Send hosted links by email or SMS, or use storefront links that keep customers on your
                shop domain.
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
              <strong>Place</strong>
              <span>Product · cart · checkout</span>
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

      {activeTab === "warranty" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }} data-tour="cx-warranty">
          <div className="as-m-panel-title">
            <h3>Checkout warranty registration</h3>
          </div>
          <p className="as-m-guide-lead">
            Turn every purchase into lasting peace of mind. Shoppers can include warranty at checkout,
            and AfterSale creates coverage automatically for products that match your rules.
          </p>
          <div className="as-m-benefit-row">
            <div className="as-m-benefit">
              <strong>Shop</strong>
              <span>Customer checks the warranty option on product or cart.</span>
            </div>
            <div className="as-m-benefit">
              <strong>Pay</strong>
              <span>They complete checkout as usual — no extra forms required.</span>
            </div>
            <div className="as-m-benefit">
              <strong>Covered</strong>
              <span>Warranty appears in their portal, ready if they ever need a claim.</span>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              void onSavePreferences(e);
            }}
          >
            <FormLayout>
              <label className="as-m-toggle">
                <input
                  type="checkbox"
                  checked={optInUiEnabled}
                  onChange={(e) => setOptInUiEnabled(e.target.checked)}
                />
                <span>
                  <strong style={{ display: "block", fontSize: 13 }}>
                    Show warranty checkbox on product / cart pages
                  </strong>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    Turn off to hide the storefront checkbox (theme embed stays installed but
                    invisible). When checked at checkout, warranties register from the customer’s
                    Shopify email automatically.
                  </span>
                </span>
              </label>
              <label className="as-m-toggle">
                <input
                  type="checkbox"
                  checked={optInRequired}
                  onChange={(e) => setOptInRequired(e.target.checked)}
                />
                <span>
                  <strong style={{ display: "block", fontSize: 13 }}>
                    Only register when checkbox is checked
                  </strong>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    Leave off to cover matching products on every order. Turn on if shoppers must
                    choose warranty at checkout.
                  </span>
                </span>
              </label>
              <label className="as-m-toggle">
                <input
                  type="checkbox"
                  checked={feeEnabled}
                  onChange={(e) => setFeeEnabled(e.target.checked)}
                />
                <span>
                  <strong style={{ display: "block", fontSize: 13 }}>
                    Charge a warranty registration fee
                  </strong>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    Keep registration free, or add a priced product when shoppers opt in.
                  </span>
                </span>
              </label>
              {feeEnabled ? (
                <>
                  <Autocomplete
                    options={feeOptions}
                    selected={feeVariantId ? [feeVariantId] : []}
                    onSelect={(selected) => {
                      const id = selected[0] ?? "";
                      setFeeVariantId(id);
                      const match = feeOptions.find((o) => o.value === id);
                      setFeeSelectedLabel(match?.label ?? id);
                    }}
                    textField={
                      <Autocomplete.TextField
                        label="Fee product"
                        value={feeSearch}
                        onChange={setFeeSearch}
                        autoComplete="off"
                        placeholder="Search for your warranty fee product…"
                        prefix={<Icon source={SearchIcon} tone="base" />}
                        helpText={
                          feeSelectedLabel
                            ? `Selected: ${feeSelectedLabel}`
                            : "Create a product like “Warranty registration”, then select it here."
                        }
                      />
                    }
                    loading={feeSearchBusy}
                    emptyState={
                      <div style={{ padding: 12 }}>
                        <Text as="p" tone="subdued">
                          No matches yet. Create a simple fee product in Shopify, then search for it
                          here.
                        </Text>
                      </div>
                    }
                  />
                  <TextField
                    label="Fee label on storefront"
                    value={feeLabel}
                    onChange={setFeeLabel}
                    autoComplete="off"
                  />
                </>
              ) : null}
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
                    Automatically end coverage when an order is refunded
                  </span>
                </span>
              </label>
              <Button submit variant="primary" loading={busy}>
                Save warranty settings
              </Button>
            </FormLayout>
          </form>
          <div className="as-m-help-card" style={{ marginTop: 16 }}>
            <p className="as-m-help-card__title">Get the most from checkout registration</p>
            <ol>
              <li>
                Set a warranty rule under <strong>Products &amp; rules</strong> for the items you sell.
              </li>
              <li>
                Turn on <strong>Warranty opt-in</strong> in your theme so shoppers see the checkbox
                beside Add to cart.
              </li>
              <li>
                Optional: create a priced “Warranty registration” product and select it above to
                charge a fee.
              </li>
            </ol>
          </div>
        </div>
      ) : null}

      {activeTab === "placement" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }} data-tour="cx-placement">
          <div className="as-m-panel-title">
            <h3>Show the warranty checkbox automatically</h3>
          </div>
          <p className="as-m-guide-lead">
            Enable warranty once in your theme — it appears beside <strong>Add to cart</strong> and
            again near checkout on the cart. Shoppers check the box to include coverage; after
            payment, a thank-you prompt can invite them to view their warranty.
          </p>

          <div className="as-m-help-card" style={{ marginBottom: 14 }}>
            <p className="as-m-help-card__title">Recommended setup</p>
            <ol>
              <li>Open your theme editor and go to App embeds.</li>
              <li>
                Turn on <strong>Warranty opt-in</strong>.
              </li>
              <li>Choose your title, colors, and style — then Save.</li>
            </ol>
            <div style={{ marginTop: 4 }}>
              <Button url={appEmbedsUrl()} target="_blank" variant="primary">
                Enable warranty opt-in
              </Button>
            </div>
          </div>

          <div className="as-m-way-grid">
            <div className="as-m-way-card" style={{ cursor: "default" }}>
              <span className="as-m-way-num">Product</span>
              <strong>Beside Add to cart</strong>
              <p>
                The warranty option appears right where shoppers buy — customize the wording and
                colors to match your brand.
              </p>
              <Button url={themeEditorUrl("product")} target="_blank">
                Open product template
              </Button>
            </div>
            <div className="as-m-way-card" style={{ cursor: "default" }}>
              <span className="as-m-way-num">Cart</span>
              <strong>Beside checkout</strong>
              <p>
                Give shoppers a second chance to add warranty before they pay — same embed, no extra
                setup.
              </p>
              <Button url={themeEditorUrl("cart")} target="_blank">
                Open cart template
              </Button>
            </div>
            <div className="as-m-way-card" style={{ cursor: "default" }}>
              <span className="as-m-way-num">After checkout</span>
              <strong>Thank-you page</strong>
              <p>
                Add a friendly “Your warranty is ready” prompt so customers can open their portal
                right after purchase.
              </p>
              <Button url={checkoutEditorUrl()} target="_blank">
                Open checkout editor
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {false ? null : null}

      {activeTab === "share" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }} data-tour="cx-liquid">
          <div className="as-m-panel-title">
            <h3>Share links & theme placement</h3>
          </div>
          <p className="as-m-guide-lead">
            Share branded warranty links by email or SMS, add them to your store menu, or place the
            checkbox on product and cart pages. Customers always land on the same polished experience.
          </p>

          <div className="as-m-help-card">
            <p className="as-m-help-card__title">Add AfterSale to your storefront</p>
            <ol>
              <li>
                Customize your Online Store and open a <em>Product</em> or <em>Cart</em> page.
              </li>
              <li>
                Enable <strong>Warranty opt-in</strong> under App embeds — fastest way to show the
                checkbox everywhere.
              </li>
              <li>
                Or add a <strong>Warranty register</strong> block for a custom look on specific
                templates.
              </li>
              <li>
                After payment, add the <strong>AfterSale thank you</strong> prompt so shoppers can
                open their warranty right away.
              </li>
            </ol>
            <p className="as-m-help-card__lead">
              Prefer a guided walkthrough? Open{" "}
              <button
                type="button"
                className="as-m-inline-link"
                onClick={() => setActiveTab("placement")}
              >
                Product · cart · checkout
              </button>{" "}
              or the Setup wizard.
            </p>
          </div>

          <div className="as-m-panel" style={{ marginTop: 14, background: "#f8fafc" }}>
            <div className="as-m-panel-title">
              <h3>Online Store menu links</h3>
            </div>
            <Text as="p" tone="subdued">
              Copy a link below, then add it as a menu item under Online Store → Navigation — perfect
              for “Warranty”, “Register product”, or “File a claim” in your footer.
            </Text>
            <div className="as-m-link-grid" style={{ marginTop: 10 }}>
              {(
                [
                  ["Warranty portal", "portal"],
                  ["Register product", "register"],
                  ["File a claim", "claim"],
                ] as const
              ).map(([label, key]) => (
                <div key={`menu-${key}`} className="as-m-link-card">
                  <strong>{label}</strong>
                  <div className="as-m-link-row">
                    <code>{storefront[key]}</code>
                    <Button size="slim" onClick={() => copyText(`menu-${key}`, storefront[key])}>
                      {copied === `menu-${key}` ? "Copied" : "Copy for menu"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
          <p className="as-m-guide-lead">
            Paste a ready-made snippet into a help center, landing page, or custom HTML section.
            For your Online Store theme, prefer the placement options above.
          </p>
          <div style={{ marginTop: 12, maxWidth: 280 }}>
            <TextField
              label="Embed height"
              type="number"
              value={String(embedHeight)}
              onChange={(v) => setEmbedHeight(Math.max(400, Number(v) || 720))}
              autoComplete="off"
              helpText="How tall the embedded page appears (pixels)."
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
