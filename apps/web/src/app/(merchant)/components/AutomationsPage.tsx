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
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { TourTrigger } from "./ProductTour";
import { FeatureLock } from "./FeatureLock";
import { friendlyError } from "@/lib/merchant-errors";

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
  const [success, setSuccess] = useState<string | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [tplKey, setTplKey] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [expiryDays, setExpiryDays] = useState("30");
  const [mktSubject, setMktSubject] = useState("A note about your warranty coverage");
  const [mktBody, setMktBody] = useState(
    "<p>Hi — thanks for being a customer. Open your warranty portal anytime to view coverage or file a claim.</p>",
  );

  const load = useCallback(() => {
    gqlRequest<{ claimWorkflow: Workflow; notificationTemplates: Template[] }>(QUERY)
      .then((d) => {
        setWorkflow(d.claimWorkflow);
        setTemplates(d.notificationTemplates);
      })
      .catch((e) => setError(friendlyError(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openRename(statusId: string, label: string) {
    setRenameId(statusId);
    setRenameLabel(label);
    setRenameOpen(true);
  }

  async function saveRename() {
    if (!renameId || !renameLabel.trim()) {
      setError("Status label cannot be empty.");
      return;
    }
    setBusy(true);
    try {
      await gqlRequest(UPDATE_LABEL, { statusId: renameId, label: renameLabel.trim() });
      setRenameOpen(false);
      setSuccess("Status label updated.");
      load();
    } catch (e) {
      setError(friendlyError(e, "Update failed"));
    } finally {
      setBusy(false);
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
      setSuccess("Email template saved. New claim emails will use this copy.");
      load();
    } catch (e) {
      setError(friendlyError(e, "Save failed"));
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
        <Button size="slim" variant="plain" onClick={() => openRename(s.id, s.label)}>
          Rename
        </Button>
        {s.emailTemplateKey ? (
          <Button size="slim" onClick={() => openTemplate(s.emailTemplateKey!)}>
            Email
          </Button>
        ) : null}
      </InlineStack>,
    ]) ?? [];

  async function runExpiry(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await gqlRequest<{ runExpiryCampaign: { message: string } }>(
        `#graphql
        mutation RunExpiry($days: Int, $dryRun: Boolean) {
          runExpiryCampaign(daysAhead: $days, dryRun: $dryRun) { message matched sent }
        }`,
        { days: Number(expiryDays) || 30, dryRun },
      );
      setSuccess(res.runExpiryCampaign.message);
    } catch (e) {
      setError(friendlyError(e, "Campaign failed"));
    } finally {
      setBusy(false);
    }
  }

  async function runMarketing(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await gqlRequest<{ runMarketingBroadcast: { message: string } }>(
        `#graphql
        mutation RunMkt($subject: String!, $bodyHtml: String!, $dryRun: Boolean) {
          runMarketingBroadcast(subject: $subject, bodyHtml: $bodyHtml, dryRun: $dryRun) {
            message matched sent
          }
        }`,
        { subject: mktSubject, bodyHtml: mktBody, dryRun },
      );
      setSuccess(res.runMarketingBroadcast.message);
    } catch (e) {
      setError(friendlyError(e, "Broadcast failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Automations" subtitle="Claim workflow, email templates, and marketing campaigns">
      <div style={{ marginBottom: 12 }}>
        <TourTrigger tourId="automations" />
      </div>
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        ) : null}
        {success ? (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccess(null)}>
              {success}
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <FeatureLock feature="expiryCampaigns">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Marketing &amp; expiry emails
                </Text>
                <Text as="p" tone="subdued">
                  Remind customers before coverage ends, or send a broadcast to everyone with an
                  active warranty. Ask your AfterSale admin if email delivery is not connected yet.
                </Text>
                <Select
                  label="Expiry window"
                  options={[
                    { label: "Next 7 days", value: "7" },
                    { label: "Next 14 days", value: "14" },
                    { label: "Next 30 days", value: "30" },
                    { label: "Next 60 days", value: "60" },
                  ]}
                  value={expiryDays}
                  onChange={setExpiryDays}
                />
                <InlineStack gap="200">
                  <Button onClick={() => void runExpiry(true)} loading={busy}>
                    Preview expiry count
                  </Button>
                  <Button variant="primary" onClick={() => void runExpiry(false)} loading={busy}>
                    Send expiry reminders
                  </Button>
                </InlineStack>
                <FormLayout>
                  <TextField
                    label="Broadcast subject"
                    value={mktSubject}
                    onChange={setMktSubject}
                    autoComplete="off"
                  />
                  <TextField
                    label="Broadcast message"
                    value={mktBody}
                    onChange={setMktBody}
                    multiline={4}
                    autoComplete="off"
                    helpText="Sent once to each customer who has at least one active warranty."
                  />
                </FormLayout>
                <InlineStack gap="200">
                  <Button onClick={() => void runMarketing(true)} loading={busy}>
                    Preview audience
                  </Button>
                  <Button variant="primary" onClick={() => void runMarketing(false)} loading={busy}>
                    Send marketing email
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </FeatureLock>
        </Layout.Section>

        {!workflow ? (
          <Layout.Section>
            <Text as="p" tone="subdued">
              Loading workflow…
            </Text>
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
                    Transitions are enforced when updating claims. Customize labels and emails per
                    status. Placeholders: {"{{claimNumber}}"}, {"{{status}}"}, {"{{trackingUrl}}"},{" "}
                    {"{{summary}}"}, {"{{shopName}}"}.
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <div data-tour="automations-statuses">
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Statuses
                  </Text>
                  {statusRows.length === 0 ? (
                    <Text as="p" tone="subdued">
                      No statuses configured for this workflow yet.
                    </Text>
                  ) : (
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text", "text"]}
                      headings={["Label", "Key", "System state", "Email template", "Actions"]}
                      rows={statusRows}
                    />
                  )}
                </BlockStack>
                </div>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Allowed transitions
                  </Text>
                  {workflow.transitions.length === 0 ? (
                    <Text as="p" tone="subdued">
                      No transitions defined.
                    </Text>
                  ) : (
                    workflow.transitions.map((t) => (
                      <Text as="p" key={t.id} tone="subdued">
                        {t.fromKey} → {t.toKey}
                      </Text>
                    ))
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename status"
        primaryAction={{ content: "Save", onAction: saveRename, loading: busy }}
        secondaryActions={[{ content: "Cancel", onAction: () => setRenameOpen(false) }]}
      >
        <Modal.Section>
          <TextField
            label="Label"
            value={renameLabel}
            onChange={setRenameLabel}
            autoComplete="off"
            helpText="Shown to merchants and customers. The internal key stays the same."
          />
        </Modal.Section>
      </Modal>

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
            <TextField
              label="Body HTML"
              value={tplBody}
              onChange={setTplBody}
              multiline={10}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
