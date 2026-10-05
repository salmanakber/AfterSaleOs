"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { publicApiUrl } from "@/lib/public-api";
import { BrandLoader } from "../../../../components/BrandLoader";
import { CustomerShell } from "../../../../components/CustomerShell";

type ClaimView = {
  claimNumber: string;
  status: string;
  issueSummary: string | null;
  issueDetails: string | null;
  eligibilityResult: string | null;
  productTitle: string | null;
  createdAt: string;
  updatedAt: string;
  shopName: string;
  notes: { body: string; createdAt: string; authorType: string }[];
  attachments: { fileName: string; contentType: string }[];
};

const RAIL = ["OPEN", "IN_REVIEW", "IN_RESOLUTION", "COMPLETED"] as const;

function railActive(status: string): number {
  if (status === "COMPLETED" || status === "APPROVED") return 3;
  if (status === "IN_RESOLUTION") return 2;
  if (status === "IN_REVIEW" || status === "WAITING_CUSTOMER") return 1;
  if (status === "REJECTED" || status === "CANCELLED") return -1;
  return 0;
}

function TrackInner() {
  const { token } = useParams<{ token: string }>();
  const [claim, setClaim] = useState<ClaimView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(publicApiUrl(`/api/public/claims?token=${encodeURIComponent(token)}`))
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Not found");
        setClaim(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [token]);

  const activeIdx = useMemo(() => (claim ? railActive(claim.status) : 0), [claim]);

  if (error) {
    return (
      <CustomerShell title="Claim not found" lede="This tracking link may be invalid or expired.">
        <div className="as-alert as-alert-error">{error}</div>
      </CustomerShell>
    );
  }

  if (!claim) {
    return (
      <div className="as-shell">
        <BrandLoader label="Loading claim status" />
      </div>
    );
  }

  const badge =
    claim.status === "APPROVED" || claim.status === "COMPLETED"
      ? "as-badge as-badge-active"
      : claim.status === "REJECTED" || claim.status === "CANCELLED"
        ? "as-badge as-badge-void"
        : claim.status === "WAITING_CUSTOMER"
          ? "as-badge as-badge-expiring"
          : "as-badge as-badge-pending";

  return (
    <CustomerShell
      brand={claim.shopName || "AfterSale"}
      title="Claim tracking"
      lede="Live status and updates from the care team — refresh anytime."
    >
      <div className="as-stack">
        <div className="as-status-rail" aria-label="Claim progress">
          {RAIL.map((step, i) => (
            <span key={step} data-active={activeIdx >= i && activeIdx >= 0 ? "true" : "false"}>
              {step.replaceAll("_", " ")}
            </span>
          ))}
        </div>

        <div className="as-track-card">
          <div className="as-warranty-row">
            <div>
              <h2 className="as-warranty-title" style={{ marginBottom: 4 }}>
                {claim.claimNumber}
              </h2>
              {claim.productTitle ? <p className="as-muted">{claim.productTitle}</p> : null}
            </div>
            <span className={badge}>{claim.status.replaceAll("_", " ")}</span>
          </div>

          <p style={{ margin: 0, fontSize: "1.08rem", fontWeight: 650 }}>{claim.issueSummary}</p>
          {claim.issueDetails ? <p className="as-muted" style={{ margin: 0 }}>{claim.issueDetails}</p> : null}

          <div className="as-track-meta">
            {claim.eligibilityResult ? (
              <span className="as-chip">
                Eligibility · {claim.eligibilityResult.replaceAll("_", " ")}
              </span>
            ) : null}
            <span className="as-chip">Opened {new Date(claim.createdAt).toLocaleDateString()}</span>
            <span className="as-chip">Updated {new Date(claim.updatedAt).toLocaleString()}</span>
          </div>
        </div>

        {claim.notes.length > 0 ? (
          <div>
            <div className="as-section-head">
              <h2>Updates</h2>
            </div>
            <ul className="as-timeline">
              {claim.notes.map((n, i) => (
                <li key={i}>
                  <p style={{ margin: 0 }}>{n.body}</p>
                  <p className="as-muted" style={{ margin: "4px 0 0" }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="as-empty">
            <strong>No updates yet</strong>
            <p className="as-muted">You’ll see messages here when the team posts an update.</p>
          </div>
        )}

        {claim.attachments.length > 0 ? (
          <div>
            <div className="as-section-head">
              <h2>Attachments</h2>
            </div>
            <div className="as-stack">
              {claim.attachments.map((a, i) => (
                <div key={i} className="as-line-row">
                  <strong>{a.fileName}</strong>
                  <span className="as-muted" style={{ fontSize: 12 }}>
                    {a.contentType || "File"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </CustomerShell>
  );
}

export default function ClaimTrackPage() {
  return (
    <Suspense
      fallback={
        <div className="as-shell">
          <BrandLoader label="Opening claim" />
        </div>
      }
    >
      <TrackInner />
    </Suspense>
  );
}
