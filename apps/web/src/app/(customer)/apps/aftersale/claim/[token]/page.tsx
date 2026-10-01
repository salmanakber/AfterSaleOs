"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

function TrackInner() {
  const { token } = useParams<{ token: string }>();
  const [claim, setClaim] = useState<ClaimView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/claims?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Not found");
        setClaim(json);
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
        : "as-badge as-badge-pending";

  return (
    <div className="as-shell">
      <div className="as-brand">{claim.shopName}</div>
      <p className="as-muted">Claim tracking</p>
      <div className="as-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <strong>{claim.claimNumber}</strong>
          <span className={badge}>{claim.status.replaceAll("_", " ")}</span>
        </div>
        {claim.productTitle ? <p>{claim.productTitle}</p> : null}
        <p>{claim.issueSummary}</p>
        {claim.issueDetails ? <p className="as-muted">{claim.issueDetails}</p> : null}
        {claim.eligibilityResult ? (
          <p className="as-muted">Eligibility: {claim.eligibilityResult.replaceAll("_", " ")}</p>
        ) : null}
        <p className="as-muted">
          Updated {new Date(claim.updatedAt).toLocaleString()}
        </p>
      </div>

      {claim.notes.length > 0 ? (
        <div className="as-card">
          <h3 style={{ marginTop: 0 }}>Updates</h3>
          <div className="as-stack">
            {claim.notes.map((n, i) => (
              <div key={i}>
                <p style={{ margin: 0 }}>{n.body}</p>
                <p className="as-muted" style={{ margin: "4px 0 0" }}>
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {claim.attachments.length > 0 ? (
        <div className="as-card">
          <h3 style={{ marginTop: 0 }}>Attachments</h3>
          <ul>
            {claim.attachments.map((a, i) => (
              <li key={i}>{a.fileName}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function ClaimTrackPage() {
  return (
    <Suspense fallback={<div className="as-shell">Loading…</div>}>
      <TrackInner />
    </Suspense>
  );
}
