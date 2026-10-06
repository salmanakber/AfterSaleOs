"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { appHref } from "@/lib/shop-context";
import { useFeatureAccess } from "./FeatureLock";

export type BrandingDraft = {
  logoUrl: string;
  accent: string;
  bgColor: string;
  surfaceColor: string;
  textColor: string;
  font: string;
  radius: string;
  buttonStyle: string;
  heroStyle: string;
  shopName: string;
};

type Props = {
  open: boolean;
  draft: BrandingDraft;
  onChange: (patch: Partial<BrandingDraft>) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onUploadLogo: (file: File) => Promise<void>;
  busy?: boolean;
  uploading?: boolean;
  error?: string | null;
  saved?: boolean;
};

type Device = "desktop" | "tablet" | "mobile";
type PreviewPage = "portal" | "register" | "claim";

function hexOr(value: string, fallback: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const safe = hexOr(value, fallback);
  return (
    <label className="br-field" htmlFor={id}>
      <span className="br-field-label">{label}</span>
      <div className="br-color-field">
        <input
          id={id}
          className="br-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
        <input
          type="color"
          className="br-swatch"
          value={safe}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label} picker`}
        />
      </div>
    </label>
  );
}

function LiveCustomerPreview({
  draft,
  page,
  device,
}: {
  draft: BrandingDraft;
  page: PreviewPage;
  device: Device;
}) {
  const accent = hexOr(draft.accent, "#3B82F6");
  const bg = hexOr(draft.bgColor, "#F4F6FB");
  const surface = hexOr(draft.surfaceColor, "#FFFFFF");
  const ink = hexOr(draft.textColor, "#0F172A");
  const radius = Number(draft.radius) || 22;
  const muted = `color-mix(in srgb, ${ink} 55%, ${bg})`;
  const border = `color-mix(in srgb, ${ink} 12%, ${surface})`;
  const soft = `color-mix(in srgb, ${accent} 16%, transparent)`;
  const tint = `color-mix(in srgb, ${accent} 12%, ${surface})`;

  const fontFamily =
    draft.font === "serif"
      ? '"Fraunces", Georgia, serif'
      : draft.font === "display"
        ? '"Fraunces", Georgia, serif'
        : '"Figtree", system-ui, sans-serif';
  const bodyFont =
    draft.font === "serif" ? '"Source Serif 4", Georgia, serif' : '"Figtree", system-ui, sans-serif';

  const heroPad = draft.heroStyle === "minimal" ? "16px 18px" : draft.heroStyle === "calm" ? "20px 20px" : "24px 22px";
  const brandSize = draft.heroStyle === "minimal" ? "1.35rem" : draft.heroStyle === "calm" ? "1.7rem" : "2.1rem";

  const titles: Record<PreviewPage, { title: string; lede: string; cta: string }> = {
    portal: {
      title: "Your warranties",
      lede: "Look up coverage, download certificates, or start a claim.",
      cta: "Open my warranties",
    },
    register: {
      title: "Register a product",
      lede: "Link your purchase so coverage starts with confidence.",
      cta: "Continue registration",
    },
    claim: {
      title: "File a claim",
      lede: "Tell us what happened — we’ll guide the next step.",
      cta: "Submit claim",
    },
  };
  const copy = titles[page];

  const btnStyle =
    draft.buttonStyle === "outline"
      ? {
          background: "transparent",
          color: accent,
          border: `1.5px solid ${accent}`,
        }
      : draft.buttonStyle === "soft"
        ? {
            background: tint,
            color: accent,
            border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
          }
        : {
            background: accent,
            color: "#fff",
            border: `1px solid ${accent}`,
          };

  return (
    <div
      className={`br-device br-device--${device}`}
      style={
        {
          ["--br-bg"]: bg,
          ["--br-surface"]: surface,
          ["--br-ink"]: ink,
          ["--br-muted"]: muted,
          ["--br-accent"]: accent,
          ["--br-border"]: border,
          ["--br-soft"]: soft,
          ["--br-radius"]: `${radius}px`,
          fontFamily: bodyFont,
        } as CSSProperties
      }
    >
      <div className="br-device-chrome">
        <span />
        <span />
        <span />
        <em>
          {draft.shopName || "Your store"} · {page}
        </em>
      </div>
      <div className="br-device-scroll">
        <div className="br-preview-shell">
          <div className="br-preview-topbar">
            <div className="br-preview-lockup">
              {draft.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logoUrl} alt="" className="br-preview-logo" />
              ) : (
                <span className="br-preview-mark" style={{ background: accent, color: "#fff" }}>
                  {(draft.shopName || "A").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <span className="br-preview-theme-pill">Theme</span>
          </div>

          <header
            className={`br-preview-hero br-preview-hero--${draft.heroStyle}`}
            style={{
              padding: heroPad,
              borderRadius: radius + 4,
              border: `1px solid color-mix(in srgb, ${accent} 18%, ${border})`,
              background:
                draft.heroStyle === "minimal"
                  ? surface
                  : `radial-gradient(700px 220px at 0% 0%, ${soft}, transparent 55%), linear-gradient(180deg, color-mix(in srgb, ${surface} 92%, transparent), ${surface})`,
            }}
          >
            <div className="br-preview-kicker" style={{ color: accent, background: tint, borderColor: `color-mix(in srgb, ${accent} 28%, ${border})` }}>
              <i style={{ background: accent }} />
              Warranty & care
            </div>
            <h1 style={{ fontFamily, fontSize: brandSize, color: ink }}>
              {draft.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logoUrl} alt={draft.shopName || "Brand"} className="br-preview-logo-lg" />
              ) : (
                draft.shopName || "Your store"
              )}
            </h1>
            <h2 style={{ color: ink }}>{copy.title}</h2>
            <p style={{ color: muted }}>{copy.lede}</p>
          </header>

          <div
            className="br-preview-panel"
            style={{
              background: surface,
              borderRadius: radius,
              border: `1px solid ${border}`,
            }}
          >
            {page === "portal" ? (
              <>
                <div className="br-preview-field">
                  <label style={{ color: muted }}>Email</label>
                  <div className="br-preview-input" style={{ borderColor: border, background: bg }} />
                </div>
                <div className="br-preview-field">
                  <label style={{ color: muted }}>Order number</label>
                  <div className="br-preview-input" style={{ borderColor: border, background: bg }} />
                </div>
              </>
            ) : page === "register" ? (
              <>
                <div className="br-preview-steps">
                  {["Find order", "Confirm", "Done"].map((s, i) => (
                    <span
                      key={s}
                      data-active={i === 0}
                      style={{
                        color: i === 0 ? accent : muted,
                        borderColor: i === 0 ? `color-mix(in srgb, ${accent} 40%, ${border})` : border,
                        background: i === 0 ? tint : "transparent",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="br-preview-field">
                  <label style={{ color: muted }}>Product</label>
                  <div className="br-preview-input" style={{ borderColor: border, background: bg }} />
                </div>
              </>
            ) : (
              <>
                <div className="br-preview-field">
                  <label style={{ color: muted }}>Issue summary</label>
                  <div className="br-preview-input br-preview-input--tall" style={{ borderColor: border, background: bg }} />
                </div>
              </>
            )}

            <button type="button" className="br-preview-cta" style={{ ...btnStyle, borderRadius: Math.max(10, radius - 6) }}>
              {copy.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrandingStudio({
  open,
  draft,
  onChange,
  onClose,
  onSave,
  onUploadLogo,
  busy,
  uploading,
  error,
  saved,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [page, setPage] = useState<PreviewPage>("portal");
  const [section, setSection] = useState<"identity" | "colors" | "type" | "style">("identity");
  const { allowed: canBrand, plan, meta } = useFeatureAccess("customBranding");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await onSave();
  }

  return createPortal(
    <div className="br-studio" role="dialog" aria-modal="true" aria-label="Branding studio">
      <header className="br-studio-top">
        <div className="br-studio-top-left">
          <button type="button" className="br-icon-btn" onClick={onClose} aria-label="Close studio">
            ←
          </button>
          <div>
            <strong>Branding studio</strong>
            <span>Live canvas · customer pages</span>
          </div>
        </div>

        <div className="br-studio-devices" role="tablist" aria-label="Preview size">
          {(
            [
              ["desktop", "Desktop"],
              ["tablet", "Tablet"],
              ["mobile", "Mobile"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={device === id}
              data-active={device === id}
              onClick={() => setDevice(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="br-studio-top-right">
          {saved ? <span className="br-saved-pill">Saved</span> : null}
          {error ? <span className="br-error-pill">{error}</span> : null}
          <button type="button" className="br-btn br-btn-ghost" onClick={onClose}>
            Close
          </button>
          {canBrand ? (
            <button type="button" className="br-btn br-btn-primary" disabled={busy} onClick={() => void onSave()}>
              {busy ? "Saving…" : "Save branding"}
            </button>
          ) : (
            <Link className="br-btn br-btn-primary" href={appHref("/plans")} style={{ textDecoration: "none" }}>
              Upgrade to edit
            </Link>
          )}
        </div>
      </header>

      <div className="br-studio-body">
        {!canBrand ? (
          <aside className="br-studio-rail br-studio-rail--locked">
            <div className="br-lock-panel">
              <span className="br-lock-badge">Not on {plan?.name ?? "Free"}</span>
              <h2>{meta.label}</h2>
              <p>{meta.blurb}</p>
              <p className="br-rail-lede">
                Preview stays visible so you can see the default look. Upgrade to upload a logo and
                customize colors, type, and style.
              </p>
              <Link className="br-btn br-btn-primary" href={appHref("/plans")} style={{ textDecoration: "none", textAlign: "center" }}>
                Compare plans
              </Link>
              <button type="button" className="br-btn br-btn-ghost" onClick={onClose}>
                Back to Customer pages
              </button>
            </div>
          </aside>
        ) : (
        <aside className="br-studio-rail">
          <nav className="br-rail-nav">
            {(
              [
                ["identity", "Logo"],
                ["colors", "Colors"],
                ["type", "Type"],
                ["style", "Style"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-active={section === id}
                onClick={() => setSection(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <form className="br-rail-panel" onSubmit={handleSave}>
            {section === "identity" ? (
              <div className="br-stack">
                <p className="br-rail-lede">Upload your mark — it becomes the hero on every customer page.</p>
                <div className="br-logo-stage">
                  {draft.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.logoUrl} alt="Logo" />
                  ) : (
                    <span>Drop a logo</span>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadLogo(f);
                    e.target.value = "";
                  }}
                />
                <div className="br-inline-actions">
                  <button
                    type="button"
                    className="br-btn br-btn-primary"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? "Uploading…" : draft.logoUrl ? "Replace logo" : "Upload logo"}
                  </button>
                  {draft.logoUrl ? (
                    <button type="button" className="br-btn br-btn-ghost" onClick={() => onChange({ logoUrl: "" })}>
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="br-hint">PNG, JPG, WEBP, GIF, or SVG · max 5MB</p>
              </div>
            ) : null}

            {section === "colors" ? (
              <div className="br-stack">
                <p className="br-rail-lede">Tune the palette. Preview updates instantly on the canvas.</p>
                <ColorField label="Accent" value={draft.accent} fallback="#3B82F6" onChange={(v) => onChange({ accent: v })} />
                <ColorField label="Background" value={draft.bgColor} fallback="#F4F6FB" onChange={(v) => onChange({ bgColor: v })} />
                <ColorField label="Surface" value={draft.surfaceColor} fallback="#FFFFFF" onChange={(v) => onChange({ surfaceColor: v })} />
                <ColorField label="Text" value={draft.textColor} fallback="#0F172A" onChange={(v) => onChange({ textColor: v })} />
                <div className="br-palette-strip" aria-hidden>
                  {[draft.accent, draft.bgColor, draft.surfaceColor, draft.textColor].map((c, i) => (
                    <i key={i} style={{ background: hexOr(c, "#ccc") }} />
                  ))}
                </div>
              </div>
            ) : null}

            {section === "type" ? (
              <div className="br-stack">
                <p className="br-rail-lede">Choose a voice for headlines and body copy.</p>
                <label className="br-field">
                  <span className="br-field-label">Font style</span>
                  <select className="br-select" value={draft.font} onChange={(e) => onChange({ font: e.target.value })}>
                    <option value="sans">Clean sans</option>
                    <option value="serif">Editorial serif</option>
                    <option value="display">Display + sans</option>
                  </select>
                </label>
                <div className="br-type-samples">
                  <p data-font={draft.font} className="br-type-display">
                    Warranty & care
                  </p>
                  <p data-font={draft.font} className="br-type-body">
                    Your customers will read coverage details in this voice.
                  </p>
                </div>
              </div>
            ) : null}

            {section === "style" ? (
              <div className="br-stack">
                <p className="br-rail-lede">Shape buttons, corners, and hero presence.</p>
                <label className="br-field">
                  <span className="br-field-label">Button style</span>
                  <div className="br-segment">
                    {(
                      [
                        ["solid", "Solid"],
                        ["soft", "Soft"],
                        ["outline", "Outline"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        data-active={draft.buttonStyle === id}
                        onClick={() => onChange({ buttonStyle: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="br-field">
                  <span className="br-field-label">Hero style</span>
                  <div className="br-segment">
                    {(
                      [
                        ["bold", "Bold"],
                        ["calm", "Calm"],
                        ["minimal", "Minimal"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        data-active={draft.heroStyle === id}
                        onClick={() => onChange({ heroStyle: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="br-field">
                  <span className="br-field-label">Corner radius · {draft.radius || "22"}px</span>
                  <input
                    className="br-range"
                    type="range"
                    min={8}
                    max={36}
                    value={Number(draft.radius) || 22}
                    onChange={(e) => onChange({ radius: e.target.value })}
                  />
                </label>
              </div>
            ) : null}
          </form>
        </aside>
        )}

        <main className="br-studio-canvas">
          <div className="br-canvas-toolbar">
            <div className="br-page-tabs">
              {(
                [
                  ["portal", "Portal"],
                  ["register", "Register"],
                  ["claim", "Claim"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  data-active={page === id}
                  onClick={() => setPage(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="br-canvas-hint">
              {canBrand ? "Changes preview live — save when you’re happy" : "Read-only preview on your current plan"}
            </span>
          </div>

          <div className="br-canvas-stage">
            <div className="br-canvas-grid" aria-hidden />
            <LiveCustomerPreview draft={draft} page={page} device={device} />
          </div>
        </main>
      </div>
    </div>,
    document.body,
  );
}
