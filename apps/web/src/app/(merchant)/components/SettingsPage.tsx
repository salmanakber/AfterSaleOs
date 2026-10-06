"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Banner,
  Button,
  FormLayout,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { appHref } from "@/lib/shop-context";
import { clearSessionTokenCache, merchantAuthHeaders } from "@/lib/session-token";
import { TourTrigger, useOptionalTour } from "./ProductTour";
import { BrandingStudio } from "./BrandingStudio";

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
  const [shopDomain, setShopDomain] = useState("");
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "brand" | "share" | "embed" | "preview" | "guide" | "placement"
  >("guide");
  const [previewKind, setPreviewKind] = useState<PreviewKind>("portal");
  const [embedHeight, setEmbedHeight] = useState(720);
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
        tab === "placement"
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

  async function onSavePreferences(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await gqlRequest(
        `#graphql
        mutation SavePrefs($timezone: String, $voidWarrantyOnRefund: Boolean) {
          updateShopSettings(timezone: $timezone, voidWarrantyOnRefund: $voidWarrantyOnRefund) {
            id
            timezone
            voidWarrantyOnRefund
          }
        }`,
        { timezone, voidWarrantyOnRefund: voidOnRefund },
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
          Storefront experience
        </div>
        <h2>Match your brand. Meet customers where they buy.</h2>
        <p>
          Set logo and colors once — portal, registration, claims, theme blocks, embeds, and PDF
          certificates all use the same look. Then place a warranty checkbox or button on product,
          cart, or after checkout.
        </p>
        <div className="as-m-hero-actions">
          <button type="button" className="as-m-chip as-m-chip-accent" onClick={() => setActiveTab("brand")}>
            Branding studio
          </button>
          <button type="button" className="as-m-chip as-m-chip-accent" onClick={() => setActiveTab("placement")}>
            Product · cart · checkout
          </button>
          <button type="button" className="as-m-chip" onClick={() => openOutsideAdmin(hosted.portal)}>
            Open portal
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
            ["placement", "Product · cart · checkout"],
            ["brand", "Branding"],
            ["share", "Share & theme"],
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

      {activeTab === "placement" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }} data-tour="cx-placement">
          <div className="as-m-panel-title">
            <h3>Show the warranty checkbox automatically</h3>
          </div>
          <p className="as-m-guide-lead">
            Enable <strong>one App embed</strong> — no need to add a block on every product template.
            The checkbox appears next to <strong>Add to cart</strong> and again near checkout on the
            cart. Checkout itself cannot host Liquid; use the thank-you block after payment.
          </p>

          <div className="as-m-liquid-guide" style={{ marginBottom: 14 }}>
            <strong>Recommended (once)</strong>
            <ol>
              <li>Open App embeds in your theme editor.</li>
              <li>
                Turn on <strong>Warranty opt-in (auto)</strong>.
              </li>
              <li>
                Set your title, colors, and style (checkbox / text+button / button) — then Save.
              </li>
            </ol>
            <div style={{ marginTop: 10 }}>
              <Button url={appEmbedsUrl()} target="_blank" variant="primary">
                Enable warranty opt-in (App embeds)
              </Button>
            </div>
          </div>

          <div className="as-m-way-grid">
            <div className="as-m-way-card" style={{ cursor: "default" }}>
              <span className="as-m-way-num">Product</span>
              <strong>Beside Add to cart</strong>
              <p>
                With the App embed on, the checkbox mounts just above the Add to cart button. You
                only customize copy and colors — no Mac-style preview chrome.
              </p>
              <Button url={themeEditorUrl("product")} target="_blank">
                Open product template
              </Button>
            </div>
            <div className="as-m-way-card" style={{ cursor: "default" }}>
              <span className="as-m-way-num">Cart</span>
              <strong>Beside checkout</strong>
              <p>
                Same App embed places the checkbox near the cart checkout button so shoppers can
                still opt in before paying.
              </p>
              <Button url={themeEditorUrl("cart")} target="_blank">
                Open cart template
              </Button>
            </div>
            <div className="as-m-way-card" style={{ cursor: "default" }}>
              <span className="as-m-way-num">After checkout</span>
              <strong>Thank-you page</strong>
              <p>
                Add <em>AfterSale thank you</em> so customers get a “Register this product” button
                after the order is placed.
              </p>
              <Button url={checkoutEditorUrl()} target="_blank">
                Open checkout editor
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "brand" ? (
        <div style={{ marginTop: 14 }} data-tour="cx-brand">
          <div className="br-brand-card">
            <h3>Customer page branding</h3>
            <p>
              Design logo, colors, type, and button style on a full-screen canvas with a live
              preview of portal, register, and claim pages.
            </p>
            <div className="br-brand-card-actions">
              <Button variant="primary" onClick={() => setActiveTab("brand")}>
                Open branding studio
              </Button>
              <Button onClick={() => setActiveTab("preview")}>Live hosted preview</Button>
            </div>
            <div
              className="as-m-preview"
              style={{
                marginTop: 8,
                ["--as-preview-accent" as string]: accent || "#3B82F6",
              }}
            >
              <div className="as-m-preview-bar">
                <i />
                <i />
                <i />
              </div>
              <div className="as-m-preview-body" style={{ background: bgColor || "#F4F6FB" }}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    style={{ height: 36, marginBottom: 12, objectFit: "contain", maxWidth: "70%" }}
                  />
                ) : null}
                <h4 style={{ color: textColor || "#0F172A" }}>
                  {shopName || "Your store"} warranty portal
                </h4>
                <p>Open the studio to edit with live canvas preview.</p>
                <span className="as-m-preview-cta" style={{ background: accent || "#3B82F6" }}>
                  Open branding studio
                </span>
              </div>
            </div>
          </div>

          <div className="as-m-panel" style={{ marginTop: 14 }}>
            <div className="as-m-panel-title">
              <h3>Store preferences</h3>
            </div>
            <form
              onSubmit={(e) => {
                void onSavePreferences(e);
              }}
            >
              <FormLayout>
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
                  Save preferences
                </Button>
              </FormLayout>
            </form>
          </div>

          <BrandingStudio
            open
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
            onClose={() => setActiveTab("guide")}
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

      {activeTab === "share" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }} data-tour="cx-liquid">
          <div className="as-m-panel-title">
            <h3>Share links & theme placement</h3>
          </div>
          <Text as="p" tone="subdued">
            Hosted links work everywhere. Storefront links keep customers on your shop domain. For
            checkbox and button placement, use the Product · cart · checkout tab.
          </Text>

          <div className="as-m-liquid-guide">
            <strong>Add AfterSale in your theme</strong>
            <ol>
              <li>
                Online Store → Customize → open a <em>Product</em> or <em>Cart</em> template.
              </li>
              <li>
                <strong>Easiest — App embeds:</strong> theme settings gear → <em>App embeds</em> →
                enable <strong>Warranty opt-in embed</strong>.
              </li>
              <li>
                <strong>Or Add block:</strong> Product information → <strong>Add block</strong> →{" "}
                <strong>Apps</strong> → <strong>Warranty register card</strong>. Choose checkbox,
                banner, or button style and set your brand color.
              </li>
              <li>
                After checkout: Checkout editor → Thank you → add <strong>AfterSale thank you</strong>.
              </li>
            </ol>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#1e3a8a" }}>
              Need a walkthrough? Open the{" "}
              <button
                type="button"
                className="as-m-inline-link"
                onClick={() => setActiveTab("placement")}
              >
                Product · cart · checkout
              </button>{" "}
              tab or the Setup wizard.
            </p>
          </div>

          <div className="as-m-panel" style={{ marginTop: 14, background: "#f8fafc" }}>
            <div className="as-m-panel-title">
              <h3>Online Store menu links</h3>
            </div>
            <Text as="p" tone="subdued">
              Shopify does not let apps auto-inject links into your Navigation menus. Copy any URL
              below, then in Admin → Online Store → Navigation → edit a menu → Add menu item → paste
              the link. Keep them handy whenever you edit menus.
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
          <Text as="p" tone="subdued">
            Paste into a custom page, help center, or landing builder. Prefer theme blocks when
            staying inside your Online Store.
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
