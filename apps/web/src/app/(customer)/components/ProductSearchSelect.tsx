"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { publicApiUrl } from "@/lib/public-api";
import type { CachedOrder } from "@/lib/customer-order-session";

export type PickedProduct = {
  source: "catalog" | "order";
  title: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  orderNumber?: string;
  lineItemId?: string;
  imageUrl?: string | null;
  sku?: string | null;
};

type CatalogProduct = {
  id: string;
  shopifyProductId: string;
  title: string;
  imageUrl: string | null;
  vendor: string | null;
  variants: {
    shopifyVariantId: string;
    title: string;
    sku: string | null;
    priceCents: number | null;
  }[];
};

function money(cents: number | null | undefined) {
  if (cents == null) return null;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function ProductSearchSelect({
  shop,
  orders = [],
  value,
  onChange,
  placeholder = "Search products or pick from your orders…",
}: {
  shop: string;
  orders?: CachedOrder[];
  value: PickedProduct | null;
  onChange: (next: PickedProduct | null) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);

  const orderHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows: PickedProduct[] = [];
    for (const o of orders) {
      for (const li of o.lineItems) {
        if (
          !needle ||
          li.title.toLowerCase().includes(needle) ||
          o.orderNumber.toLowerCase().includes(needle)
        ) {
          rows.push({
            source: "order",
            title: li.title,
            orderNumber: o.orderNumber,
            lineItemId: li.id,
            shopifyProductId: undefined,
            shopifyVariantId: undefined,
          });
        }
      }
    }
    return rows.slice(0, 12);
  }, [orders, q]);

  useEffect(() => {
    if (!shop || !open) return;
    const t = window.setTimeout(() => {
      setLoading(true);
      fetch(
        publicApiUrl(
          `/api/public/products?shop=${encodeURIComponent(shop)}&q=${encodeURIComponent(q.trim())}&limit=20`,
        ),
      )
        .then(async (r) => {
          const json = await r.json();
          if (!r.ok) throw new Error(json.error ?? "Failed");
          setCatalog(json.products ?? []);
        })
        .catch(() => setCatalog([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(t);
  }, [shop, q, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(next: PickedProduct) {
    onChange(next);
    setQ(next.title);
    setOpen(false);
  }

  return (
    <div className="as-pselect" ref={rootRef}>
      <label className="as-label" htmlFor={listId}>
        Product
      </label>
      <div className={`as-pselect__field${open ? " is-open" : ""}`}>
        <span className="as-pselect__search-icon" aria-hidden>
          ⌕
        </span>
        <input
          id={listId}
          className="as-pselect__input"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-list`}
          autoComplete="off"
          placeholder={placeholder}
          value={open || !value ? q : value.title}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => {
            setOpen(true);
            if (value) setQ(value.title);
          }}
        />
        {value ? (
          <button
            type="button"
            className="as-pselect__clear"
            aria-label="Clear product"
            onClick={() => {
              onChange(null);
              setQ("");
              setOpen(true);
            }}
          >
            ×
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="as-pselect__panel" id={`${listId}-list`} role="listbox">
          {orderHits.length > 0 ? (
            <div className="as-pselect__group">
              <p className="as-pselect__group-label">From your orders</p>
              {orderHits.map((row) => (
                <button
                  key={`o-${row.orderNumber}-${row.lineItemId}`}
                  type="button"
                  role="option"
                  className="as-pselect__option"
                  onClick={() => pick(row)}
                >
                  <span className="as-pselect__thumb as-pselect__thumb--order" aria-hidden>
                    #
                  </span>
                  <span className="as-pselect__copy">
                    <strong>{row.title}</strong>
                    <em>Order {row.orderNumber}</em>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="as-pselect__group">
            <p className="as-pselect__group-label">
              {loading ? "Searching store…" : "Store catalog"}
            </p>
            {!loading && catalog.length === 0 ? (
              <p className="as-pselect__empty">No products match. Try another search.</p>
            ) : null}
            {catalog.map((p) => {
              const v = p.variants[0];
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  className="as-pselect__option"
                  onClick={() =>
                    pick({
                      source: "catalog",
                      title: p.title,
                      shopifyProductId: p.shopifyProductId,
                      shopifyVariantId: v?.shopifyVariantId,
                      imageUrl: p.imageUrl,
                      sku: v?.sku,
                    })
                  }
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="as-pselect__thumb" />
                  ) : (
                    <span className="as-pselect__thumb as-pselect__thumb--blank" aria-hidden />
                  )}
                  <span className="as-pselect__copy">
                    <strong>{p.title}</strong>
                    <em>
                      {[p.vendor, v?.sku, money(v?.priceCents)].filter(Boolean).join(" · ") ||
                        "Product"}
                    </em>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
