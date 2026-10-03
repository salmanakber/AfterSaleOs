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
import { TourTrigger, useOptionalTour } from "./ProductTour";

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
    termsHtml: string | null;
  } | null;
  assignments: { targetType: string; targetId: string | null }[];
};

type Product = {
  id: string;
  title: string;
  coverageLabel: string;
};

type SerialList = {
  id: string;
  name: string;
  ruleId: string | null;
  entryCount: number;
};

const RULES_QUERY = `#graphql
  query RulesPage {
    warrantyRules {
      id name priority active
      currentVersion { warrantyType durationMonths startDateRule serialMode gracePeriodDays termsHtml }
      assignments { targetType targetId }
    }
    products(limit: 30) { id title coverageLabel }
    serialLists { id name ruleId entryCount }
  }
`;

const CREATE_RULE = `#graphql
  mutation CreateRule($input: CreateRuleInput!) {
    createWarrantyRule(input: $input) { id name }
  }
`;

const UPDATE_RULE = `#graphql
  mutation UpdateRule($id: ID!, $name: String, $priority: Int, $active: Boolean, $assignments: [RuleAssignmentInput!]) {
    updateWarrantyRule(id: $id, name: $name, priority: $priority, active: $active, assignments: $assignments) {
      id name priority active
    }
  }
`;

const PUBLISH = `#graphql
  mutation Publish($id: ID!, $version: RuleVersionInput!) {
    publishWarrantyRuleVersion(id: $id, version: $version) { id name }
  }
`;

const CREATE_SERIAL_LIST = `#graphql
  mutation NewSerialList($name: String!) {
    createSerialList(name: $name) { id name entryCount }
  }
`;

const ADD_SERIALS = `#graphql
  mutation AddSerials($serialListId: ID!, $serials: [String!]!) {
    addSerialNumbers(serialListId: $serialListId, serials: $serials) { added submitted }
  }
`;

const LINK_SERIAL_LIST = `#graphql
  mutation LinkSerialList($serialListId: ID!, $ruleId: ID!) {
    linkSerialListToRule(serialListId: $serialListId, ruleId: $ruleId) { id ruleId }
  }
`;

