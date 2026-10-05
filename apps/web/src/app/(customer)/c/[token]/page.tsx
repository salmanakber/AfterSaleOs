"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { customerPageUrl, publicApiUrl } from "@/lib/public-api";
import { ThemeToggle } from "../../components/ThemeToggle";

type Cert = {
  status: string;
  startAt: string | null;
  endAt: string | null;
  productTitle: string;
  orderNumber: string;
  serialNumber: string | null;
  customerName: string | null;
  ruleName: string;
  warrantyType: string;
  termsHtml: string | null;
  durationMonths: number | null;
  shop: {
    shopName: string | null;
    shopDomain: string;
    brandingAccentColor: string | null;
    brandingLogoUrl: string | null;
  };
};

function CertificateInner() {
  const { token } = useParams<{ token: string }>();
  const search = useSearchParams();
  const [cert, setCert] = useState<Cert | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(publicApiUrl(`/api/public/certificate/${token}`))
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Not found");
        setCert(json);
        if (json.shop?.brandingAccentColor) {
          document.documentElement.style.setProperty("--as-accent", json.shop.brandingAccentColor);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [token]);

  if (error) {
    return (
      <div className="as-shell">
        <div className="as-topbar as-no-print">
          <div className="as-mark-lockup">
            <span className="as-mark">A</span>
            <span className="as-mark-text">AfterSale OS</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="as-panel">
          <div className="as-alert as-alert-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="as-shell">
        <p className="as-muted">Loading certificate…</p>
      </div>
    );
  }

  const statusClass =
    cert.status === "ACTIVE"
      ? "as-badge as-badge-active"
      : cert.status === "EXPIRED"
        ? "as-badge as-badge-expired"
        : cert.status === "EXPIRING_SOON"
          ? "as-badge as-badge-expiring"
          : "as-badge as-badge-pending";

  return (
    <div className="as-shell">
      <div className="as-topbar as-no-print">
        <div className="as-mark-lockup">
          <span className="as-mark">A</span>
          <span className="as-mark-text">Warranty certificate</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="as-cert">
        <div className="as-cert-seal">SEAL</div>
        {cert.shop.brandingLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="as-cert-logo" src={cert.shop.brandingLogoUrl} alt="" />
        ) : (
          <div
            style={{
              position: "relative",
              fontFamily: "var(--as-font-display), Fraunces, Georgia, serif",
              fontSize: "1.05rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              opacity: 0.92,
            }}
          >
            {cert.shop.shopName ?? "AfterSale"}
          </div>
        )}
        <h1>Warranty Certificate</h1>
        <p className="as-muted">
          {cert.ruleName} · {cert.warrantyType}
        </p>
        <h2>{cert.productTitle}</h2>
        <p className="as-muted">
          Order {cert.orderNumber}
          {cert.serialNumber ? ` · Serial ${cert.serialNumber}` : ""}
        </p>
        {cert.customerName ? (
          <p style={{ position: "relative" }}>Registered to {cert.customerName}</p>
        ) : null}

        <div className="as-cert-dates">
          <div>
            <small>Coverage starts</small>
            <strong>{cert.startAt ? new Date(cert.startAt).toLocaleDateString() : "Pending"}</strong>
          </div>
          <div>
            <small>Coverage ends</small>
            <strong>
              {cert.endAt
                ? new Date(cert.endAt).toLocaleDateString()
                : cert.durationMonths == null
                  ? "Lifetime"
                  : `${cert.durationMonths} months`}
            </strong>
          </div>
        </div>

        <p style={{ position: "relative", marginTop: 18 }}>
          <span className={statusClass}>{cert.status.replaceAll("_", " ")}</span>
        </p>
      </div>

      {cert.termsHtml ? (
        <div
          className="as-panel"
          style={{ marginTop: 16 }}
          dangerouslySetInnerHTML={{ __html: cert.termsHtml }}
        />
      ) : null}

      <div className="as-actions as-no-print">
        <a className="as-btn" href={publicApiUrl(`/api/public/certificate/${token}/pdf`)} download>
          Download PDF
        </a>
        <button className="as-btn as-btn-secondary" type="button" onClick={() => window.print()}>
          Print
        </button>
        <a
          className="as-btn as-btn-secondary"
          href={customerPageUrl("/apps/aftersale/portal", cert.shop.shopDomain)}
        >
          Back to portal
        </a>
      </div>
      {search.get("embed") ? null : null}
    </div>
  );
}

export default function CertificatePage() {
  return (
    <Suspense
      fallback={
        <div className="as-shell">
          <div className="as-loader" role="status">
            <div className="as-loader-mark" aria-hidden>
              <span className="as-loader-ring" />
              <span className="as-loader-ring as-loader-ring-b" />
              <span className="as-loader-core">A</span>
            </div>
            <p className="as-loader-label">Loading certificate</p>
            <div className="as-loader-bar" aria-hidden>
              <span />
            </div>
          </div>
        </div>
      }
    >
      <CertificateInner />
    </Suspense>
  );
}
