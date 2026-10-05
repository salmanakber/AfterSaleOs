"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  DataTable,
  InlineStack,
  Modal,
  Page,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { friendlyError } from "@/lib/merchant-errors";
import { PageEmpty, PageLoading } from "./PageLoading";

type Reg = {
  id: string;
  status: string;
  email: string | null;
  productTitle: string | null;
  serialNumber: string | null;
  source: string;
  createdAt: string;
  reviewNote: string | null;
};

const QUERY = `#graphql
  query Registrations {
    registrations(limit: 50) {
      id status email productTitle serialNumber source createdAt reviewNote
    }
  }
`;

const APPROVE = `#graphql
  mutation Approve($id: ID!) {
    approveRegistration(id: $id) { id status }
  }
`;

const REJECT = `#graphql
  mutation Reject($id: ID!, $note: String) {
    rejectRegistration(id: $id, note: $note) { id status }
  }
`;

export function RegistrationsPage() {
  const [rows, setRows] = useState<Reg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    gqlRequest<{ registrations: Reg[] }>(QUERY)
      .then((d) => {
        setRows(d.registrations);
        setHasLoaded(true);
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    setBusy(true);
    setError(null);
    try {
      await gqlRequest(APPROVE, { id });
      setSuccess("Registration approved.");
      load();
    } catch (e) {
      setError(friendlyError(e, "Approve failed"));
    } finally {
      setBusy(false);
    }
  }

  function openReject(id: string) {
    setRejectId(id);
    setRejectNote("");
    setRejectOpen(true);
  }

  async function confirmReject() {
    if (!rejectId) return;
    setBusy(true);
    try {
      await gqlRequest(REJECT, { id: rejectId, note: rejectNote.trim() || null });
      setRejectOpen(false);
      setSuccess("Registration rejected.");
      load();
    } catch (e) {
      setError(friendlyError(e, "Reject failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Registrations"
      subtitle={hasLoaded ? `${rows.length} total` : "Loading…"}
    >
      <div className="as-m-ops-surface">
        {error ? (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            <p>{error}</p>
          </Banner>
        ) : null}
        {success ? (
          <Banner tone="success" onDismiss={() => setSuccess(null)}>
            <p>{success}</p>
          </Banner>
        ) : null}

        <div className="as-m-ops-banner">
          <div>
            <p className="as-m-ops-kicker">Coverage</p>
            <h2>Registration review</h2>
            <p>Approve or reject customer product registrations that need verification.</p>
          </div>
          <Button onClick={load} loading={loading && hasLoaded} disabled={loading && !hasLoaded}>
            Refresh
          </Button>
        </div>

        <div className="as-m-ops-card">
          {loading && !hasLoaded ? (
            <PageLoading label="Loading registrations" />
          ) : rows.length === 0 ? (
            <PageEmpty
              title="No registrations yet"
              body="Customers register via the storefront portal, theme blocks, or QR codes."
            />
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
              headings={["Email", "Product", "Serial", "Source", "Status", "When", ""]}
              rows={rows.map((r) => [
                r.email ?? "—",
                r.productTitle ?? "—",
                r.serialNumber ?? "—",
                r.source,
                <Badge
                  key={r.id}
                  tone={
                    r.status === "APPROVED"
                      ? "success"
                      : r.status === "REJECTED"
                        ? "critical"
                        : "attention"
                  }
                >
                  {r.status}
                </Badge>,
                new Date(r.createdAt).toLocaleString(),
                r.status === "PENDING_VERIFICATION" || r.status === "NEEDS_REVIEW" ? (
                  <InlineStack key={`a-${r.id}`} gap="200">
                    <Button size="slim" onClick={() => approve(r.id)} loading={busy}>
                      Approve
                    </Button>
                    <Button size="slim" tone="critical" onClick={() => openReject(r.id)}>
                      Reject
                    </Button>
                  </InlineStack>
                ) : (
                  "—"
                ),
              ])}
            />
          )}
        </div>
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject registration"
        primaryAction={{
          content: "Reject",
          onAction: confirmReject,
          loading: busy,
          destructive: true,
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => setRejectOpen(false) }]}
      >
        <Modal.Section>
          <TextField
            label="Note (optional)"
            value={rejectNote}
            onChange={setRejectNote}
            multiline={3}
            autoComplete="off"
            helpText="Internal note for your team. Not shown to the customer by default."
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
