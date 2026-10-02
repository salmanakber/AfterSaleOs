"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  FormLayout,
  InlineStack,
  Layout,
  Modal,
  Page,
  Text,
  TextField,
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

type Template = {
  id: string;
  key: string;
  subject: string | null;
  bodyHtml: string;
  isPlatformDefault: boolean;
};

const QUERY = `#graphql
  query Workflow {
    claimWorkflow {
      id name isDefault active
      statuses { id key label systemState sortOrder emailTemplateKey }
      transitions { id fromKey toKey }
    }
    notificationTemplates { id key subject bodyHtml isPlatformDefault }
  }
`;

const UPDATE_LABEL = `#graphql
  mutation UpdateLabel($statusId: ID!, $label: String!) {
    updateWorkflowStatusLabel(statusId: $statusId, label: $label) { id label }
  }
`;

const UPSERT_TPL = `#graphql
  mutation UpsertTpl($key: String!, $subject: String!, $bodyHtml: String!) {
    upsertNotificationTemplate(key: $key, subject: $subject, bodyHtml: $bodyHtml) {
      id key subject bodyHtml
    }
  }
`;

export function AutomationsPage() {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplKey, setTplKey] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    gqlRequest<{ claimWorkflow: Workflow; notificationTemplates: Template[] }>(QUERY)
      .then((d) => {
        setWorkflow(d.claimWorkflow);
        setTemplates(d.notificationTemplates);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function renameStatus(statusId: string, label: string) {
    try {
      await gqlRequest(UPDATE_LABEL, { statusId, label });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  function openTemplate(key: string) {
    const shopTpl = templates.find((t) => t.key === key && !t.isPlatformDefault);
    setTplKey(key);
    setTplSubject(shopTpl?.subject ?? `Claim update: {{status}}`);
    setTplBody(
      shopTpl?.bodyHtml ??
        `<p>Your claim <strong>{{claimNumber}}</strong> is now <strong>{{status}}</strong>.</p>
<p>{{summary}}</p>
<p><a href="{{trackingUrl}}">View claim</a></p>`,
    );
    setTplOpen(true);
  }

  async function saveTemplate() {
    setBusy(true);
    try {
      await gqlRequest(UPSERT_TPL, { key: tplKey, subject: tplSubject, bodyHtml: tplBody });
      setTplOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const statusRows =
    workflow?.statuses.map((s) => [
      s.label,
      s.key,
      s.systemState,
      s.emailTemplateKey ?? "—",
      <InlineStack key={s.id} gap="200">
        <Button
          size="slim"
          variant="plain"
          onClick={() => {
            const next = window.prompt("Status label", s.label);
            if (next) void renameStatus(s.id, next);
          }}
        >
          Rename
        </Button>
        {s.emailTemplateKey ? (
          <Button size="slim" onClick={() => openTemplate(s.emailTemplateKey!)}>
            Email
          </Button>
        ) : null}
      </InlineStack>,
    ]) ?? [];

  return (
    <Page title="Automations" subtitle="Claim workflow statuses and customer email templates">
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
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    Transitions are enforced when updating claims. Customize labels and emails per status.
                    Use placeholders: {"{{claimNumber}}"}, {"{{status}}"}, {"{{trackingUrl}}"}, {"{{summary}}"}, {"{{shopName}}"}.
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
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Label", "Key", "System state", "Email template", "Actions"]}
                    rows={statusRows}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Allowed transitions
                  </Text>
                  {workflow.transitions.map((t) => (
                    <Text as="p" key={t.id} tone="subdued">
                      {t.fromKey} → {t.toKey}
                    </Text>
                  ))}
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>

      <Modal
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        title={`Email template: ${tplKey}`}
        primaryAction={{ content: "Save template", onAction: saveTemplate, loading: busy }}
        secondaryActions={[{ content: "Cancel", onAction: () => setTplOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Subject" value={tplSubject} onChange={setTplSubject} autoComplete="off" />
            <TextField label="Body HTML" value={tplBody} onChange={setTplBody} multiline={10} autoComplete="off" />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
