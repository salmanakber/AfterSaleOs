"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";
import { AdminShell, Panel } from "@/components/AdminShell";

export default function AdminSettingsPage() {
  const router = useRouter();
  const [billingTest, setBillingTest] = useState(true);
  const [source, setSource] = useState<"env" | "platform">("env");
  const [envFallback, setEnvFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("aftersale_admin_token");
    if (!token) {
      router.replace("/");
      return;
    }
    fetch(adminApi("/api/settings"), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setBillingTest(Boolean(json.shopifyBillingTest));
        setSource(json.source === "platform" ? "platform" : "env");
        setEnvFallback(Boolean(json.envFallback));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [router]);

  async function save(next: boolean) {
    const token = localStorage.getItem("aftersale_admin_token");
    if (!token) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(adminApi("/api/settings"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shopifyBillingTest: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setBillingTest(next);
      setSource("platform");
      setMessage(
        next
          ? "Shopify billing test/sandbox mode enabled for App Review."
          : "Shopify billing test mode disabled — live charges will be created.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Settings"
      lede="Platform controls for Shopify review, billing, and operations."
    >
      <Panel title="Shopify subscription sandbox">
        <p className="sa-muted" style={{ marginTop: 0 }}>
          When enabled, paid plan subscriptions are created with{" "}
          <code>test: true</code> so Shopify App Review can approve charges without real payment.
          Source: <strong>{source}</strong>
          {source === "env" ? ` (env fallback is ${envFallback ? "on" : "off"})` : null}.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="sa-btn"
            disabled={busy || billingTest}
            onClick={() => void save(true)}
          >
            Enable test billing
          </button>
          <button
            type="button"
            className="sa-btn sa-btn-ghost"
            disabled={busy || !billingTest}
            onClick={() => void save(false)}
          >
            Disable test billing (live)
          </button>
          <span className={`sa-pill ${billingTest ? "sa-pill-warn" : "sa-pill-ok"}`}>
            {billingTest ? "TEST MODE" : "LIVE MODE"}
          </span>
        </div>
        {message ? (
          <p className="sa-muted" style={{ marginBottom: 0, marginTop: 14 }}>
            {message}
          </p>
        ) : null}
        {error ? <div className="sa-alert sa-alert-bad" style={{ marginTop: 14 }}>{error}</div> : null}
      </Panel>
    </AdminShell>
  );
}
