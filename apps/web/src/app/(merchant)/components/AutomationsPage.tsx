"use client";

import { useCallback, useEffect, useState } from "react";
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
import { FeatureLock } from "./FeatureLock";
import { friendlyError } from "@/lib/merchant-errors";
import { PageLoading } from "./PageLoading";

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [tplKey, setTplKey] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expiryDays, setExpiryDays] = useState("30");
  const [mktSubject, setMktSubject] = useState("A note about your warranty coverage");
  const [mktBody, setMktBody] = useState(
    "<p>Hi — thanks for being a customer. Open your warranty portal anytime to view coverage or file a claim.</p>",
  );

  const load = useCallback(() => {
    setLoading(true);
    gqlRequest<{ claimWorkflow: Workflow; notificationTemplates: Template[] }>(QUERY)
      .then((d) => {
        setWorkflow(d.claimWorkflow);
        setTemplates(d.notificationTemplates);
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
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
      setSuccess("Email template saved.");
      load();
    } catch (e) {
      setError(friendlyError(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

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
    <Page
      title="Automations"
      primaryAction={undefined}
      secondaryActions={[{ content: "Help", onAction: () => setHelpOpen(true) }]}
    >
      <div className="as-m-studio">
        <header className="as-m-studio__hero as-m-studio__hero--auto">
          <div>
            <p className="as-m-studio__kicker">Workflow · email · campaigns</p>
            <h2>Claim automation desk</h2>
          </div>
          <div className="as-m-studio__stats">
            <div>
              <strong>{loading ? "—" : workflow?.statuses.length ?? 0}</strong>
              <span>Statuses</span>
            </div>
            <div>
              <strong>{loading ? "—" : workflow?.transitions.length ?? 0}</strong>
              <span>Transitions</span>
            </div>
            <div>
              <strong>{loading ? "—" : templates.filter((t) => !t.isPlatformDefault).length}</strong>
              <span>Custom emails</span>
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

        {loading && !workflow ? (
          <PageLoading label="Loading automations" />
        ) : (
          <div className="as-m-auto-layout">
            <FeatureLock feature="expiryCampaigns">
              <section className="as-m-auto-campaign">
                <div className="as-m-auto-campaign__head">
                  <p className="as-m-studio__kicker">Outreach</p>
                  <h3>Expiry &amp; marketing</h3>
                </div>
                <div className="as-m-auto-campaign__grid">
                  <div className="as-m-auto-tile">
                    <h4>Expiry reminders</h4>
                    <Select
                      label="Window"
                      labelHidden
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
                        Preview
                      </Button>
                      <Button variant="primary" onClick={() => void runExpiry(false)} loading={busy}>
                        Send
                      </Button>
                    </InlineStack>
                  </div>
                  <div className="as-m-auto-tile as-m-auto-tile--wide">
                    <h4>Broadcast</h4>
                    <TextField label="Subject" labelHidden value={mktSubject} onChange={setMktSubject} autoComplete="off" placeholder="Subject" />
                    <TextField label="Body" labelHidden value={mktBody} onChange={setMktBody} multiline={3} autoComplete="off" />
                    <InlineStack gap="200">
                      <Button onClick={() => void runMarketing(true)} loading={busy}>
                        Preview audience
                      </Button>
                      <Button variant="primary" onClick={() => void runMarketing(false)} loading={busy}>
                        Send broadcast
                      </Button>
                    </InlineStack>
                  </div>
                </div>
              </section>
            </FeatureLock>

            {workflow ? (
              <>
                <section className="as-m-auto-workflow">
                  <div className="as-m-auto-workflow__head">
                    <div>
                      <p className="as-m-studio__kicker">Pipeline</p>
                      <h3>
                        {workflow.name}{" "}
                        {workflow.isDefault ? <Badge tone="info">Default</Badge> : null}
                      </h3>
                    </div>
                  </div>

                  <div className="as-m-auto-status-rail" data-tour="automations-statuses">
                    {workflow.statuses.map((s, i) => (
                      <article key={s.id} className="as-m-auto-status" style={{ animationDelay: `${i * 0.04}s` }}>
                        <div className="as-m-auto-status__index">{String(i + 1).padStart(2, "0")}</div>
                        <div className="as-m-auto-status__body">
                          <strong>{s.label}</strong>
                          <span>
                            {s.key} · {s.systemState}
                          </span>
                        </div>
                        <div className="as-m-auto-status__actions">
                          <Button size="slim" variant="plain" onClick={() => openRename(s.id, s.label)}>
                            Rename
                          </Button>
                          {s.emailTemplateKey ? (
                            <Button size="slim" onClick={() => openTemplate(s.emailTemplateKey!)}>
                              Email
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="as-m-auto-transitions">
                  <p className="as-m-studio__kicker">Allowed moves</p>
                  <h3>Transitions</h3>
                  {workflow.transitions.length === 0 ? (
                    <Text as="p" tone="subdued">
                      No transitions defined.
                    </Text>
                  ) : (
                    <div className="as-m-auto-flow">
                      {workflow.transitions.map((t) => (
                        <div key={t.id} className="as-m-auto-flow__edge">
                          <span>{t.fromKey}</span>
                          <em aria-hidden>→</em>
                          <span>{t.toKey}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </div>
        )}
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Automations help" primaryAction={{ content: "Got it", onAction: () => setHelpOpen(false) }}>
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">Statuses and transitions control how claims move. Rename labels for your team language, then customize the email for each status.</Text>
            <Text as="p" tone="subdued">
              Placeholders: {"{{claimNumber}}"}, {"{{status}}"}, {"{{trackingUrl}}"}, {"{{summary}}"}, {"{{shopName}}"}.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename status"
        primaryAction={{ content: "Save", onAction: saveRename, loading: busy }}
        secondaryActions={[{ content: "Cancel", onAction: () => setRenameOpen(false) }]}
      >
        <Modal.Section>
          <TextField label="Label" value={renameLabel} onChange={setRenameLabel} autoComplete="off" />
        </Modal.Section>
      </Modal>

      <Modal
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        title={`Email: ${tplKey}`}
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
