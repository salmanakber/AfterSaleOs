"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy claim URL → unified client portal (File a claim).
 * Claim tracking by token stays on /apps/aftersale/claim/[token].
 */
function ClaimRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    next.set("view", "claim");
    router.replace(`/apps/aftersale/portal?${next.toString()}`);
  }, [params, router]);

  return (
    <div className="as-redirect" style={{ padding: "2rem", textAlign: "center" }}>
      Opening client portal…
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Loading…</div>}>
      <ClaimRedirect />
    </Suspense>
  );
}
