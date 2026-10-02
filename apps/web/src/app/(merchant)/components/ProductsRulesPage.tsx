"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Layout,
  Modal,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";

type Rule = {
  id: string;
  name: string;
  priority: number;
  active: boolean;
  currentVersion: {
    warrantyType: string;
    durationMonths: number | null;
    startDateRule: string;
    serialMode: string;
    gracePeriodDays: number;
  } | null;
  assignments: { targetType: string; targetId: string | null }[];
};

type Product = {
  id: string;
  title: string;
  coverageLabel: string;
};

const RULES_QUERY = `#graphql
  query RulesPage {
    warrantyRules {
      id name priority active
      currentVersion { warrantyType durationMonths startDateRule serialMode gracePeriodDays }
      assignments { targetType targetId }
    }
    products(limit: 30) { id title coverageLabel }
  }
`;

const CREATE_RULE = `#graphql
  mutation CreateRule($input: CreateRuleInput!) {
    createWarrantyRule(input: $input) {
      id name
    }
  }
`;

export function ProductsRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("Store warranty");
  const [warrantyType, setWarrantyType] = useState("store");
  const [duration, setDuration] = useState("12");
  const [startRule, setStartRule] = useState("FULFILLMENT_DATE");
  const [serialMode, setSerialMode] = useState("NOT_REQUIRED");
  const [targetType, setTargetType] = useState("default");

  const load = useCallback(() => {
    gqlRequest<{ warrantyRules: Rule[]; products: Product[] }>(RULES_QUERY)
      .then((d) => {
        setRules(d.warrantyRules);
        setProducts(d.products);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createRule() {
    setSaving(true);
    setError(null);
    try {
      const durationMonths = duration.trim() === "" || duration === "lifetime" ? null : Number(duration);
      await gqlRequest(CREATE_RULE, {
        input: {
          name,
          priority: 100,
          version: {
            warrantyType,
            durationMonths,
            startDateRule: startRule,
            serialMode,
            gracePeriodDays: 0,
            termsHtml: "<p>Standard warranty terms. Merchant should customize.</p>",
          },
          assignments: [{ targetType, targetId: null }],
        },
      });
      setOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page
      title="Products & Rules"
      primaryAction={{ content: "Create rule", onAction: () => setOpen(true) }}
    >
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" title="Error" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Warranty rules
              </Text>
              {rules.length === 0 ? (
                <Text as="p" tone="subdued">
                  No rules yet. Create a default rule so new orders receive warranties.
                </Text>
              ) : (
                rules.map((r) => (
                  <InlineStack key={r.id} align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <InlineStack gap="200">
                        <Text as="span" fontWeight="semibold">
                          {r.name}
                        </Text>
                        <Badge tone={r.active ? "success" : "info"}>{r.active ? "Active" : "Inactive"}</Badge>
                        <Badge>{r.currentVersion?.warrantyType ?? "—"}</Badge>
                      </InlineStack>
                      <Text as="p" tone="subdued" variant="bodySm">
                        {r.currentVersion?.durationMonths == null
                          ? "Lifetime"
                          : `${r.currentVersion.durationMonths} months`}{" "}
                        · starts on {r.currentVersion?.startDateRule ?? "—"} ·{" "}
                        {r.assignments.map((a) => a.targetType).join(", ")} · priority {r.priority}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                ))
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Product coverage
              </Text>
              {products.length === 0 ? (
                <Text as="p" tone="subdued">
                  Products appear after Shopify product webhooks sync (or backfill).
                </Text>
              ) : (
                products.map((p) => (
                  <InlineStack key={p.id} align="space-between">
                    <Text as="span">{p.title}</Text>
                    <Badge tone={p.coverageLabel === "No coverage" ? "attention" : "success"}>
                      {p.coverageLabel}
                    </Badge>
                  </InlineStack>
                ))
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create warranty rule"
        primaryAction={{ content: "Create", onAction: createRule, loading: saving }}
        secondaryActions={[{ content: "Cancel", onAction: () => setOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
            <Select
              label="Warranty type"
              options={[
                { label: "Store", value: "store" },
                { label: "Manufacturer", value: "manufacturer" },
                { label: "Extended", value: "extended" },
              ]}
              value={warrantyType}
              onChange={setWarrantyType}
            />
            <TextField
              label="Duration (months, blank = lifetime)"
              value={duration}
              onChange={setDuration}
              autoComplete="off"
            />
            <Select
              label="Start date"
              options={[
                { label: "Fulfillment date (default)", value: "FULFILLMENT_DATE" },
                { label: "Purchase date", value: "PURCHASE_DATE" },
                { label: "Delivery date", value: "DELIVERY_DATE" },
                { label: "Registration date", value: "REGISTRATION_DATE" },
              ]}
              value={startRule}
              onChange={setStartRule}
            />
            <Select
              label="Serial mode"
              options={[
                { label: "Not required", value: "NOT_REQUIRED" },
                { label: "Customer-entered unique", value: "CUSTOMER_ENTERED_UNIQUE" },
                { label: "Validated against list", value: "VALIDATED_AGAINST_LIST" },
                { label: "Assigned at fulfillment", value: "ASSIGNED_AT_FULFILLMENT" },
              ]}
              value={serialMode}
              onChange={setSerialMode}
            />
            <Select
              label="Applies to"
              options={[
                { label: "Default (all products)", value: "default" },
                { label: "Product (set target later)", value: "product" },
                { label: "Variant", value: "variant" },
                { label: "Collection", value: "collection" },
              ]}
              value={targetType}
              onChange={setTargetType}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
