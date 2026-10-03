"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { publicApiUrl } from "@/lib/public-api";
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
        <p className="as-muted">Loading claim…</p>
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
      lede="Live status and updates from the merchant team."
    >
      <div className="as-status-rail" aria-label="Claim progress">
        {RAIL.map((step, i) => (
          <span key={step} data-active={activeIdx >= i && activeIdx >= 0 ? "true" : "false"}>
            {step.replaceAll("_", " ")}
          </span>
        ))}
      </div>

      <div className="as-warranty-row" style={{ marginBottom: 12 }}>
        <div>
          <h2 className="as-warranty-title" style={{ marginBottom: 4 }}>
            {claim.claimNumber}
          </h2>
          {claim.productTitle ? <p className="as-muted">{claim.productTitle}</p> : null}
        </div>
        <span className={badge}>{claim.status.replaceAll("_", " ")}</span>
      </div>

      <p style={{ marginTop: 0, fontSize: "1.05rem" }}>{claim.issueSummary}</p>
      {claim.issueDetails ? <p className="as-muted">{claim.issueDetails}</p> : null}

      <div className="as-meta">
        {claim.eligibilityResult ? (
          <span>Eligibility · {claim.eligibilityResult.replaceAll("_", " ")}</span>
        ) : null}
        <span>Updated {new Date(claim.updatedAt).toLocaleString()}</span>
      </div>

      {claim.notes.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <p className="as-section-title">Updates</p>
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
      ) : null}

      {claim.attachments.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <p className="as-section-title">Attachments</p>
          <ul className="as-stack" style={{ paddingLeft: 18, margin: 0 }}>
            {claim.attachments.map((a, i) => (
              <li key={i}>{a.fileName}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </CustomerShell>
  );
}

export default function ClaimTrackPage() {
  return (
    <Suspense fallback={<div className="as-shell">Loading…</div>}>
      <TrackInner />
    </Suspense>
  );
}
