"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { appHref } from "@/lib/shop-context";

type OrderOption = {
  id: string;
  orderNumber: string;
  email: string | null;
  processedAt: string | null;
  customer: { id: string | null; email: string | null; name: string | null };
  lineItems: {
    id: string;
    title: string;
    sku: string | null;
    quantity: number;
    hasWarranty: boolean;
    warrantyId: string | null;
    serialNumber: string | null;
  }[];
};

export default function NewClaimPage() {
  const router = useRouter();
  const [orderQuery, setOrderQuery] = useState("");
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const q = orderQuery.trim();
    if (q.length < 1) {
      setOrders([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      gqlRequest<{ searchOrders: OrderOption[] }>(
        `#graphql
        query SearchOrders($query: String) {
          searchOrders(query: $query, limit: 12) {
            id orderNumber email processedAt
            customer { id email name }
            lineItems { id title sku quantity hasWarranty warrantyId serialNumber }
          }
        }`,
        { query: q },
      )
        .then((d) => setOrders(d.searchOrders))
        .catch(() => setOrders([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(t);
  }, [orderQuery]);

  function pickOrder(order: OrderOption) {
    setSelectedOrder(order);
    setSelectedLineId(order.lineItems[0]?.id ?? "");
    setEmail(order.customer.email || order.email || "");
    setName(order.customer.name || "");
    setManual(false);
    setError(null);
  }

  function clearOrder() {
    setSelectedOrder(null);
    setSelectedLineId("");
    setOrderQuery("");
    setOrders([]);
  }

  const selectedLine = selectedOrder?.lineItems.find((li) => li.id === selectedLineId) ?? null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!email.trim()) throw new Error("Customer email is required");
      if (!summary.trim()) throw new Error("Summary is required");
      if (selectedOrder && !selectedLineId) throw new Error("Select a product from the order");

      const data = await gqlRequest<{ createMerchantClaim: { id: string } }>(
        `#graphql
        mutation C($input: CreateMerchantClaimInput!) {
          createMerchantClaim(input: $input) { id }
        }`,
        {
          input: {
            email: email.trim(),
            customerName: name.trim() || null,
            issueSummary: summary.trim(),
            issueDetails: details.trim() || null,
            orderNumber: selectedOrder?.orderNumber ?? null,
            orderLineItemId: selectedLineId || null,
            warrantyId: selectedLine?.warrantyId ?? null,
            serialNumber: selectedLine?.serialNumber ?? null,
          },
        },
      );
      router.push(appHref(`/claims/${data.createMerchantClaim.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setLoading(false);
    }
  }

  return (
    <Page
      title="Create claim"
      backAction={{ url: appHref("/claims") }}
      subtitle="Start from an order to auto-fill the customer and product"
    >
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  1. Find the order
                </Text>
                <Text as="p" tone="subdued">
                  Search by order number, customer email, or name. Selecting an order fills the
                  customer and lets you pick the product.
                </Text>
              </BlockStack>

              {!selectedOrder ? (
                <BlockStack gap="300">
                  <TextField
                    label="Search orders"
                    value={orderQuery}
                    onChange={setOrderQuery}
                    autoComplete="off"
                    placeholder="#1001, customer@email.com, or name"
                    helpText={searching ? "Searching…" : orders.length ? `${orders.length} matches` : undefined}
                  />
                  {orders.length > 0 ? (
                    <BlockStack gap="200">
                      {orders.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className="as-claim-tile"
                          style={{ textAlign: "left", cursor: "pointer", width: "100%" }}
                          onClick={() => pickOrder(o)}
                        >
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="050">
                              <Text as="span" fontWeight="semibold">
                                Order {o.orderNumber}
                              </Text>
                              <Text as="span" tone="subdued" variant="bodySm">
                                {o.customer.name || "Customer"} · {o.customer.email || o.email || "No email"}
                                {o.processedAt
                                  ? ` · ${new Date(o.processedAt).toLocaleDateString()}`
                                  : ""}
                              </Text>
                            </BlockStack>
                            <Text as="span" tone="subdued" variant="bodySm">
                              {o.lineItems.length} item{o.lineItems.length === 1 ? "" : "s"}
                            </Text>
                          </InlineStack>
                        </button>
                      ))}
                    </BlockStack>
                  ) : null}
                  <Button variant="plain" onClick={() => setManual(true)}>
                    Skip — enter customer details manually
                  </Button>
                </BlockStack>
              ) : (
                <div className="as-claim-tile" style={{ background: "#f8fafc" }}>
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">
                        Order {selectedOrder.orderNumber}
                      </Text>
                      <Text as="p" tone="subdued">
                        {selectedOrder.customer.name || "Customer"} ·{" "}
                        {selectedOrder.customer.email || selectedOrder.email || "No email"}
                      </Text>
                    </BlockStack>
                    <Button onClick={clearOrder}>Change order</Button>
                  </InlineStack>

                  <BlockStack gap="200">
                    <Text as="p" fontWeight="semibold">
                      2. Select product
                    </Text>
                    {selectedOrder.lineItems.map((li) => {
                      const active = li.id === selectedLineId;
                      return (
                        <button
                          key={li.id}
                          type="button"
                          onClick={() => setSelectedLineId(li.id)}
                          style={{
                            textAlign: "left",
                            cursor: "pointer",
                            borderRadius: 12,
                            border: active ? "2px solid #0f172a" : "1px solid #e2e8f0",
                            background: active ? "#fff" : "#fff",
                            padding: "12px 14px",
                            boxShadow: active ? "0 0 0 3px rgba(59,130,246,0.2)" : "none",
                          }}
                        >
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="050">
                              <Text as="span" fontWeight="semibold">
                                {li.title}
                              </Text>
                              <Text as="span" tone="subdued" variant="bodySm">
                                Qty {li.quantity}
                                {li.sku ? ` · SKU ${li.sku}` : ""}
                                {li.hasWarranty ? " · Warranty on file" : " · No warranty yet"}
                                {li.serialNumber ? ` · Serial ${li.serialNumber}` : ""}
                              </Text>
                            </BlockStack>
                            {active ? (
                              <Text as="span" tone="success" variant="bodySm">
                                Selected
                              </Text>
                            ) : null}
                          </InlineStack>
                        </button>
                      );
                    })}
                  </BlockStack>
                </div>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {(selectedOrder || manual) && (
          <Layout.Section>
            <Card>
              <form onSubmit={onSubmit}>
                <FormLayout>
                  <Text as="h2" variant="headingMd">
                    {selectedOrder ? "3. Claim details" : "Claim details"}
                  </Text>
                  {selectedOrder ? (
                    <Banner tone="info">
                      Customer details were filled from the selected order. You can still edit them
                      before creating the claim.
                    </Banner>
                  ) : null}
                  <TextField
                    label="Customer email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                    requiredIndicator
                  />
                  <TextField
                    label="Customer name"
                    value={name}
                    onChange={setName}
                    autoComplete="name"
                  />
                  <TextField
                    label="Summary"
                    value={summary}
                    onChange={setSummary}
                    autoComplete="off"
                    requiredIndicator
                    placeholder={
                      selectedLine ? `Issue with ${selectedLine.title}` : "Short description of the issue"
                    }
                  />
                  <TextField
                    label="Details"
                    value={details}
                    onChange={setDetails}
                    multiline={4}
                    autoComplete="off"
                  />
                  <Button submit variant="primary" loading={loading}>
                    Create claim
                  </Button>
                </FormLayout>
              </form>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
