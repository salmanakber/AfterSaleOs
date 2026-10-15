"use client";

import { useState, type ReactNode } from "react";
import {
  Banner,
  BlockStack,
  Button,
  InlineStack,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { appHref } from "@/lib/shop-context";

export type ResolveProduct = {
  productTitle: string | null;
  productSku: string | null;
  productPriceCents: number | null;
  productQuantity: number | null;
  currency: string | null;
  orderNumber: string | null;
  shopifyVariantId: string | null;
  orderAdminUrl: string | null;
  productAdminUrl: string | null;
};

export type ResolveReplacement = {
  id: string;
  status: string;
  productTitle: string | null;
  shopifyDraftOrderName: string | null;
  adminOrderUrl: string | null;
  warrantyMode: string;
};

export type ResolveRefund = {
  id: string;
  amountCents: number | null;
  currency: string;
  reason: string | null;
  adminDeepLink: string | null;
  issuedInShopify: boolean;
  createdAt: string;
};

export type ResolveRepair = {
  id: string;
  repairNumber: string;
  status: string;
};

type Path = "choose" | "refund" | "replace" | "repair" | "supplier";

function money(cents: number | null | undefined, currency = "USD") {
  if (cents == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function ClaimResolvePanel({
  product,
  replacements,
  refunds,
  repairs,
  suppliers,
  busy,
  onCreateRepair,
  onCreateReplacement,
  onCompleteReplacement,
  onRecordRefund,
  onSaveSupplier,
}: {
  product: ResolveProduct;
  replacements: ResolveReplacement[];
  refunds: ResolveRefund[];
  repairs: ResolveRepair[];
  suppliers: { id: string; name: string }[];
  busy: boolean;
  onCreateRepair: () => void;
  onCreateReplacement: (warrantyMode: string) => void;
  onCompleteReplacement: (id: string) => void;
  onRecordRefund: (input: {
    amountCents: number;
    reason: string;
    issuedInShopify: boolean;
  }) => void;
  onSaveSupplier: (input: {
    supplierId: string;
    amountCents: number | null;
    status: string;
  }) => void;
}) {
  const [path, setPath] = useState<Path>("choose");
  const [warrantyMode, setWarrantyMode] = useState("INHERIT_REMAINING");
  const suggested = money(product.productPriceCents, product.currency ?? "USD");
  const [refundAmount, setRefundAmount] = useState(
    product.productPriceCents != null ? String((product.productPriceCents / 100).toFixed(2)) : "",
  );
  const [refundReason, setRefundReason] = useState("");
  const [refundInShopify, setRefundInShopify] = useState("ledger");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [supplierAmount, setSupplierAmount] = useState("");
  const [supplierStatus, setSupplierStatus] = useState("NOT_FILED");

  const openDrafts = replacements.filter((r) => r.status === "draft_created");

  return (
    <div className="as-resolve">
      <div className="as-resolve-product">
        <div className="as-resolve-product__body">
          <p className="as-resolve-product__kicker">Product on this claim</p>
          <h3>{product.productTitle ?? "No product linked"}</h3>
          <dl className="as-resolve-product__meta">
            <div>
              <dt>Order</dt>
              <dd>{product.orderNumber ?? "—"}</dd>
            </div>
            <div>
              <dt>SKU</dt>
              <dd>{product.productSku ?? "—"}</dd>
            </div>
            <div>
              <dt>Qty</dt>
              <dd>{product.productQuantity ?? "—"}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{suggested ?? "—"}</dd>
            </div>
          </dl>
        </div>
        <div className="as-resolve-product__links">
          {product.orderAdminUrl ? (
            <Button url={product.orderAdminUrl} external>
              Open order in Shopify
            </Button>
          ) : null}
          {product.productAdminUrl ? (
            <Button url={product.productAdminUrl} external variant="plain">
              Open product
            </Button>
          ) : null}
        </div>
      </div>

      {(openDrafts.length > 0 || refunds.length > 0 || repairs.length > 0) && (
        <div className="as-resolve-history">
          <h4>Already started</h4>
          <ul>
            {openDrafts.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>Replacement draft</strong>
                  <span>
                    {r.shopifyDraftOrderName || r.productTitle || "Draft"} · {r.warrantyMode.replaceAll("_", " ")}
                  </span>
                </div>
                <InlineStack gap="200">
                  {r.adminOrderUrl ? (
                    <Button url={r.adminOrderUrl} external size="slim">
                      Open draft
                    </Button>
                  ) : null}
                  <Button size="slim" loading={busy} onClick={() => onCompleteReplacement(r.id)}>
                    Mark dispatched
                  </Button>
                </InlineStack>
              </li>
            ))}
            {refunds.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>Refund logged</strong>
                  <span>
                    {money(r.amountCents, r.currency)}
                    {r.reason ? ` · ${r.reason}` : ""}
                    {r.issuedInShopify ? " · marked in Shopify" : " · ledger only"}
                  </span>
                </div>
                {r.adminDeepLink ? (
                  <Button url={r.adminDeepLink} external size="slim">
                    Open order
                  </Button>
                ) : null}
              </li>
            ))}
            {repairs.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>Repair {r.repairNumber}</strong>
                  <span>{r.status.replaceAll("_", " ")}</span>
                </div>
                <Button url={appHref(`/repairs/${r.id}`)} size="slim">
                  Open repair
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {path === "choose" ? (
        <div className="as-resolve-paths">
          <p className="as-resolve-paths__lede">Choose how to resolve this claim</p>
          <div className="as-resolve-path-grid">
            <button type="button" className="as-resolve-path" onClick={() => setPath("refund")}>
              <span className="as-resolve-path__icon" aria-hidden>
                $
              </span>
              <strong>Refund money</strong>
              <span>Log a refund and jump to the Shopify order to issue it.</span>
            </button>
            <button type="button" className="as-resolve-path" onClick={() => setPath("replace")}>
              <span className="as-resolve-path__icon" aria-hidden>
                ↻
              </span>
              <strong>Send replacement</strong>
              <span>Create a free draft order for the same product, then fulfill in Shopify.</span>
            </button>
            <button type="button" className="as-resolve-path" onClick={() => setPath("repair")}>
              <span className="as-resolve-path__icon" aria-hidden>
                ✎
              </span>
              <strong>Start repair</strong>
              <span>Open a repair ticket for intake, diagnosis, and shipping.</span>
            </button>
            <button type="button" className="as-resolve-path" onClick={() => setPath("supplier")}>
              <span className="as-resolve-path__icon" aria-hidden>
                ⇆
              </span>
              <strong>Supplier recovery</strong>
              <span>Track money you can recover from a supplier (internal).</span>
            </button>
          </div>
        </div>
      ) : null}

      {path === "refund" ? (
        <div className="as-resolve-panel">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingMd">
              Refund money
            </Text>
            <Button variant="plain" onClick={() => setPath("choose")}>
              Back
            </Button>
          </InlineStack>
          <Banner tone="info">
            <p>
              AfterSale logs the refund for this claim. Issue the money in Shopify Admin on the
              order{suggested ? ` (product paid ${suggested})` : ""}.
            </p>
          </Banner>
          <FormFields>
            <TextField
              label="Amount"
              type="number"
              value={refundAmount}
              onChange={setRefundAmount}
              prefix={product.currency === "USD" || !product.currency ? "$" : undefined}
              autoComplete="off"
              helpText={suggested ? `Suggested from line price: ${suggested}` : undefined}
            />
            <TextField
              label="Reason"
              value={refundReason}
              onChange={setRefundReason}
              autoComplete="off"
              placeholder="Customer received defective unit"
            />
            <Select
              label="Shopify status"
              options={[
                { label: "Log only — I’ll refund in Shopify next", value: "ledger" },
                { label: "Already refunded in Shopify", value: "done" },
              ]}
              value={refundInShopify}
              onChange={setRefundInShopify}
            />
          </FormFields>
          <InlineStack gap="200">
            <Button
              variant="primary"
              loading={busy}
              onClick={() => {
                const cents = Math.round(parseFloat(refundAmount || "0") * 100);
                if (!cents) return;
                onRecordRefund({
                  amountCents: cents,
                  reason: refundReason,
                  issuedInShopify: refundInShopify === "done",
                });
              }}
            >
              Save refund on claim
            </Button>
            {product.orderAdminUrl ? (
              <Button url={product.orderAdminUrl} external>
                Issue refund in Shopify
              </Button>
            ) : null}
          </InlineStack>
        </div>
      ) : null}

      {path === "replace" ? (
        <div className="as-resolve-panel">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingMd">
              Send replacement
            </Text>
            <Button variant="plain" onClick={() => setPath("choose")}>
              Back
            </Button>
          </InlineStack>
          <Banner tone="info">
            <p>
              Creates a 100% discounted Shopify draft order for{" "}
              <strong>{product.productTitle ?? "this product"}</strong>
              {product.shopifyVariantId ? "" : " — link a variant on the warranty unit if draft creation fails"}.
              Complete the draft in Shopify to dispatch, then mark it dispatched here.
            </p>
          </Banner>
          <div className="as-resolve-replace-preview">
            <strong>{product.productTitle ?? "Product"}</strong>
            <span>
              {product.productSku ? `SKU ${product.productSku} · ` : ""}
              Qty {product.productQuantity ?? 1}
            </span>
          </div>
          <Select
            label="Warranty on replacement"
            options={[
              { label: "Inherit remaining term", value: "INHERIT_REMAINING" },
              { label: "Restart full warranty", value: "RESTART" },
            ]}
            value={warrantyMode}
            onChange={setWarrantyMode}
          />
          {!product.shopifyVariantId ? (
            <Banner tone="warning">
              <p>
                No Shopify variant on this warranty unit — sync the order line with a variant before
                creating a replacement draft.
              </p>
            </Banner>
          ) : null}
          <InlineStack gap="200">
            <Button
              variant="primary"
              loading={busy}
              onClick={() => onCreateReplacement(warrantyMode)}
              disabled={!product.shopifyVariantId}
            >
              Create replacement draft
            </Button>
            {product.orderAdminUrl ? (
              <Button url={product.orderAdminUrl} external variant="plain">
                View original order
              </Button>
            ) : null}
          </InlineStack>
        </div>
      ) : null}

      {path === "repair" ? (
        <div className="as-resolve-panel">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingMd">
              Start repair
            </Text>
            <Button variant="plain" onClick={() => setPath("choose")}>
              Back
            </Button>
          </InlineStack>
          <Text as="p" tone="subdued">
            Opens a repair ticket for intake, diagnosis, parts, and outbound shipping. You’ll leave
            this claim desk for the repair workspace.
          </Text>
          <Button variant="primary" loading={busy} onClick={onCreateRepair}>
            Create repair ticket
          </Button>
        </div>
      ) : null}

      {path === "supplier" ? (
        <div className="as-resolve-panel">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingMd">
              Supplier recovery
            </Text>
            <Button variant="plain" onClick={() => setPath("choose")}>
              Back
            </Button>
          </InlineStack>
          <Text as="p" tone="subdued">
            Internal tracking only — not shown to the customer.
          </Text>
          <FormFields>
            <Select
              label="Supplier"
              options={[
                { label: suppliers.length ? "Select supplier" : "No suppliers yet", value: "" },
                ...suppliers.map((s) => ({ label: s.name, value: s.id })),
              ]}
              value={supplierId}
              onChange={setSupplierId}
            />
            <TextField
              label="Recoverable amount"
              type="number"
              value={supplierAmount}
              onChange={setSupplierAmount}
              autoComplete="off"
            />
            <Select
              label="Status"
              options={["NOT_FILED", "FILED", "ACCEPTED", "REJECTED", "REIMBURSED"].map((s) => ({
                label: s.replaceAll("_", " "),
                value: s,
              }))}
              value={supplierStatus}
              onChange={setSupplierStatus}
            />
          </FormFields>
          <InlineStack gap="200">
            <Button
              variant="primary"
              loading={busy}
              onClick={() => {
                const cents = supplierAmount
                  ? Math.round(parseFloat(supplierAmount) * 100)
                  : null;
                onSaveSupplier({
                  supplierId,
                  amountCents: cents && !Number.isNaN(cents) ? cents : null,
                  status: supplierStatus,
                });
              }}
            >
              Save recovery
            </Button>
            <Button url={appHref("/suppliers")} variant="plain">
              Manage suppliers
            </Button>
          </InlineStack>
        </div>
      ) : null}
    </div>
  );
}

function FormFields({ children }: { children: ReactNode }) {
  return <BlockStack gap="300">{children}</BlockStack>;
}
