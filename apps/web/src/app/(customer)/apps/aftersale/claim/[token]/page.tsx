"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { publicApiUrl } from "@/lib/public-api";
import { parseEmbedLayout } from "@/lib/embed-layout";
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

const RAIL = [
  { key: "OPEN", label: "Open" },
  { key: "IN_REVIEW", label: "Review" },
  { key: "IN_RESOLUTION", label: "Resolve" },
  { key: "COMPLETED", label: "Done" },
] as const;

function railActive(status: string): number {
  if (status === "COMPLETED" || status === "APPROVED") return 3;
  if (status === "IN_RESOLUTION") return 2;
  if (status === "IN_REVIEW" || status === "WAITING_CUSTOMER") return 1;
  if (status === "REJECTED" || status === "CANCELLED") return -1;
  return 0;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function TrackInner() {
  const { token } = useParams<{ token: string }>();
  const params = useSearchParams();
  const embed = params.get("embed") === "1";
  const themeLocal = params.get("theme") === "local" || embed;
  const accentOverride = params.get("accent");
  const embedLayout = parseEmbedLayout(params);
  const shop = params.get("shop") ?? "";
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

  const shellProps = {
    shopDomain: shop,
    embed,
    themeLocal,
    accentOverride,
    embedCols: embedLayout.cols,
    embedWidth: embedLayout.width,
    embedStyle: embedLayout.style,
  } as const;

  if (error) {
    return (
      <CustomerShell title="Claim not found" lede="This tracking link may be invalid or expired." {...shellProps}>
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

  const closed = claim.status === "REJECTED" || claim.status === "CANCELLED";
  const tone =
    claim.status === "APPROVED" || claim.status === "COMPLETED"
      ? "ok"
      : closed
        ? "bad"
        : claim.status === "WAITING_CUSTOMER"
          ? "wait"
          : "live";

  return (
    <CustomerShell
      brand={claim.shopName || "AfterSale"}
      title="Track claim"
      lede={claim.productTitle || "Status updates from the care team."}
      {...shellProps}
    >
      <div className="as-track">
        <header className="as-track-head">
          <div>
            <p className="as-track-kicker">Claim</p>
            <h2 className="as-track-number">{claim.claimNumber}</h2>
            {claim.issueSummary ? <p className="as-track-summary">{claim.issueSummary}</p> : null}
          </div>
          <span className={`as-track-pill as-track-pill--${tone}`}>{statusLabel(claim.status)}</span>
        </header>

        {!closed ? (
          <ol className="as-track-rail" aria-label="Claim progress">
            {RAIL.map((step, i) => (
              <li key={step.key} data-state={activeIdx > i ? "done" : activeIdx === i ? "current" : "upcoming"}>
                <span className="as-track-rail__tick" aria-hidden />
                <span className="as-track-rail__label">{step.label}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="as-track-meta-row">
          {claim.eligibilityResult ? (
            <span>Eligibility · {statusLabel(claim.eligibilityResult)}</span>
          ) : null}
          <span>Opened {new Date(claim.createdAt).toLocaleDateString()}</span>
          <span>Updated {new Date(claim.updatedAt).toLocaleString()}</span>
        </div>

        {claim.issueDetails ? <p className="as-track-details">{claim.issueDetails}</p> : null}

        <section className="as-track-section">
          <h3>Updates</h3>
          {claim.notes.length > 0 ? (
            <ul className="as-track-updates">
              {claim.notes.map((n, i) => (
                <li key={i}>
                  <p>{n.body}</p>
                  <time>{new Date(n.createdAt).toLocaleString()}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="as-muted as-track-empty">No updates yet — check back soon.</p>
          )}
        </section>

        {claim.attachments.length > 0 ? (
          <section className="as-track-section">
            <h3>Files</h3>
            <ul className="as-track-files">
              {claim.attachments.map((a, i) => (
                <li key={i}>
                  <strong>{a.fileName}</strong>
                  <span>{a.contentType || "File"}</span>
                </li>
              ))}
            </ul>
          </section>
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
