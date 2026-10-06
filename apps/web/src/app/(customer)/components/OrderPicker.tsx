"use client";

import { useEffect, useMemo, useState } from "react";
import { publicApiUrl } from "@/lib/public-api";

export type OrderOption = {
  id: string;
  orderNumber: string;
  processedAt: string;
  lineItems: Array<{
    id: string;
    title: string;
    quantity: number;
    shopifyProductId: string | null;
    shopifyVariantId: string | null;
    hasWarranty: boolean;
    certificateToken: string | null;
  }>;
};

/** Pick an order (and optionally a line item) when the customer email is known. */
export function OrderPicker({
  shop,
  email,
  selectedOrderNumber,
  selectedLineId,
  onSelect,
  mode = "order",
}: {
  shop: string;
  email: string;
  selectedOrderNumber: string;
  selectedLineId?: string;
  onSelect: (order: OrderOption, lineItemId?: string) => void;
  mode?: "order" | "line";
}) {
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shop || !email) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(publicApiUrl("/api/public/orders-lookup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop, email }),
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Could not load orders");
        if (!cancelled) setOrders(json.orders ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shop, email]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.lineItems.some((li) => li.title.toLowerCase().includes(q)),
    );
  }, [orders, filter]);

  if (loading) {
    return <p className="as-muted">Loading your orders…</p>;
  }
  if (error) {
    return <div className="as-alert as-alert-error">{error}</div>;
  }
  if (orders.length === 0) {
    return (
      <div className="as-empty">
        <strong>No orders found for this email</strong>
        <p className="as-muted">Enter an order number below, or verify with email + order.</p>
      </div>
    );
  }

  return (
    <div className="as-stack as-order-picker">
      <div className="as-section-head">
        <h2>Your orders</h2>
        <span className="as-chip">{orders.length} found</span>
      </div>
      <label className="as-label">Filter orders</label>
      <input
        className="as-input"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Order # or product name"
      />
      <div className="as-stack" style={{ gap: 10 }}>
        {filtered.map((o) => {
          const active = o.orderNumber === selectedOrderNumber;
          return (
            <article
              key={o.id}
              className="as-card"
              style={{
                outline: active ? "2px solid var(--as-primary)" : undefined,
                boxShadow: active ? "0 0 0 4px var(--as-primary-soft)" : undefined,
              }}
            >
              <button
                type="button"
                className="as-order-pick-head"
                onClick={() => onSelect(o, o.lineItems[0]?.id)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>Order {o.orderNumber}</strong>
                  <div className="as-muted" style={{ fontSize: 12 }}>
                    {new Date(o.processedAt).toLocaleDateString()} · {o.lineItems.length} item
                    {o.lineItems.length === 1 ? "" : "s"}
                  </div>
                </div>
                {active ? <span className="as-chip">Selected</span> : null}
              </button>
              {mode === "line" && active ? (
                <div className="as-stack" style={{ gap: 8, marginTop: 10 }}>
                  {o.lineItems.map((li) => (
                    <button
                      key={li.id}
                      type="button"
                      className="as-line-row"
                      onClick={() => onSelect(o, li.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        border:
                          selectedLineId === li.id
                            ? "2px solid var(--as-primary)"
                            : undefined,
                      }}
                    >
                      <div>
                        <strong>{li.title}</strong>
                        <div className="as-muted" style={{ fontSize: 12 }}>
                          Qty {li.quantity}
                          {li.hasWarranty ? " · Covered" : ""}
                        </div>
                      </div>
                      {selectedLineId === li.id ? (
                        <span className="as-muted" style={{ fontSize: 12 }}>
                          Selected
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <p className="as-muted">No orders match that filter.</p>
      ) : null}
    </div>
  );
}
