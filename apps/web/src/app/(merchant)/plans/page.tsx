"use client";

import { Suspense } from "react";
import { PlansPage } from "../components/PlansPage";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading plans…</div>}>
      <PlansPage />
    </Suspense>
  );
}
