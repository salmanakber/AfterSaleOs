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

type QrLink = {
  id: string;
  code: string;
  url: string;
  targetType: string;
  targetId: string | null;
  label: string | null;
  scanCount: number;
  active: boolean;
};

const QUERY = `#graphql
  query QrCodes {
    qrLinks {
      id code url targetType targetId label scanCount active
    }
    products(limit: 50) { id title }
  }
`;

const CREATE = `#graphql
  mutation CreateQr($targetType: String, $targetId: String, $label: String) {
    createQrLink(targetType: $targetType, targetId: $targetId, label: $label) {
      id code url scanCount active
    }
  }
`;

const SET_ACTIVE = `#graphql
  mutation SetQr($id: ID!, $active: Boolean!) {
    setQrLinkActive(id: $id, active: $active) { id active }
  }
`;

export function QrCodesPage() {
  const [links, setLinks] = useState<QrLink[]>([]);
  const [products, setProducts] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [targetType, setTargetType] = useState("product");
  const [productId, setProductId] = useState("");

  const load = useCallback(() => {
    gqlRequest<{ qrLinks: QrLink[]; products: { id: string; title: string }[] }>(QUERY)
      .then((d) => {
        setLinks(d.qrLinks);
        setProducts(d.products);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await gqlRequest(CREATE, {
        targetType,
        targetId: productId || null,
        label: label || null,
      });
      setOpen(false);
      setLabel("");
      setProductId("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await gqlRequest(SET_ACTIVE, { id, active: !active });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  function copy(url: string) {
    void navigator.clipboard.writeText(url);
  }

  const rows = links.map((l) => [
    l.label ?? l.code,
    l.targetType,
    l.scanCount,
    <Badge key={`b-${l.id}`} tone={l.active ? "success" : undefined}>
      {l.active ? "Active" : "Disabled"}
    </Badge>,
    <InlineStack key={`a-${l.id}`} gap="200">
      <Button size="slim" onClick={() => copy(l.url)}>
        Copy URL
      </Button>
      <Button size="slim" variant="plain" onClick={() => toggle(l.id, l.active)}>
        {l.active ? "Disable" : "Enable"}
      </Button>
    </InlineStack>,
  ]);

  return (
    <Page
      title="QR codes"
      subtitle="Short links for product registration — encode the URL in any QR generator"
      primaryAction={{ content: "Create QR link", onAction: () => setOpen(true) }}
    >
      <div style={{ marginBottom: 12 }}>
        <TourTrigger tourId="qr" />
      </div>
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
            <div data-tour="qr-panel">
            <BlockStack gap="300">
              <Text as="p" tone="subdued">
                Each scan is logged. Customers land on registration with <code>source=qr</code>.
                Print the URL on packaging or use a QR designer tool.
              </Text>
              {links.length === 0 ? (
                <Text as="p" tone="subdued">
                  No QR links yet. Create one, copy the short URL, and encode it with any QR generator
                  for packaging or inserts.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "text", "text"]}
                  headings={["Label", "Target", "Scans", "Status", "Actions"]}
                  rows={rows}
                />
              )}
            </BlockStack>
            </div>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create QR link"
        primaryAction={{ content: "Create", onAction: create, loading: busy }}
        secondaryActions={[{ content: "Cancel", onAction: () => setOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Label (optional)" value={label} onChange={setLabel} autoComplete="off" />
            <Select
              label="Target type"
              options={[
                { label: "Product registration", value: "product" },
                { label: "Variant", value: "variant" },
                { label: "Campaign", value: "campaign" },
                { label: "Support page", value: "support" },
              ]}
              value={targetType}
              onChange={setTargetType}
            />
            {targetType === "product" ? (
              <Select
                label="Product (optional)"
                options={[
                  { label: "Any product", value: "" },
                  ...products.map((p) => ({ label: p.title, value: p.id })),
                ]}
                value={productId}
                onChange={setProductId}
              />
            ) : (
              <TextField
                label="Target ID (Shopify GID or ID)"
                value={productId}
                onChange={setProductId}
                autoComplete="off"
              />
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
