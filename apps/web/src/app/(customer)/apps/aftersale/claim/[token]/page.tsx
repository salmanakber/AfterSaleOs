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
  issueCategory: string | null;
  eligibilityResult: string | null;
  productTitle: string | null;
  createdAt: string;
  updatedAt: string;
  shopName: string;
  notes: { body: string; createdAt: string; authorType: string }[];
  attachments: { fileName: string; contentType: string }[];
};

const RAIL = [
  { key: "OPEN", label: "Received" },
  { key: "IN_REVIEW", label: "Reviewing" },
  { key: "IN_RESOLUTION", label: "Resolving" },
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
  const map: Record<string, string> = {
    OPEN: "Received",
    IN_REVIEW: "Under review",
    WAITING_CUSTOMER: "Needs your reply",
    APPROVED: "Approved",
    REJECTED: "Not approved",
    IN_RESOLUTION: "Being resolved",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return map[status] ?? status.replaceAll("_", " ");
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
      title="Your claim"
      lede="Live status from the care team."
      {...shellProps}
    >
      <article className="as-track-v2">
        <header className="as-track-v2__hero">
          <div className="as-track-v2__hero-top">
            <div>
              <p className="as-track-v2__kicker">Claim tracking</p>
              <h2 className="as-track-v2__number">{claim.claimNumber}</h2>
            </div>
            <span className={`as-track-v2__pill as-track-v2__pill--${tone}`}>
              {statusLabel(claim.status)}
            </span>
          </div>

          {claim.productTitle ? (
            <p className="as-track-v2__product">{claim.productTitle}</p>
          ) : null}

          {claim.issueSummary ? (
            <p className="as-track-v2__summary">{claim.issueSummary}</p>
          ) : null}

          {!closed ? (
            <ol className="as-track-v2__rail" aria-label="Claim progress">
              {RAIL.map((step, i) => {
                const state =
                  activeIdx > i ? "done" : activeIdx === i ? "current" : "upcoming";
                return (
                  <li key={step.key} data-state={state}>
                    <span className="as-track-v2__dot" aria-hidden>
                      {state === "done" ? "✓" : i + 1}
                    </span>
                    <span className="as-track-v2__rail-label">{step.label}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <div className="as-track-v2__facts">
            <div>
              <span>Opened</span>
              <strong>{new Date(claim.createdAt).toLocaleDateString()}</strong>
            </div>
            <div>
              <span>Updated</span>
              <strong>{new Date(claim.updatedAt).toLocaleString()}</strong>
            </div>
            {claim.eligibilityResult ? (
              <div>
                <span>Eligibility</span>
                <strong>{statusLabel(claim.eligibilityResult)}</strong>
              </div>
            ) : null}
            {claim.issueCategory ? (
              <div>
                <span>Category</span>
                <strong>{statusLabel(claim.issueCategory)}</strong>
              </div>
            ) : null}
          </div>
        </header>

        {claim.issueDetails ? (
          <section className="as-track-v2__card">
            <h3>What you reported</h3>
            <p>{claim.issueDetails}</p>
          </section>
        ) : null}

        <section className="as-track-v2__card">
          <h3>Updates from the team</h3>
          {claim.notes.length > 0 ? (
            <ol className="as-track-v2__timeline">
              {[...claim.notes].reverse().map((n, i) => (
                <li key={`${n.createdAt}-${i}`}>
                  <span className="as-track-v2__timeline-dot" aria-hidden />
                  <div>
                    <p>{n.body}</p>
                    <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="as-track-v2__empty">
              No messages yet. You’ll get an email when the store posts an update.
            </p>
          )}
        </section>

        {claim.attachments.length > 0 ? (
          <section className="as-track-v2__card">
            <h3>Your files</h3>
            <ul className="as-track-v2__files">
              {claim.attachments.map((a, i) => (
                <li key={`${a.fileName}-${i}`}>
                  <span className="as-track-v2__file-icon" aria-hidden>
                    ▦
                  </span>
                  <div>
                    <strong>{a.fileName}</strong>
                    <span>{a.contentType || "Attachment"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
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
