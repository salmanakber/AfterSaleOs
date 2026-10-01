"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

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
    fetch(`/api/public/certificate/${token}`)
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
        <div className="as-card">{error}</div>
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

  return (
    <div className="as-shell">
      <div className="as-cert">
        {cert.shop.brandingLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cert.shop.brandingLogoUrl} alt="" style={{ maxHeight: 48, marginBottom: 12 }} />
        ) : (
          <div className="as-brand">{cert.shop.shopName ?? "AfterSale"}</div>
        )}
        <h1 style={{ margin: "8px 0 4px", fontSize: "1.6rem" }}>Warranty Certificate</h1>
        <p className="as-muted">{cert.ruleName} · {cert.warrantyType}</p>
        <h2 style={{ marginTop: 20 }}>{cert.productTitle}</h2>
        <p className="as-muted">
          Order {cert.orderNumber}
          {cert.serialNumber ? ` · Serial ${cert.serialNumber}` : ""}
        </p>
        {cert.customerName ? <p>Registered to {cert.customerName}</p> : null}
        <p style={{ marginTop: 16 }}>
          <strong>
            {cert.startAt ? new Date(cert.startAt).toLocaleDateString() : "Pending start"}
          </strong>
          {" — "}
          <strong>
            {cert.endAt
              ? new Date(cert.endAt).toLocaleDateString()
              : cert.durationMonths == null
                ? "Lifetime"
                : `${cert.durationMonths} months`}
          </strong>
        </p>
        <p>
          <span
            className={
              cert.status === "ACTIVE"
                ? "as-badge as-badge-active"
                : cert.status === "EXPIRED"
                  ? "as-badge as-badge-expired"
                  : "as-badge as-badge-pending"
            }
          >
            {cert.status.replaceAll("_", " ")}
          </span>
        </p>
      </div>

      {cert.termsHtml ? (
        <div
          className="as-card"
          dangerouslySetInnerHTML={{ __html: cert.termsHtml }}
        />
      ) : null}

      <div className="as-no-print" style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <button className="as-btn" type="button" onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <a
          className="as-btn as-btn-secondary"
          href={`/apps/aftersale/portal?shop=${encodeURIComponent(cert.shop.shopDomain)}`}
          style={{ textAlign: "center", textDecoration: "none" }}
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
    <Suspense fallback={<div className="as-shell">Loading…</div>}>
      <CertificateInner />
    </Suspense>
  );
}