export function ProductsRulesPage() {
  const tour = useOptionalTour();
  const [rules, setRules] = useState<Rule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [serialLists, setSerialLists] = useState<SerialList[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [serialOpen, setSerialOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [name, setName] = useState("Store warranty");
  const [warrantyType, setWarrantyType] = useState("store");
  const [duration, setDuration] = useState("12");
  const [startRule, setStartRule] = useState("FULFILLMENT_DATE");
  const [serialMode, setSerialMode] = useState("NOT_REQUIRED");
  const [targetType, setTargetType] = useState("default");
  const [targetId, setTargetId] = useState("");
  const [termsHtml, setTermsHtml] = useState("<p>Standard warranty terms. Customize for your store.</p>");
  const [priority, setPriority] = useState("100");
  const [active, setActive] = useState(true);

  const [serialListName, setSerialListName] = useState("");
  const [serialBulk, setSerialBulk] = useState("");
  const [serialListId, setSerialListId] = useState("");
  const [editSerialListId, setEditSerialListId] = useState("");

  const load = useCallback(() => {
    gqlRequest<{ warrantyRules: Rule[]; products: Product[]; serialLists: SerialList[] }>(RULES_QUERY)
      .then((d) => {
        setRules(d.warrantyRules);
        setProducts(d.products);
        setSerialLists(d.serialLists);
        if (d.serialLists[0]) setSerialListId(d.serialLists[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function versionPayload() {
    const durationMonths = duration.trim() === "" || duration === "lifetime" ? null : Number(duration);
    return {
      warrantyType,
      durationMonths,
      startDateRule: startRule,
      serialMode,
      gracePeriodDays: 0,
      termsHtml,
    };
  }

  async function createRule() {
    setSaving(true);
    setError(null);
    try {
      await gqlRequest(CREATE_RULE, {
        input: {
          name,
          priority: Number(priority) || 100,
          version: versionPayload(),
          assignments: [{ targetType, targetId: targetId || null }],
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

  function openEdit(r: Rule) {
    setEditId(r.id);
    setName(r.name);
    setPriority(String(r.priority));
    setActive(r.active);
    const v = r.currentVersion;
    setWarrantyType(v?.warrantyType ?? "store");
    setDuration(v?.durationMonths == null ? "lifetime" : String(v.durationMonths));
    setStartRule(v?.startDateRule ?? "FULFILLMENT_DATE");
    setSerialMode(v?.serialMode ?? "NOT_REQUIRED");
    setTermsHtml(v?.termsHtml ?? termsHtml);
    const a = r.assignments[0];
    setTargetType(a?.targetType ?? "default");
    setTargetId(a?.targetId ?? "");
    const linked = serialLists.find((l) => l.ruleId === r.id);
    setEditSerialListId(linked?.id ?? serialLists[0]?.id ?? "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    setError(null);
    try {
      await gqlRequest(UPDATE_RULE, {
        id: editId,
        name,
        priority: Number(priority) || 100,
        active,
        assignments: [{ targetType, targetId: targetId || null }],
      });
      await gqlRequest(PUBLISH, { id: editId, version: versionPayload() });
      if (serialMode === "VALIDATED_AGAINST_LIST" && editSerialListId) {
        await gqlRequest(LINK_SERIAL_LIST, { serialListId: editSerialListId, ruleId: editId });
      }
      setEditOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function createSerialList() {
    setSaving(true);
    try {
      await gqlRequest(CREATE_SERIAL_LIST, { name: serialListName });
      setSerialListName("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function importSerials() {
    if (!serialListId) return;
    setSaving(true);
    const serials = serialBulk.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    try {
      const res = await gqlRequest<{ addSerialNumbers: { added: number; submitted: number } }>(ADD_SERIALS, {
        serialListId,
        serials,
      });
      setSerialBulk("");
      setSerialOpen(false);
      setError(null);
      setSuccess(`Added ${res.addSerialNumbers.added} of ${res.addSerialNumbers.submitted} serials.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSaving(false);
    }
  }

  const formFields = (
    <FormLayout>
      <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
      <TextField label="Priority (lower wins first)" value={priority} onChange={setPriority} autoComplete="off" />
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
      <TextField label="Duration (months, blank = lifetime)" value={duration} onChange={setDuration} autoComplete="off" />
      <Select
        label="Start date"
        options={[
          { label: "Fulfillment date", value: "FULFILLMENT_DATE" },
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
          { label: "Product", value: "product" },
          { label: "Variant", value: "variant" },
          { label: "Collection", value: "collection" },
        ]}
        value={targetType}
        onChange={setTargetType}
      />
      {targetType !== "default" ? (
        <Select
          label="Product target"
          options={[
            { label: "Enter ID below", value: "" },
            ...products.map((p) => ({ label: p.title, value: p.id })),
          ]}
          value={targetId}
          onChange={setTargetId}
        />
      ) : null}
      {targetType !== "default" ? (
        <TextField label="Target ID" value={targetId} onChange={setTargetId} autoComplete="off" helpText="Shopify product/variant/collection GID or numeric ID" />
      ) : null}
      <TextField
        label="Terms (HTML)"
        value={termsHtml}
        onChange={setTermsHtml}
        multiline={6}
        autoComplete="off"
      />
    </FormLayout>
  );

  return (
    <Page
      title="Products & Rules"
      primaryAction={{ content: "Create rule", onAction: () => setOpen(true) }}
      secondaryActions={
        tour ? [{ content: "Take a tour", onAction: () => tour.startTour("rules", { force: true }) }] : undefined
      }
    >
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" title="Error" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        ) : null}
        {success ? (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccess(null)}>
              <p>{success}</p>
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <div data-tour="rules-panel">
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
                      </InlineStack>
                      <Text as="p" tone="subdued" variant="bodySm">
                        {r.currentVersion?.durationMonths == null
                          ? "Lifetime"
                          : `${r.currentVersion.durationMonths} months`}{" "}
                        · {r.assignments.map((a) => a.targetType).join(", ")} · priority {r.priority}
                      </Text>
                    </BlockStack>
                    <Button onClick={() => openEdit(r)}>Edit</Button>
                  </InlineStack>
                ))
              )}
            </BlockStack>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div data-tour="serials-panel">
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Serial lists
                </Text>
                <InlineStack gap="200">
                  <Button onClick={() => setSerialOpen(true)} disabled={serialLists.length === 0}>
                    Import serials
                  </Button>
                </InlineStack>
              </InlineStack>
              <FormLayout>
                <TextField label="New list name" value={serialListName} onChange={setSerialListName} autoComplete="off" />
                <Button onClick={createSerialList} loading={saving}>
                  Create list
                </Button>
              </FormLayout>
              {serialLists.map((l) => (
                <Text as="p" key={l.id}>
                  {l.name} — {l.entryCount} serials
                  {l.ruleId ? ` · linked to rule ${rules.find((r) => r.id === l.ruleId)?.name ?? l.ruleId}` : ""}
                </Text>
              ))}
            </BlockStack>
            </div>
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

      <Modal open={open} onClose={() => setOpen(false)} title="Create warranty rule" primaryAction={{ content: "Create", onAction: createRule, loading: saving }} secondaryActions={[{ content: "Cancel", onAction: () => setOpen(false) }]}>
        <Modal.Section>{formFields}</Modal.Section>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit rule" primaryAction={{ content: "Save & publish version", onAction: saveEdit, loading: saving }} secondaryActions={[{ content: "Cancel", onAction: () => setEditOpen(false) }]}>
        <Modal.Section>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Rule is active
          </label>
          {formFields}
          {serialMode === "VALIDATED_AGAINST_LIST" ? (
            <div style={{ marginTop: 12 }}>
              <Select
                label="Serial list for this rule"
                helpText="Registration checks serials only in the linked list."
                options={
                  serialLists.length
                    ? serialLists.map((l) => ({ label: `${l.name} (${l.entryCount})`, value: l.id }))
                    : [{ label: "Create a list below first", value: "" }]
                }
                value={editSerialListId}
                onChange={setEditSerialListId}
              />
            </div>
          ) : null}
        </Modal.Section>
      </Modal>

      <Modal open={serialOpen} onClose={() => setSerialOpen(false)} title="Import serial numbers" primaryAction={{ content: "Import", onAction: importSerials, loading: saving }} secondaryActions={[{ content: "Cancel", onAction: () => setSerialOpen(false) }]}>
        <Modal.Section>
          <FormLayout>
            <Select
              label="List"
              options={serialLists.map((l) => ({ label: `${l.name} (${l.entryCount})`, value: l.id }))}
              value={serialListId}
              onChange={setSerialListId}
            />
            <TextField label="Serials (one per line or comma-separated)" value={serialBulk} onChange={setSerialBulk} multiline={8} autoComplete="off" />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
