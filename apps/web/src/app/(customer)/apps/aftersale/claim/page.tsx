"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function ClaimFormInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const certificateToken = params.get("certificate") ?? "";
  const query = useMemo(() => params.toString(), [params]);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [serial, setSerial] = useState("");
  const [category, setCategory] = useState("defect");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    claimNumber: string;
    trackingUrl: string;
    message: string;
    eligibility: string;
  } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const attachmentIds: string[] = [];
      if (files) {
        for (const file of Array.from(files).slice(0, 5)) {
          const fd = new FormData();
          fd.append("file", file);
          const up = await fetch(`/api/public/attachments/upload?${query}`, {
            method: "POST",
            body: fd,
          });
          const uj = await up.json();
          if (!up.ok) throw new Error(uj.error ?? "Upload failed");
          attachmentIds.push(uj.id);
        }
      }

      const res = await fetch(`/api/public/claims?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          customerName: name || undefined,
          certificateToken: certificateToken || undefined,
          orderNumber: orderNumber || undefined,
          serialNumber: serial || undefined,
          issueCategory: category,
          issueSummary: summary,
          issueDetails: details || undefined,
          attachmentIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Claim failed");
      setResult({
        claimNumber: json.claimNumber,
        trackingUrl: json.trackingUrl,
        message: json.message,
        eligibility: json.eligibility,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="as-shell">
        <div className="as-brand">AfterSale</div>
        <div className="as-card">
          <h2>Claim submitted</h2>
          <p>
            Reference <strong>{result.claimNumber}</strong>
          </p>
          <p className="as-muted">{result.message}</p>
          <p className="as-muted">Eligibility guide: {result.eligibility.replaceAll("_", " ")}</p>
          <p>
            <a className="as-link" href={result.trackingUrl}>
              Track your claim
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="as-shell">
      <div className="as-brand">AfterSale</div>
      <p className="as-muted">Submit a warranty claim</p>
      <form className="as-card" onSubmit={onSubmit}>
        <label className="as-label">Email</label>
        <input className="as-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="as-label">Name</label>
        <input className="as-input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="as-label">Order number</label>
        <input className="as-input" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="#1001" />
        <label className="as-label">Serial number</label>
        <input className="as-input" value={serial} onChange={(e) => setSerial(e.target.value)} />
        <label className="as-label">Issue category</label>
        <select className="as-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="defect">Product defect</option>
          <option value="damage">Damage</option>
          <option value="missing_parts">Missing parts</option>
          <option value="performance">Performance</option>
          <option value="other">Other</option>
        </select>
        <label className="as-label">Summary</label>
        <input className="as-input" required value={summary} onChange={(e) => setSummary(e.target.value)} />
        <label className="as-label">Details</label>
        <textarea
          className="as-input"
          rows={4}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          style={{ resize: "vertical" }}
        />
        <label className="as-label">Photos / files (max 5)</label>
        <input
          className="as-input"
          type="file"
          accept="image/*,application/pdf,video/mp4"
          multiple
          onChange={(e) => setFiles(e.target.files)}
        />
        {certificateToken ? <p className="as-muted">Linked to certificate {certificateToken.slice(0, 8)}…</p> : null}
        {error ? <p style={{ color: "var(--as-status-rejected)" }}>{error}</p> : null}
        <button className="as-btn" type="submit" disabled={loading || !shop}>
          {loading ? "Submitting…" : "Submit claim"}
        </button>
      </form>
    </div>
  );
}

export default function ClaimFormPage() {
  return (
    <Suspense fallback={<div className="as-shell">Loading…</div>}>
      <ClaimFormInner />
    </Suspense>
  );
}
