"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";

type ClaimDetail = {
  id: string;
  claimNumber: string;
  status: string;
  workflowStatusKey: string | null;
  customerEmail: string | null;
  customerName: string | null;
  productTitle: string | null;
  orderNumber: string | null;
  serialNumber: string | null;
  issueCategory: string | null;
  issueSummary: string | null;
  issueDetails: string | null;
  eligibilityLabel: string;
  eligibilityReasons: string[];
  eligibilityOverride: boolean;
  trackingUrl: string;
  slaDueAt: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
  notes: { id: string; body: string; isInternal: boolean; authorType: string; createdAt: string }[];
  attachments: { id: string; fileName: string; downloadUrl: string | null; scanStatus: string }[];
};

type WorkflowStatus = { key: string; label: string };
type Supplier = { id: string; name: string };

const DETAIL = `#graphql
  query Claim($id: ID!) {
    claim(id: $id) {
      id claimNumber status workflowStatusKey customerEmail customerName productTitle orderNumber serialNumber
      issueCategory issueSummary issueDetails eligibilityLabel eligibilityReasons eligibilityOverride
      trackingUrl slaDueAt
      assignee { id name email }
      notes { id body isInternal authorType createdAt }
      attachments { id fileName downloadUrl scanStatus }
    }
    staffMembers { id name email }
    claimWorkflow { statuses { key label } }
    suppliers { id name }
  }
`;

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [workflowStatuses, setWorkflowStatuses] = useState<WorkflowStatus[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("OPEN");
  const [workflowKey, setWorkflowKey] = useState("");
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [warrantyMode, setWarrantyMode] = useState("INHERIT_REMAINING");
  const [supplierId, setSupplierId] = useState("");
  const [supplierAmount, setSupplierAmount] = useState("");
  const [supplierStatus, setSupplierStatus] = useState("NOT_FILED");

  const load = useCallback(() => {
    gqlRequest<{
      claim: ClaimDetail | null;
      staffMembers: typeof staff;
      claimWorkflow: { statuses: WorkflowStatus[] };
      suppliers: Supplier[];
    }>(DETAIL, { id })
      .then((d) => {
        if (!d.claim) throw new Error("Claim not found");
        setClaim(d.claim);
        setStatus(d.claim.status);
        setWorkflowKey(d.claim.workflowStatusKey ?? "");
        setAssigneeId(d.claim.assignee?.id ?? "");
        setStaff(d.staffMembers);
        setWorkflowStatuses(d.claimWorkflow.statuses);
        setSuppliers(d.suppliers);
        if (!supplierId && d.suppliers[0]) setSupplierId(d.suppliers[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id, supplierId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveStatus() {
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation U($id: ID!, $status: String!, $note: String) {
          updateClaimStatus(id: $id, status: $status, note: $note) { id status }
        }`,
        { id, status, note: note || null },
      );
      setNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyWorkflow() {
    if (!workflowKey) return;
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation W($claimId: ID!, $statusKey: String!, $note: String) {
          applyClaimWorkflowStatus(claimId: $claimId, statusKey: $statusKey, note: $note) {
            id status workflowStatusKey
          }
        }`,
        { claimId: id, statusKey: workflowKey, note: note || null },
      );
      setNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workflow update failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!internalNote.trim()) return;
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation N($id: ID!, $body: String!, $isInternal: Boolean) {
          addClaimNote(id: $id, body: $body, isInternal: $isInternal) { id }
        }`,
        { id, body: internalNote, isInternal: true },
      );
      setInternalNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Note failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveAssignee() {
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation A($id: ID!, $assigneeId: ID) {
          assignClaim(id: $id, assigneeId: $assigneeId) { id }
        }`,
        { id, assigneeId: assigneeId || null },
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function overrideEligibility() {
    const reason = window.prompt("Override reason (required)");
    if (!reason) return;
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation O($id: ID!, $reason: String!) {
          overrideClaimEligibility(id: $id, reason: $reason) { id eligibilityOverride }
        }`,
        { id, reason },
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override failed");
    } finally {
      setBusy(false);
    }
  }

  async function createRepair() {
    setBusy(true);
    try {
      const data = await gqlRequest<{ createRepair: { id: string } }>(
        `#graphql
        mutation R($input: CreateRepairInput!) {
          createRepair(input: $input) { id }
        }`,
        { input: { claimId: id, technicianId: assigneeId || null } },
      );
      window.location.href = `/repairs/${data.createRepair.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Repair failed");
      setBusy(false);
    }
  }

  async function createReplacement() {
    setBusy(true);
    try {
      const data = await gqlRequest<{
        createReplacementDraftOrder: { id: string; adminOrderUrl: string | null };
      }>(
        `#graphql
        mutation Rep($input: CreateReplacementInput!) {
          createReplacementDraftOrder(input: $input) { id adminOrderUrl }
        }`,
        { input: { claimId: id, warrantyMode } },
      );
      load();
      if (data.createReplacementDraftOrder.adminOrderUrl) {
        window.open(data.createReplacementDraftOrder.adminOrderUrl, "_blank");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Replacement failed");
    } finally {
      setBusy(false);
    }
  }

  async function recordRefundAction() {
    const cents = Math.round(parseFloat(refundAmount || "0") * 100);
    if (!cents) {
      setError("Enter a refund amount");
      return;
    }
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation Rf($input: RecordRefundInput!) {
          recordRefund(input: $input) { id }
        }`,
        {
          input: {
            claimId: id,
            amountCents: cents,
            reason: refundReason || null,
            issuedInShopify: false,
          },
        },
      );
      setRefundAmount("");
      setRefundReason("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setBusy(false);
    }
  }

  async function markSupplierRecoverable() {
    if (!supplierId) {
      setError("Create a supplier first");
      return;
    }
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation S($input: UpsertSupplierClaimInput!) {
          upsertSupplierClaim(input: $input) { id }
        }`,
        {
          input: {
            claimId: id,
            supplierId,
            amountCents: supplierAmount
              ? Math.round(parseFloat(supplierAmount) * 100)
              : null,
            status: supplierStatus,
            recoverable: true,
          },
        },
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supplier claim failed");
    } finally {
      setBusy(false);
    }
  }

  if (!claim && !error) {
    return (
      <Page title="Claim">
        <Text as="p">Loading…</Text>
      </Page>
    );
  }

  if (!claim) {
    return (
      <Page title="Claim">
        <Banner tone="critical">{error}</Banner>
      </Page>
    );
  }

  return (
    <Page
      title={claim.claimNumber}
      backAction={{ url: "/claims" }}
      subtitle={claim.customerEmail ?? undefined}
      titleMetadata={<Badge>{claim.status}</Badge>}
      secondaryActions={[{ content: "Customer tracking", url: claim.trackingUrl, external: true }]}
    >
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Customer & product
              </Text>
              <Text as="p">
                {claim.customerName ?? "—"} · {claim.customerEmail}
              </Text>
              <Text as="p">{claim.productTitle ?? "No product linked"}</Text>
              <Text as="p" tone="subdued">
                Order {claim.orderNumber ?? "—"} · Serial {claim.serialNumber ?? "—"}
              </Text>
              <Text as="p">
                <strong>{claim.issueSummary}</strong>
              </Text>
              {claim.issueDetails ? <Text as="p">{claim.issueDetails}</Text> : null}
              <Text as="p" tone="subdued">
                Category: {claim.issueCategory ?? "—"}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Eligibility
              </Text>
              <Text as="p">{claim.eligibilityLabel}</Text>
              <BlockStack gap="100">
                {claim.eligibilityReasons.map((r, i) => (
                  <Text as="p" key={i} tone="subdued">
                    · {r}
                  </Text>
                ))}
              </BlockStack>
              {claim.eligibilityOverride ? (
                <Badge tone="attention">Override applied</Badge>
              ) : (
                <Button onClick={overrideEligibility}>Override eligibility</Button>
              )}
              <Text as="p" tone="subdued">
                Eligibility never auto-rejects. Merchant decides.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Actions
              </Text>
              <FormLayout>
                <Select
                  label="Status"
                  options={[
                    "OPEN",
                    "IN_REVIEW",
                    "WAITING_CUSTOMER",
                    "APPROVED",
                    "REJECTED",
                    "IN_RESOLUTION",
                    "COMPLETED",
                    "CANCELLED",
                  ].map((s) => ({ label: s, value: s }))}
                  value={status}
                  onChange={setStatus}
                />
                <TextField
                  label="Customer-visible note (optional)"
                  value={note}
                  onChange={setNote}
                  multiline={3}
                  autoComplete="off"
                />
                <Button variant="primary" loading={busy} onClick={saveStatus}>
                  Update status
                </Button>
                {workflowStatuses.length > 0 ? (
                  <>
                    <Select
                      label="Workflow status"
                      options={[
                        { label: "Select…", value: "" },
                        ...workflowStatuses.map((s) => ({ label: s.label, value: s.key })),
                      ]}
                      value={workflowKey}
                      onChange={setWorkflowKey}
                    />
                    <Button onClick={applyWorkflow} loading={busy}>
                      Apply workflow status
                    </Button>
                  </>
                ) : null}
                <Select
                  label="Assignee"
                  options={[
                    { label: "Unassigned", value: "" },
                    ...staff.map((s) => ({
                      label: s.name ? `${s.name} (${s.email})` : s.email,
                      value: s.id,
                    })),
                  ]}
                  value={assigneeId}
                  onChange={setAssigneeId}
                />
                <Button onClick={saveAssignee} loading={busy}>
                  Save assignee
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Resolve
              </Text>
              <Button onClick={createRepair} loading={busy}>
                Create repair
              </Button>
              <Select
                label="Replacement warranty mode"
                options={[
                  { label: "Inherit remaining term", value: "INHERIT_REMAINING" },
                  { label: "Restart warranty", value: "RESTART" },
                ]}
                value={warrantyMode}
                onChange={setWarrantyMode}
              />
              <Button onClick={createReplacement} loading={busy}>
                Create replacement draft order
              </Button>
              <TextField
                label="Refund amount"
                type="number"
                value={refundAmount}
                onChange={setRefundAmount}
                prefix="$"
                autoComplete="off"
              />
              <TextField
                label="Refund reason"
                value={refundReason}
                onChange={setRefundReason}
                autoComplete="off"
              />
              <Button onClick={recordRefundAction} loading={busy}>
                Record refund
              </Button>
              <Select
                label="Supplier (recoverable)"
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
                prefix="$"
                autoComplete="off"
              />
              <Select
                label="Supplier claim status"
                options={[
                  "NOT_FILED",
                  "FILED",
                  "ACCEPTED",
                  "REJECTED",
                  "REIMBURSED",
                ].map((s) => ({ label: s.replaceAll("_", " "), value: s }))}
                value={supplierStatus}
                onChange={setSupplierStatus}
              />
              <Button onClick={markSupplierRecoverable} loading={busy}>
                Save supplier recovery
              </Button>
              <Button url="/suppliers" variant="plain">
                Manage suppliers
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Timeline
              </Text>
              {claim.notes.map((n) => (
                <BlockStack gap="050" key={n.id}>
                  <InlineStack gap="200">
                    <Badge tone={n.isInternal ? "attention" : undefined}>
                      {n.isInternal ? "Internal" : n.authorType}
                    </Badge>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {new Date(n.createdAt).toLocaleString()}
                    </Text>
                  </InlineStack>
                  <Text as="p">{n.body}</Text>
                </BlockStack>
              ))}
              <TextField
                label="Internal note"
                value={internalNote}
                onChange={setInternalNote}
                multiline={3}
                autoComplete="off"
              />
              <Button onClick={saveNote} loading={busy}>
                Add internal note
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {claim.attachments.length > 0 ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Attachments
                </Text>
                {claim.attachments.map((a) => (
                  <InlineStack key={a.id} gap="200">
                    <Text as="span">{a.fileName}</Text>
                    <Badge>{a.scanStatus}</Badge>
                    {a.downloadUrl ? (
                      <Button url={a.downloadUrl} external variant="plain">
                        Open
                      </Button>
                    ) : null}
                  </InlineStack>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : null}
      </Layout>
    </Page>
  );
}
