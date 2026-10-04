"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";
import { AdminShell, Panel } from "@/components/AdminShell";

type ProviderRow = {
  id: "openai" | "groq" | "gemini" | "claude";
  label: string;
  keySource: "platform" | "env" | "none";
  keyHint: string | null;
  model: string;
  enabled: boolean;
  configured: boolean;
};

type TaskId = "claim_assist" | "classify" | "summarize" | "draft_reply" | "general";

const TASK_LABELS: Record<TaskId, string> = {
  claim_assist: "Claim assist (triage JSON)",
  classify: "Issue classification",
  summarize: "Summaries",
  draft_reply: "Customer reply drafts",
  general: "General / fallback",
};

const PROVIDER_ORDER = ["openai", "groq", "gemini", "claude"] as const;

export default function AdminSettingsPage() {
  const router = useRouter();
  const [billingTest, setBillingTest] = useState(true);
  const [source, setSource] = useState<"env" | "platform">("env");
  const [envFallback, setEnvFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [taskRoutes, setTaskRoutes] = useState<Record<TaskId, string[]>>({
    claim_assist: [],
    classify: [],
    summarize: [],
    draft_reply: [],
    general: [],
  });
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  function token() {
    return localStorage.getItem("aftersale_admin_token");
  }

  useEffect(() => {
    const t = token();
    if (!t) {
      router.replace("/");
      return;
    }
    fetch(adminApi("/api/settings"), { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setBillingTest(Boolean(json.shopifyBillingTest));
        setSource(json.source === "platform" ? "platform" : "env");
        setEnvFallback(Boolean(json.envFallback));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));

    fetch(adminApi("/api/ai-settings"), { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setProviders(json.providers ?? []);
        setTaskRoutes(json.taskRoutes ?? {});
        const models: Record<string, string> = {};
        for (const p of json.providers ?? []) models[p.id] = p.model;
        setModelDrafts(models);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load AI settings"));
  }, [router]);

  async function saveBilling(next: boolean) {
    const t = token();
    if (!t) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(adminApi("/api/settings"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
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

  async function saveAi() {
    const t = token();
    if (!t) return;
    setAiBusy(true);
    setAiMessage(null);
    setError(null);
    try {
      const payload = {
        providers: providers.map((p) => ({
          id: p.id,
          enabled: p.enabled,
          model: modelDrafts[p.id] ?? p.model,
          apiKey: keyDrafts[p.id]?.trim() || undefined,
        })),
        taskRoutes,
      };
      const res = await fetch(adminApi("/api/ai-settings"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setProviders(json.providers ?? []);
      setTaskRoutes(json.taskRoutes ?? {});
      setKeyDrafts({});
      setAiMessage("AI provider keys and routing saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function clearKey(id: ProviderRow["id"]) {
    const t = token();
    if (!t) return;
    setAiBusy(true);
    setError(null);
    try {
      const res = await fetch(adminApi("/api/ai-settings"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ providers: [{ id, clearKey: true }] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Clear failed");
      setProviders(json.providers ?? []);
      setKeyDrafts((d) => ({ ...d, [id]: "" }));
      setAiMessage(`${id} platform key cleared (env fallback still used if set).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setAiBusy(false);
    }
  }

  function moveRoute(task: TaskId, providerId: string, dir: -1 | 1) {
    setTaskRoutes((prev) => {
      const list = [...(prev[task] ?? [])];
      const i = list.indexOf(providerId);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= list.length) return prev;
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...prev, [task]: next };
    });
  }

  return (
    <AdminShell
      title="Settings"
      lede="Platform controls for Shopify review, billing, and AI providers."
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
            onClick={() => void saveBilling(true)}
          >
            Enable test billing
          </button>
          <button
            type="button"
            className="sa-btn sa-btn-ghost"
            disabled={busy || !billingTest}
            onClick={() => void saveBilling(false)}
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
      </Panel>

      <Panel title="AI providers">
        <p className="sa-muted" style={{ marginTop: 0 }}>
          Configure OpenAI, Groq, Gemini, and Claude. Each task picks a preferred provider first;
          if that call fails, the next in the list is tried automatically. Keys saved here override
          env vars. Leave a key blank to keep the existing value.
        </p>

        <div style={{ display: "grid", gap: 16 }}>
          {providers.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid var(--sa-line, #e5e7eb)",
                borderRadius: 12,
                padding: 14,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong>{p.label}</strong>
                  <div className="sa-muted" style={{ fontSize: 12 }}>
                    {p.configured
                      ? `Configured (${p.keySource}) ${p.keyHint ?? ""}`
                      : "Not configured"}
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) =>
                      setProviders((rows) =>
                        rows.map((r) => (r.id === p.id ? { ...r, enabled: e.target.checked } : r)),
                      )
                    }
                  />
                  Enabled
                </label>
              </div>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                API key
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={p.keyHint ? `Stored ${p.keyHint} — paste to replace` : "Paste API key"}
                  value={keyDrafts[p.id] ?? ""}
                  onChange={(e) => setKeyDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Model
                <input
                  type="text"
                  value={modelDrafts[p.id] ?? p.model}
                  onChange={(e) => setModelDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
                />
              </label>
              {p.keySource === "platform" ? (
                <button
                  type="button"
                  className="sa-btn sa-btn-ghost"
                  disabled={aiBusy}
                  onClick={() => void clearKey(p.id)}
                  style={{ width: "fit-content" }}
                >
                  Clear platform key
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <h3 style={{ marginTop: 22, marginBottom: 8, fontSize: 15 }}>Task routing (failover order)</h3>
        <p className="sa-muted" style={{ marginTop: 0 }}>
          First provider is preferred for that job; remaining providers are automatic fallbacks.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {(Object.keys(TASK_LABELS) as TaskId[]).map((task) => (
            <div
              key={task}
              style={{
                border: "1px solid var(--sa-line, #e5e7eb)",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <strong style={{ fontSize: 13 }}>{TASK_LABELS[task]}</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {(taskRoutes[task] ?? PROVIDER_ORDER).map((pid, idx) => (
                  <div
                    key={`${task}-${pid}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "#f1f5f9",
                      fontSize: 12,
                    }}
                  >
                    <span>
                      {idx + 1}. {pid}
                    </span>
                    <button
                      type="button"
                      className="sa-btn sa-btn-ghost"
                      style={{ padding: "0 6px", minHeight: 0 }}
                      onClick={() => moveRoute(task, pid, -1)}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="sa-btn sa-btn-ghost"
                      style={{ padding: "0 6px", minHeight: 0 }}
                      onClick={() => moveRoute(task, pid, 1)}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="sa-btn" disabled={aiBusy} onClick={() => void saveAi()}>
            Save AI settings
          </button>
        </div>
        {aiMessage ? (
          <p className="sa-muted" style={{ marginBottom: 0, marginTop: 12 }}>
            {aiMessage}
          </p>
        ) : null}
      </Panel>

      {error ? <div className="sa-alert sa-alert-bad" style={{ marginTop: 14 }}>{error}</div> : null}
    </AdminShell>
  );
}
