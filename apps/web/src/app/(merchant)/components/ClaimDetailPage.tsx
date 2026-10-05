"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { friendlyError } from "@/lib/merchant-errors";
import { BrandLoader } from "./BrandLoader";

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
    staffMembers { id name email active }
    claimWorkflow { statuses { key label } }
    suppliers { id name }
    aiCreditBalance { used limit remaining }
  }
`;

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string | null; email: string; active?: boolean }[]>([]);
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
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAssist, setAiAssist] = useState<{
    summary: string;
    suggestedCategory: string;
    categoryConfidence: number;
    missingInfo: string[];
    suggestedReply: string;
    nextSteps: string[];
    provider: string;
    creditsRemaining: number;
    creditsLimit: number;
  } | null>(null);
  const [aiCredits, setAiCredits] = useState<{ used: number; limit: number; remaining: number } | null>(
    null,
  );

  const load = useCallback(() => {
    gqlRequest<{
      claim: ClaimDetail | null;
      staffMembers: typeof staff;
      claimWorkflow: { statuses: WorkflowStatus[] };
      suppliers: Supplier[];
      aiCreditBalance: { used: number; limit: number; remaining: number };
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
        setAiCredits(d.aiCreditBalance);
        if (!supplierId && d.suppliers[0]) setSupplierId(d.suppliers[0].id);
      })
      .catch((e) => setError(friendlyError(e)));
  }, [id, supplierId]);

  async function runAiAssist() {
    setAiBusy(true);
    setError(null);
    try {
      const d = await gqlRequest<{
        runClaimAiAssist: NonNullable<typeof aiAssist> & { creditsUsed: number; model: string | null };
      }>(
        `#graphql
        mutation Ai($claimId: ID!) {
          runClaimAiAssist(claimId: $claimId) {
            summary suggestedCategory categoryConfidence missingInfo suggestedReply nextSteps
            provider model creditsUsed creditsRemaining creditsLimit
          }
        }`,
        { claimId: id },
      );
      setAiAssist(d.runClaimAiAssist);
      setAiCredits({
        used: d.runClaimAiAssist.creditsLimit - d.runClaimAiAssist.creditsRemaining,
        limit: d.runClaimAiAssist.creditsLimit,
        remaining: d.runClaimAiAssist.creditsRemaining,
      });
    } catch (e) {
      setError(friendlyError(e, "AI assist failed"));
    } finally {
      setAiBusy(false);
    }
  }

  async function applyAiCategory() {
    if (!aiAssist) return;
    setBusy(true);
    setError(null);
    try {
      await gqlRequest(
        `#graphql
        mutation ApplyCat($claimId: ID!, $category: String!) {
          applyClaimAiCategory(claimId: $claimId, category: $category) { id issueCategory }
        }`,
        { claimId: id, category: aiAssist.suggestedCategory },
      );
      load();
    } catch (e) {
      setError(friendlyError(e, "Could not apply category"));
    } finally {
      setBusy(false);
    }
  }

  function useSuggestedReply() {
    if (!aiAssist) return;
    setNote(aiAssist.suggestedReply);
  }

  async function saveSuggestedAsInternalNote() {
    if (!aiAssist) return;
    setBusy(true);
    setError(null);
    try {
      const body = [
        "AI assist (suggest-only — not a decision)",
        `Summary: ${aiAssist.summary}`,
        `Suggested category: ${aiAssist.suggestedCategory} (${Math.round(aiAssist.categoryConfidence * 100)}%)`,
        aiAssist.missingInfo.length ? `Missing info:\n- ${aiAssist.missingInfo.join("\n- ")}` : null,
        `Draft reply:\n${aiAssist.suggestedReply}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      await gqlRequest(
        `#graphql
        mutation Note($id: ID!, $body: String!) {
          addClaimNote(id: $id, body: $body, isInternal: true) { id }
        }`,
        { id, body },
      );
      load();
    } catch (e) {
      setError(friendlyError(e, "Could not save note"));
    } finally {
      setBusy(false);
    }
  }

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
    setOverrideReason("");
    setOverrideOpen(true);
  }

  async function confirmOverride() {
    if (!overrideReason.trim()) {
      setError("An override reason is required.");
      return;
    }
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation O($id: ID!, $reason: String!) {
          overrideClaimEligibility(id: $id, reason: $reason) { id eligibilityOverride }
        }`,
        { id, reason: overrideReason.trim() },
      );
      setOverrideOpen(false);
      load();
    } catch (e) {
      setError(friendlyError(e, "Override failed"));
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
        <div style={{ padding: "48px 0" }}>
          <BrandLoader label="Opening claim desk" compact />
        </div>
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

  const slaLabel = claim.slaDueAt
    ? `SLA ${new Date(claim.slaDueAt).toLocaleString()}`
    : "No SLA set";

  return (
    <Page
      title={claim.claimNumber}
      backAction={{ url: "/claims" }}
      subtitle={claim.customerEmail ?? undefined}
      titleMetadata={<Badge tone={claim.status === "COMPLETED" ? "success" : claim.status === "REJECTED" ? "critical" : "info"}>{claim.status.replaceAll("_", " ")}</Badge>}
      secondaryActions={[{ content: "Customer tracking", url: claim.trackingUrl, external: true }]}
    >
      <div className="as-claim-desk">
        {error ? (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            <p>{error}</p>
          </Banner>
        ) : null}

        <section className="as-claim-hero">
          <div className="as-claim-hero-kicker">
            <span>●</span> Claim desk
          </div>
          <h2>{claim.issueSummary || claim.claimNumber}</h2>
          <p>
            {claim.customerName || "Customer"} · {claim.customerEmail || "No email"}
            {claim.productTitle ? ` · ${claim.productTitle}` : ""}
          </p>
          <div className="as-claim-hero-meta">
            <span className="as-claim-chip">Status {claim.status.replaceAll("_", " ")}</span>
            <span className="as-claim-chip">Order {claim.orderNumber ?? "—"}</span>
            <span className="as-claim-chip">Serial {claim.serialNumber ?? "—"}</span>
            <span className="as-claim-chip">{slaLabel}</span>
            {claim.assignee ? (
              <span className="as-claim-chip">
                Assignee {claim.assignee.name || claim.assignee.email}
              </span>
            ) : (
              <span className="as-claim-chip">Unassigned</span>
            )}
          </div>
        </section>

        <div className="as-claim-stat-row">
          <div className="as-claim-stat">
            <span>Eligibility</span>
            <strong>{claim.eligibilityLabel}</strong>
          </div>
          <div className="as-claim-stat">
            <span>Category</span>
            <strong>{claim.issueCategory || "Not set"}</strong>
          </div>
          <div className="as-claim-stat">
            <span>Workflow</span>
            <strong>{claim.workflowStatusKey || "Default"}</strong>
          </div>
        </div>

        <div className="as-claim-grid">
          <div className="as-claim-tile">
            <h3>Customer & product</h3>
            <BlockStack gap="200">
              <Text as="p">
                <strong>{claim.customerName ?? "—"}</strong>
                <br />
                {claim.customerEmail}
              </Text>
              <Text as="p">{claim.productTitle ?? "No product linked"}</Text>
              <Text as="p" tone="subdued">
                Order {claim.orderNumber ?? "—"} · Serial {claim.serialNumber ?? "—"}
              </Text>
              {claim.issueDetails ? <Text as="p">{claim.issueDetails}</Text> : null}
            </BlockStack>
          </div>

          <div className="as-claim-tile">
            <h3>Eligibility</h3>
            <BlockStack gap="200">
              <Text as="p" fontWeight="semibold">
                {claim.eligibilityLabel}
              </Text>
              {claim.eligibilityReasons.map((r, i) => (
                <Text as="p" key={i} tone="subdued">
                  · {r}
                </Text>
              ))}
              {claim.eligibilityOverride ? (
                <Badge tone="attention">Override applied</Badge>
              ) : (
                <Button onClick={overrideEligibility}>Override eligibility</Button>
              )}
              <Text as="p" tone="subdued">
                Eligibility never auto-rejects. Your team decides.
              </Text>
            </BlockStack>
          </div>
        </div>

        <div className="as-claim-ai">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                AI assist
              </Text>
              <Text as="p" tone="subdued">
                Suggest-only triage: summary, category, missing info, and a draft reply.
                {aiCredits
                  ? ` · ${aiCredits.remaining}/${aiCredits.limit} credits left this month`
                  : null}
              </Text>
            </BlockStack>
            <Button variant="primary" loading={aiBusy} onClick={() => void runAiAssist()}>
              {aiAssist ? "Run again" : "Analyze claim"}
            </Button>
          </InlineStack>

          {aiAssist ? (
            <BlockStack gap="300">
              <Banner tone="info">
                <p>
                  Provider: {aiAssist.provider}. Staff must review before acting — guidance, not a
                  decision.
                </p>
              </Banner>
              <Text as="p">
                <strong>Summary</strong>
                <br />
                {aiAssist.summary}
              </Text>
              <InlineStack gap="200" blockAlign="center">
                <Text as="p">
                  Suggested category: <strong>{aiAssist.suggestedCategory}</strong> (
                  {Math.round(aiAssist.categoryConfidence * 100)}% confidence)
                </Text>
                <Button size="slim" loading={busy} onClick={() => void applyAiCategory()}>
                  Apply category
                </Button>
              </InlineStack>
              {aiAssist.missingInfo.length > 0 ? (
                <BlockStack gap="100">
                  <Text as="p" fontWeight="semibold">
                    Missing information
                  </Text>
                  {aiAssist.missingInfo.map((m) => (
                    <Text as="p" key={m} tone="subdued">
                      · {m}
                    </Text>
                  ))}
                </BlockStack>
              ) : null}
              <BlockStack gap="100">
                <Text as="p" fontWeight="semibold">
                  Suggested customer reply
                </Text>
                <Text as="p">{aiAssist.suggestedReply}</Text>
                <InlineStack gap="200">
                  <Button onClick={useSuggestedReply}>Use in status note</Button>
                  <Button onClick={() => void saveSuggestedAsInternalNote()} loading={busy}>
                    Save as internal note
                  </Button>
                </InlineStack>
              </BlockStack>
              {aiAssist.nextSteps.length > 0 ? (
                <BlockStack gap="100">
                  <Text as="p" fontWeight="semibold">
                    Next steps for your team
                  </Text>
                  {aiAssist.nextSteps.map((s) => (
                    <Text as="p" key={s} tone="subdued">
                      · {s}
                    </Text>
                  ))}
                </BlockStack>
              ) : null}
            </BlockStack>
          ) : (
            <Text as="p" tone="subdued">
              Run analyze for a fast triage brief. Uses 1 AI credit per run.
            </Text>
          )}
        </div>

        <div className="as-claim-grid">
          <div className="as-claim-tile">
            <h3>Update status</h3>
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
                ].map((s) => ({ label: s.replaceAll("_", " "), value: s }))}
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
                  ...staff
                    .filter((s) => s.active !== false)
                    .map((s) => ({
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
          </div>

          <div className="as-claim-tile">
            <h3>Resolve</h3>
            <BlockStack gap="300">
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
                options={["NOT_FILED", "FILED", "ACCEPTED", "REJECTED", "REIMBURSED"].map((s) => ({
                  label: s.replaceAll("_", " "),
                  value: s,
                }))}
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
          </div>
        </div>

        <div className="as-claim-tile">
          <h3>Timeline</h3>
          <BlockStack gap="300">
            {claim.notes.length === 0 ? (
              <Text as="p" tone="subdued">
                No notes yet. Add an internal note or update status to start the timeline.
              </Text>
            ) : (
              claim.notes.map((n) => (
                <div key={n.id} className="as-claim-note" data-internal={n.isInternal ? "true" : "false"}>
                  <InlineStack gap="200">
                    <Badge tone={n.isInternal ? "attention" : undefined}>
                      {n.isInternal ? "Internal" : n.authorType}
                    </Badge>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {new Date(n.createdAt).toLocaleString()}
                    </Text>
                  </InlineStack>
                  <Text as="p">{n.body}</Text>
                </div>
              ))
            )}
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
        </div>

        {claim.attachments.length > 0 ? (
          <div className="as-claim-tile">
            <h3>Attachments</h3>
            <BlockStack gap="200">
              {claim.attachments.map((a) => (
                <InlineStack key={a.id} gap="200" blockAlign="center">
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
          </div>
        ) : null}
      </div>

      <Modal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title="Override eligibility"
        primaryAction={{ content: "Apply override", onAction: confirmOverride, loading: busy }}
        secondaryActions={[{ content: "Cancel", onAction: () => setOverrideOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" tone="subdued">
              Record why this claim is being treated as eligible despite automated checks. This is
              required for audit history.
            </Text>
            <TextField
              label="Reason"
              value={overrideReason}
              onChange={setOverrideReason}
              multiline={3}
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
