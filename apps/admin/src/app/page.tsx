"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
      const res = await fetch("/api/login", {
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
    <div className="shell" style={{ maxWidth: 420 }}>
      <h1>AfterSale Super Admin</h1>
      <p className="muted">Internal operations console — merchants never see this.</p>
      <form className="card" onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 20 }}>
        <label>
          <div className="muted">Email</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <div className="muted">Password</div>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <div style={{ color: "#f87171" }}>{error}</div> : null}
        <button className="btn" disabled={loading} type="submit">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
