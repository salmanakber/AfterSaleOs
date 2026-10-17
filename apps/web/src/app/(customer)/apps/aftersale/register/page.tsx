"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy register URL → unified client portal (Activate warranty).
 * Keeps QR / product deep-links working by forwarding query params.
 */
function RegisterRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    next.set("view", "activate");
    router.replace(`/apps/aftersale/portal?${next.toString()}`);
  }, [params, router]);

  return (
    <div className="as-redirect" style={{ padding: "2rem", textAlign: "center" }}>
      Opening client portal…
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Loading…</div>}>
      <RegisterRedirect />
    </Suspense>
  );
}
