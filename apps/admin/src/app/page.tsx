"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@aftersale.local");
  const [password, setPassword] = useState("changeme123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(adminApi("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Login failed");
      localStorage.setItem("aftersale_admin_token", json.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sa-login">
      <div className="sa-atmosphere" aria-hidden="true">
        <span className="sa-orb sa-orb-a" />
        <span className="sa-orb sa-orb-b" />
        <span className="sa-grain" />
      </div>
      <div className="sa-login-card">
        <div className="sa-login-top">
          <div className="sa-brand-lockup" style={{ padding: 0 }}>
            <span className="sa-mark">A</span>
            <div>
              <strong>AfterSale</strong>
              <span>Super Admin</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <h1>
          Sign in to <span style={{ color: "var(--sa-primary)" }}>ops</span>
        </h1>
        <p className="sa-muted">Internal console for shops, jobs, webhooks, and compliance.</p>
        <form onSubmit={onSubmit}>
          <label>
            <span className="sa-label">Email</span>
            <input
              className="sa-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            <span className="sa-label">Password</span>
            <input
              className="sa-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error ? <div className="sa-alert sa-alert-bad">{error}</div> : null}
          <button className="sa-btn" disabled={loading} type="submit">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
