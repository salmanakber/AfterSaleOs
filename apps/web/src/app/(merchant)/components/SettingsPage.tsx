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
  const [activeTab, setActiveTab] = useState<"brand" | "share" | "embed" | "preview">("brand");
  const [previewKind, setPreviewKind] = useState<PreviewKind>("portal");
  const [embedHeight, setEmbedHeight] = useState(720);

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
          Configure branding once, then share hosted links, storefront proxy URLs, or embed snippets
          anywhere.
        </p>
        <div className="as-m-hero-actions">
          <button type="button" className="as-m-chip as-m-chip-accent" onClick={() => openOutsideAdmin(hosted.portal)}>
            Open portal
          </button>
          <button type="button" className="as-m-chip" onClick={() => setActiveTab("preview")}>
            Live preview
          </button>
          <button type="button" className="as-m-chip" onClick={() => setActiveTab("embed")}>
            Get embed code
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
            ["brand", "Branding"],
            ["share", "Share links"],
            ["embed", "Embed"],
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
        <div className="as-m-settings-grid" style={{ marginTop: 14 }}>
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
        <div className="as-m-panel" style={{ marginTop: 14 }}>
          <div className="as-m-panel-title">
            <h3>Share links</h3>
          </div>
          <Text as="p" tone="subdued">
            Hosted links always work. Storefront links need app proxy (`shopify app deploy`).
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
            Theme editor: add AfterSale register / lookup / claim blocks for product and footer entry
            points.
          </div>
        </div>
      ) : null}

      {activeTab === "embed" ? (
        <div className="as-m-panel" style={{ marginTop: 14 }}>
          <div className="as-m-panel-title">
            <h3>Embed anywhere</h3>
          </div>
          <Text as="p" tone="subdued">
            Paste into Shopify pages, help centers, or landing builders. Compact mode uses{" "}
            <code>embed=1</code>.
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
        <div className="as-m-panel" style={{ marginTop: 14 }}>
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
