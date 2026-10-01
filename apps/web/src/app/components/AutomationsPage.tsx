"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";

type Workflow = {
  id: string;
  name: string;
  isDefault: boolean;
  active: boolean;
  statuses: {
    id: string;
    key: string;
    label: string;
    systemState: string;
    sortOrder: number;
    emailTemplateKey: string | null;
  }[];
  transitions: { id: string; fromKey: string; toKey: string }[];
};

const QUERY = `#graphql
  query Workflow {
    claimWorkflow {
      id name isDefault active
      statuses { id key label systemState sortOrder emailTemplateKey }
      transitions { id fromKey toKey }
    }
  }
`;

export function AutomationsPage() {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    gqlRequest<{ claimWorkflow: Workflow }>(QUERY)
      .then((d) => setWorkflow(d.claimWorkflow))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Page
      title="Automations"
      subtitle="Claim workflows and status transitions"
    >
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical">{error}</Banner>
          </Layout.Section>
        ) : null}

        {!workflow ? (
          <Layout.Section>
            <Text as="p">Loading…</Text>
          </Layout.Section>
        ) : (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      {workflow.name}
                    </Text>
                    {workflow.isDefault ? <Badge tone="info">Default</Badge> : null}
                    <Badge tone={workflow.active ? "success" : undefined}>
                      {workflow.active ? "Active" : "Inactive"}
                    </Badge>
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    Custom statuses map to system states. Transitions are enforced when
                    updating a claim via workflow.
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Statuses
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "numeric", "text"]}
                    headings={["Key", "Label", "System state", "Order", "Email template"]}
                    rows={workflow.statuses.map((s) => [
                      s.key,
                      s.label,
                      s.systemState,
                      String(s.sortOrder),
                      s.emailTemplateKey ?? "—",
                    ])}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Allowed transitions
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text"]}
                    headings={["From", "To"]}
                    rows={workflow.transitions.map((t) => [t.fromKey, t.toKey])}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
