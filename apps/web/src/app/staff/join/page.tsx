"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type JoinPayload = {
  ok: boolean;
  error?: string;
  shopName?: string;
  shopDomain?: string;
  memberName?: string | null;
  memberEmail?: string;
  role?: string;
  workspaceUrl?: string;
};

function JoinInner() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const [data, setData] = useState<JoinPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setData({ ok: false, error: "Missing invite link." });
      setLoading(false);
      return;
    }
    fetch(`/api/staff/join?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => setData(j as JoinPayload))
      .catch(() => setData({ ok: false, error: "Could not verify invite." }))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="as-staff-join">
      <div className="as-staff-join__glow" aria-hidden />
      <div className="as-staff-join__card">
        <p className="as-staff-join__kicker">AfterSale OS · Team access</p>
        {loading ? (
          <p className="as-staff-join__muted">Verifying your invite…</p>
        ) : !data?.ok ? (
          <>
            <h1>Invite not valid</h1>
            <p className="as-staff-join__muted">{data?.error || "Ask your store owner for a new link."}</p>
          </>
        ) : (
          <>
            <h1>Welcome{data.memberName ? `, ${data.memberName}` : ""}</h1>
            <p className="as-staff-join__muted">
              You’ve been invited to <strong>{data.shopName || data.shopDomain}</strong> as{" "}
              <strong>{(data.role || "").replaceAll("_", " ").toLowerCase()}</strong>.
            </p>
            <div className="as-staff-join__meta">
              <span>{data.memberEmail}</span>
              <span>{data.shopDomain}</span>
            </div>
            <a className="as-staff-join__cta" href={data.workspaceUrl} target="_top" rel="noopener noreferrer">
              Open workspace
            </a>
            <p className="as-staff-join__hint">
              Opens AfterSale inside Shopify Admin for this store. Sign in with the Shopify account that
              uses {data.memberEmail}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function StaffJoinPage() {
  return (
    <Suspense fallback={<div className="as-staff-join"><p>Loading…</p></div>}>
      <JoinInner />
    </Suspense>
  );
}
