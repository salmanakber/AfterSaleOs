"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";

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

  const load = useCallback(() => {
    gqlRequest<{ registrations: Reg[] }>(QUERY)
      .then((d) => setRows(d.registrations))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    await gqlRequest(APPROVE, { id });
    load();
  }

  async function reject(id: string) {
    const note = window.prompt("Rejection note (optional)") ?? "";
    await gqlRequest(REJECT, { id, note });
    load();
  }

  return (
    <Page title="Registrations" subtitle="Pending verification and serial reviews">
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        ) : null}
        <Layout.Section>
          <Card>
            {rows.length === 0 ? (
              <Text as="p" tone="subdued">
                No registrations yet. Customers register via the storefront app proxy or QR link.
              </Text>
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
                      <Button size="slim" onClick={() => approve(r.id)}>
                        Approve
                      </Button>
                      <Button size="slim" tone="critical" onClick={() => reject(r.id)}>
                        Reject
                      </Button>
                    </InlineStack>
                  ) : (
                    r.reviewNote ?? ""
                  ),
                ])}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
