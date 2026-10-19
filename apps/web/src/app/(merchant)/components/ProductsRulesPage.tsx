"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  FormLayout,
  InlineStack,
  Modal,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { PageEmpty, PageLoading } from "./PageLoading";

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

function durationLabel(months: number | null | undefined) {
  if (months == null) return "Lifetime";
  if (months === 12) return "12 months";
  if (months === 24) return "24 months";
  return `${months} mo`;
}

export function ProductsRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [serialLists, setSerialLists] = useState<SerialList[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [serialOpen, setSerialOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<"rules" | "products" | "serials">("rules");

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
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    gqlRequest<{ warrantyRules: Rule[]; products: Product[]; serialLists: SerialList[] }>(RULES_QUERY)
      .then((d) => {
        setRules(d.warrantyRules);
        setProducts(d.products);
        setSerialLists(d.serialLists);
        if (d.serialLists[0]) setSerialListId(d.serialLists[0].id);
        setHasLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const covered = useMemo(
    () => products.filter((p) => p.coverageLabel !== "No coverage").length,
    [products],
  );

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
            { label: "Choose from list or enter below", value: "" },
            ...products.map((p) => ({ label: p.title, value: p.id })),
          ]}
          value={targetId}
          onChange={setTargetId}
        />
      ) : null}
      {targetType !== "default" ? (
        <TextField label="Product or collection ID" value={targetId} onChange={setTargetId} autoComplete="off" />
      ) : null}
      <TextField
        label="Warranty terms"
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
      secondaryActions={[
        { content: "Help", onAction: () => setHelpOpen(true) },
        { content: "Refresh", onAction: load },
      ]}
    >
      <div className="as-m-studio">
        <header className="as-m-studio__hero as-m-studio__hero--rules">
          <div>
            <p className="as-m-studio__kicker">Coverage engine</p>
            <h2>Warranty rules &amp; catalog</h2>
          </div>
          <div className="as-m-studio__stats">
            <div>
              <strong>{hasLoaded ? rules.length : "—"}</strong>
              <span>Rules</span>
            </div>
            <div>
              <strong>{hasLoaded ? `${covered}/${products.length || 0}` : "—"}</strong>
              <span>Covered</span>
            </div>
            <div>
              <strong>{hasLoaded ? serialLists.length : "—"}</strong>
              <span>Serial lists</span>
            </div>
          </div>
        </header>

        {error ? (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        ) : null}
        {success ? (
          <Banner tone="success" onDismiss={() => setSuccess(null)}>
            {success}
          </Banner>
        ) : null}

        <div className="as-m-studio__tabs" role="tablist">
          {(
            [
              ["rules", "Rules"],
              ["products", "Products"],
              ["serials", "Serials"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="as-m-studio__tab"
              data-active={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && !hasLoaded ? (
          <PageLoading label="Loading coverage" />
        ) : (
          <>
            {tab === "rules" ? (
              <section className="as-m-studio__panel" data-tour="rules-panel">
                {rules.length === 0 ? (
                  <PageEmpty
                    title="No rules yet"
                    body="Create a default rule so new orders receive warranties."
                    action={<Button onClick={() => setOpen(true)}>Create rule</Button>}
                  />
                ) : (
                  <div className="as-m-rule-grid">
                    {rules.map((r) => (
                      <article key={r.id} className="as-m-rule-card as-m-rule-card--pro">
                        <div className="as-m-rule-card__top">
                          <div>
                            <h3>{r.name}</h3>
                            <p>
                              {durationLabel(r.currentVersion?.durationMonths)} ·{" "}
                              {r.currentVersion?.warrantyType || "store"} · priority {r.priority}
                            </p>
                          </div>
                          <Badge tone={r.active ? "success" : undefined}>
                            {r.active ? "Active" : "Off"}
                          </Badge>
                        </div>
                        <div className="as-m-rule-card__tags">
                          {r.assignments.map((a, i) => (
                            <span key={`${a.targetType}-${i}`}>{a.targetType}</span>
                          ))}
                          <span>{(r.currentVersion?.serialMode || "NOT_REQUIRED").replaceAll("_", " ").toLowerCase()}</span>
                        </div>
                        <div className="as-m-rule-card__foot">
                          <Button onClick={() => openEdit(r)}>Edit rule</Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {tab === "products" ? (
              <section className="as-m-studio__panel">
                {products.length === 0 ? (
                  <PageEmpty
                    title="No products synced"
                    body="Catalog products appear after Shopify sync. Check Settings if this stays empty."
                  />
                ) : (
                  <div className="as-m-product-grid">
                    {products.map((p) => {
                      const uncovered = p.coverageLabel === "No coverage";
                      return (
                        <article
                          key={p.id}
                          className="as-m-product-tile"
                          data-uncovered={uncovered ? "true" : "false"}
                        >
                          <div className="as-m-product-tile__mark" aria-hidden>
                            {p.title.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <strong>{p.title}</strong>
                            <Badge tone={uncovered ? "attention" : "success"}>{p.coverageLabel}</Badge>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {tab === "serials" ? (
              <section className="as-m-studio__panel" data-tour="serials-panel">
                <div className="as-m-serial-composer">
                  <TextField
                    label="New list name"
                    value={serialListName}
                    onChange={setSerialListName}
                    autoComplete="off"
                  />
                  <InlineStack gap="200">
                    <Button onClick={createSerialList} loading={saving} disabled={!serialListName.trim()}>
                      Create list
                    </Button>
                    <Button onClick={() => setSerialOpen(true)} disabled={serialLists.length === 0}>
                      Import serials
                    </Button>
                  </InlineStack>
                </div>
                {serialLists.length === 0 ? (
                  <PageEmpty title="No serial lists" body="Create a list, then import serial numbers for validated registration." />
                ) : (
                  <div className="as-m-serial-grid">
                    {serialLists.map((l) => (
                      <article key={l.id} className="as-m-serial-card">
                        <h3>{l.name}</h3>
                        <p>
                          <strong>{l.entryCount}</strong> serials
                          {l.ruleId
                            ? ` · ${rules.find((r) => r.id === l.ruleId)?.name ?? "linked rule"}`
                            : " · not linked"}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </>
        )}
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Coverage help" primaryAction={{ content: "Got it", onAction: () => setHelpOpen(false) }}>
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">Rules define duration, start date, serial checks, and which products they apply to. Lower priority numbers win first.</Text>
            <Text as="p" tone="subdued">Products show live coverage labels from your rules. Serial lists are required when a rule uses “Validated against list”.</Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Create warranty rule" primaryAction={{ content: "Create", onAction: createRule, loading: saving }} secondaryActions={[{ content: "Cancel", onAction: () => setOpen(false) }]}>
        <Modal.Section>{formFields}</Modal.Section>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit rule" primaryAction={{ content: "Save & publish", onAction: saveEdit, loading: saving }} secondaryActions={[{ content: "Cancel", onAction: () => setEditOpen(false) }]}>
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
                options={
                  serialLists.length
                    ? serialLists.map((l) => ({ label: `${l.name} (${l.entryCount})`, value: l.id }))
                    : [{ label: "Create a list first", value: "" }]
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
