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
  Layout,
  Modal,
  Page,
  Select,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";

type Staff = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
};

const QUERY = `#graphql
  query Team {
    staffMembers { id email name role active }
  }
`;

const UPSERT = `#graphql
  mutation UpsertStaff($id: ID, $email: String!, $name: String, $role: String, $active: Boolean) {
    upsertStaffMember(id: $id, email: $email, name: $name, role: $role, active: $active) {
      id email name role active
    }
  }
`;

export function TeamPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("SUPPORT_AGENT");
  const [active, setActive] = useState(true);

  const load = useCallback(() => {
    gqlRequest<{ staffMembers: Staff[] }>(QUERY)
      .then((d) => setStaff(d.staffMembers))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      await gqlRequest(UPSERT, {
        id: editId,
        email,
        name: name || null,
        role,
        active,
      });
      setOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const rows = staff.map((s) => [
    s.name ?? "—",
    s.email,
    s.role.replaceAll("_", " "),
    <Badge key={s.id} tone={s.active ? "success" : undefined}>
      {s.active ? "Active" : "Inactive"}
    </Badge>,
    <Button key={`e-${s.id}`} variant="plain" onClick={() => openEdit(s)}>
      Edit
    </Button>,
  ]);

  return (
    <Page title="Team" subtitle="Staff for claim assignment and repair technicians" primaryAction={{ content: "Add member", onAction: openNew }}>
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        ) : null}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              {staff.length === 0 ? (
                <p style={{ margin: 0, color: "#6b7280" }}>No staff yet. Add emails your team uses in Shopify.</p>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text"]}
                  headings={["Name", "Email", "Role", "Status", ""]}
                  rows={rows}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

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
              Active (counts toward plan seat limit)
            </label>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
