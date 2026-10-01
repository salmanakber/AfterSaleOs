"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SessionInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const shop = params.get("shop") ?? "";

  useEffect(() => {
    if (!token) return;
    router.replace(`/apps/aftersale/portal?shop=${encodeURIComponent(shop)}&token=${encodeURIComponent(token)}`);
  }, [token, shop, router]);

  return (
    <div className="as-shell">
      <p className="as-muted">Opening your warranty portal…</p>
    </div>
  );
}

export default function PortalSessionPage() {
  return (
    <Suspense>
      <SessionInner />
    </Suspense>
  );
}
