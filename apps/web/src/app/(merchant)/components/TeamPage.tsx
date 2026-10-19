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
import { friendlyError } from "@/lib/merchant-errors";
import { PageEmpty, PageLoading } from "./PageLoading";

type Staff = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  inviteUrl: string;
};

type Quota = { seatsUsed: number; seatsLimit: number };

const QUERY = `#graphql
  query Team {
    staffMembers { id email name role active inviteUrl }
    staffQuota { seatsUsed seatsLimit }
  }
`;

const UPSERT = `#graphql
  mutation UpsertStaff($id: ID, $email: String!, $name: String, $role: String, $active: Boolean) {
    upsertStaffMember(id: $id, email: $email, name: $name, role: $role, active: $active) {
      id email name role active inviteUrl
    }
  }
`;

const ROTATE = `#graphql
  mutation RotateInvite($id: ID!) {
    rotateStaffInvite(id: $id) { id inviteUrl }
  }
`;

function roleLabel(role: string) {
  switch (role) {
    case "OWNER_ADMIN":
      return "Owner";
    case "SUPPORT_AGENT":
      return "Support";
    case "ANALYST":
      return "Analyst";
    case "TECHNICIAN":
      return "Technician";
    default:
      return role.replaceAll("_", " ");
  }
}

export function TeamPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [quota, setQuota] = useState<Quota>({ seatsUsed: 0, seatsLimit: 1 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [linkModal, setLinkModal] = useState<Staff | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("SUPPORT_AGENT");
  const [active, setActive] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    gqlRequest<{ staffMembers: Staff[]; staffQuota: Quota }>(QUERY)
      .then((d) => {
        setStaff(d.staffMembers);
        setQuota(d.staffQuota);
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const atLimit = quota.seatsUsed >= quota.seatsLimit;
  const seatPct = quota.seatsLimit > 0 ? Math.min(100, Math.round((quota.seatsUsed / quota.seatsLimit) * 100)) : 0;

  const owners = useMemo(() => staff.filter((s) => s.role === "OWNER_ADMIN" && s.active).length, [staff]);

  function openNew() {
    setEditId(null);
    setEmail("");
    setName("");
    setRole("SUPPORT_AGENT");
    setActive(true);
    setOpen(true);
  }

  function openEdit(s: Staff) {
    setEditId(s.id);
    setEmail(s.email);
    setName(s.name ?? "");
    setRole(s.role);
    setActive(s.active);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await gqlRequest<{ upsertStaffMember: Staff }>(UPSERT, {
        id: editId,
        email,
        name: name || null,
        role,
        active,
      });
      setOpen(false);
      setSuccess(editId ? "Team member updated." : "Team member added.");
      load();
      if (!editId && res.upsertStaffMember?.inviteUrl) {
        setLinkModal(res.upsertStaffMember);
      }
    } catch (e) {
      setError(friendlyError(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setSuccess("Invite link copied");
    } catch {
      setError("Could not copy link");
    }
  }

  async function rotateLink(s: Staff) {
    setBusy(true);
    try {
      const res = await gqlRequest<{ rotateStaffInvite: { id: string; inviteUrl: string } }>(ROTATE, {
        id: s.id,
      });
      const next = { ...s, inviteUrl: res.rotateStaffInvite.inviteUrl };
      setStaff((prev) => prev.map((m) => (m.id === s.id ? next : m)));
      setLinkModal(next);
      setSuccess("New unique invite link generated");
    } catch (e) {
      setError(friendlyError(e, "Could not rotate link"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Team"
      primaryAction={{
        content: "Add member",
        onAction: openNew,
        disabled: atLimit,
      }}
      secondaryActions={[{ content: "Help", onAction: () => setHelpOpen(true) }]}
    >
      <div className="as-m-studio">
        <header className="as-m-studio__hero as-m-studio__hero--team">
          <div>
            <p className="as-m-studio__kicker">Access · seats · invites</p>
            <h2>Your aftercare team</h2>
          </div>
          <div className="as-m-studio__stats">
            <div>
              <strong>
                {quota.seatsUsed}/{quota.seatsLimit}
              </strong>
              <span>Seats</span>
            </div>
            <div>
              <strong>{owners}</strong>
              <span>Owners</span>
            </div>
            <div>
              <strong>{staff.filter((s) => s.active).length}</strong>
              <span>Active</span>
            </div>
          </div>
        </header>

        <div className="as-m-team-meter">
          <div className="as-m-team-meter__head">
            <span>Seat usage</span>
            <span>
              {quota.seatsUsed} of {quota.seatsLimit}
            </span>
          </div>
          <div className="as-m-team-meter__track">
            <div className="as-m-team-meter__fill" style={{ width: `${seatPct}%` }} />
          </div>
        </div>

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
        {atLimit ? (
          <Banner tone="warning">
            All {quota.seatsLimit} seats are in use. Deactivate a member or upgrade to add more.
          </Banner>
        ) : null}

        {loading && staff.length === 0 ? (
          <PageLoading label="Loading team" />
        ) : staff.length === 0 ? (
          <PageEmpty
            title="No team members yet"
            body="Add teammates who handle claims, repairs, or analytics — each gets a unique login link."
            action={<Button onClick={openNew}>Add member</Button>}
          />
        ) : (
          <div className="as-m-team-grid">
            {staff.map((s) => (
              <article key={s.id} className="as-m-team-card" data-active={s.active ? "true" : "false"}>
                <div className="as-m-team-card__avatar" aria-hidden>
                  {(s.name || s.email).slice(0, 1).toUpperCase()}
                </div>
                <div className="as-m-team-card__body">
                  <div className="as-m-team-card__top">
                    <div>
                      <h3>{s.name || "Unnamed"}</h3>
                      <p>{s.email}</p>
                    </div>
                    <Badge tone={s.active ? "success" : undefined}>
                      {s.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <span className="as-m-team-card__role">{roleLabel(s.role)}</span>
                  <div className="as-m-team-card__actions">
                    <Button size="slim" onClick={() => setLinkModal(s)}>
                      Invite link
                    </Button>
                    <Button size="slim" variant="plain" onClick={() => openEdit(s)}>
                      Edit
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Team help"
        primaryAction={{ content: "Got it", onAction: () => setHelpOpen(false) }}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">
              Each member gets a unique invite link. Share it so they can open this store’s AfterSale
              workspace in Shopify Admin with their account.
            </Text>
            <Text as="p" tone="subdued">
              Use the same email they use for Shopify when possible. Keep at least one active Owner.
              Seat limits come from your plan.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={Boolean(linkModal)}
        onClose={() => setLinkModal(null)}
        title={linkModal ? `Invite · ${linkModal.name || linkModal.email}` : "Invite link"}
        primaryAction={{
          content: "Copy link",
          onAction: () => linkModal && void copyLink(linkModal.inviteUrl),
        }}
        secondaryActions={[
          {
            content: "Generate new",
            onAction: () => linkModal && void rotateLink(linkModal),
            loading: busy,
          },
          { content: "Close", onAction: () => setLinkModal(null) },
        ]}
      >
        <Modal.Section>
          {linkModal ? (
            <BlockStack gap="300">
              <Text as="p" tone="subdued">
                Unique login link for this teammate. They open it, then continue into Shopify Admin for
                this store.
              </Text>
              <div className="as-m-team-linkbox">{linkModal.inviteUrl}</div>
              <InlineStack gap="200">
                <Button url={linkModal.inviteUrl} external>
                  Open invite page
                </Button>
              </InlineStack>
            </BlockStack>
          ) : null}
        </Modal.Section>
      </Modal>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Edit team member" : "Add team member"}
        primaryAction={{ content: "Save", onAction: save, loading: busy }}
        secondaryActions={[{ content: "Cancel", onAction: () => setOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="off" />
            <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
            <Select
              label="Role"
              options={[
                { label: "Owner / admin", value: "OWNER_ADMIN" },
                { label: "Support agent", value: "SUPPORT_AGENT" },
                { label: "Analyst", value: "ANALYST" },
                { label: "Technician", value: "TECHNICIAN" },
              ]}
              value={role}
              onChange={setRole}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active (counts toward seats: {quota.seatsUsed}/{quota.seatsLimit})
            </label>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
