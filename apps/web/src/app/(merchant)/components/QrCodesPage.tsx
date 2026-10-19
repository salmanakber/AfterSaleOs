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
import { downloadQrPng, printQrSheet, qrImageUrl } from "@/lib/qr-display";
import { FeatureLock, useFeatureAccess } from "./FeatureLock";

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
      id code url scanCount active label targetType targetId
    }
  }
`;

const SET_ACTIVE = `#graphql
  mutation SetQr($id: ID!, $active: Boolean!) {
    setQrLinkActive(id: $id, active: $active) { id active }
  }
`;

function targetLabel(type: string) {
  switch (type) {
    case "product":
      return "Product";
    case "variant":
      return "Variant";
    case "campaign":
      return "Campaign";
    case "support":
      return "Support";
    default:
      return type;
  }
}

export function QrCodesPage() {
  const { allowed } = useFeatureAccess("qrCodes");
  const [links, setLinks] = useState<QrLink[]>([]);
  const [products, setProducts] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [targetType, setTargetType] = useState("product");
  const [productId, setProductId] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    gqlRequest<{ qrLinks: QrLink[]; products: { id: string; title: string }[] }>(QUERY)
      .then((d) => {
        setLinks(d.qrLinks);
        setProducts(d.products);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [allowed]);

  useEffect(() => {
    load();
  }, [load]);

  const productTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(p.id, p.title);
    return map;
  }, [products]);

  const totalScans = useMemo(() => links.reduce((n, l) => n + l.scanCount, 0), [links]);
  const activeCount = useMemo(() => links.filter((l) => l.active).length, [links]);

  async function create() {
    if (!allowed) return;
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
      setFlash("QR created");
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

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setFlash("URL copied");
    } catch {
      setFlash("Could not copy");
    }
  }

  async function download(link: QrLink) {
    try {
      await downloadQrPng(link.url, `aftersale-qr-${link.code}`, 720);
      setFlash("PNG downloaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  function printCard(link: QrLink) {
    const title = link.label || productTitleById.get(link.targetId ?? "") || `QR ${link.code}`;
    printQrSheet({
      title,
      subtitle: targetLabel(link.targetType),
      url: link.url,
      imageUrl: qrImageUrl(link.url, 560),
    });
  }

  const preview = links.find((l) => l.id === previewId) ?? null;

  return (
    <FeatureLock feature="qrCodes" mode="replace">
      <Page
        title="QR studio"
        primaryAction={{ content: "Create QR", onAction: () => setOpen(true) }}
        secondaryActions={[{ content: "Help", onAction: () => setHelpOpen(true) }]}
      >
        <div className="as-m-studio" data-tour="qr-panel">
          <header className="as-m-studio__hero as-m-studio__hero--qr">
            <div>
              <p className="as-m-studio__kicker">Packaging · inserts · in-store</p>
              <h2>Scan-ready warranty codes</h2>
            </div>
            <div className="as-m-studio__stats">
              <div>
                <strong>{loading ? "—" : links.length}</strong>
                <span>Codes</span>
              </div>
              <div>
                <strong>{loading ? "—" : activeCount}</strong>
                <span>Active</span>
              </div>
              <div>
                <strong>{loading ? "—" : totalScans}</strong>
                <span>Scans</span>
              </div>
            </div>
          </header>

          {error ? (
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          ) : null}
          {flash ? (
            <Banner tone="success" onDismiss={() => setFlash(null)}>
              {flash}
            </Banner>
          ) : null}

          {loading ? (
            <div className="as-m-qr-grid" aria-busy="true" aria-label="Loading QR codes">
              {[0, 1, 2].map((i) => (
                <div key={i} className="as-m-qr-card as-m-qr-card--skel">
                  <div className="as-m-skel as-m-qr-skel-art" />
                  <div className="as-m-qr-card__body">
                    <div className="as-m-skel" style={{ height: 18, width: "70%" }} />
                    <div className="as-m-skel" style={{ height: 12, width: "45%", marginTop: 8 }} />
                    <div className="as-m-skel" style={{ height: 36, width: "100%", marginTop: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : links.length === 0 ? (
            <div className="as-m-qr-empty as-m-qr-empty--rich">
              <div className="as-m-qr-empty__mark" aria-hidden>
                QR
              </div>
              <h3>Create your first code</h3>
              <p>Print-ready cards for packaging. Customers scan straight into activation.</p>
              <InlineStack gap="200">
                <Button variant="primary" onClick={() => setOpen(true)}>
                  Create QR
                </Button>
                <Button onClick={() => setHelpOpen(true)}>How it works</Button>
              </InlineStack>
            </div>
          ) : (
            <div className="as-m-qr-grid">
              {links.map((l) => {
                const title =
                  l.label || productTitleById.get(l.targetId ?? "") || `Code ${l.code}`;
                return (
                  <article key={l.id} className="as-m-qr-card as-m-qr-card--pro">
                    <div className="as-m-qr-card__art">
                      <div className="as-m-qr-card__frame">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrImageUrl(l.url, 280)} alt={`QR for ${title}`} />
                      </div>
                      <span className="as-m-qr-card__chip">{targetLabel(l.targetType)}</span>
                    </div>
                    <div className="as-m-qr-card__body">
                      <div className="as-m-qr-card__meta">
                        <div>
                          <h3>{title}</h3>
                          <p>/{l.code}</p>
                        </div>
                        <Badge tone={l.active ? "success" : undefined}>
                          {l.active ? "Live" : "Off"}
                        </Badge>
                      </div>
                      <div className="as-m-qr-card__url">{l.url}</div>
                      <div className="as-m-qr-card__stats">
                        <span>
                          <strong>{l.scanCount}</strong> scans
                        </span>
                      </div>
                      <div className="as-m-qr-card__actions">
                        <Button size="slim" onClick={() => void copy(l.url)}>
                          Copy
                        </Button>
                        <Button size="slim" onClick={() => void download(l)}>
                          PNG
                        </Button>
                        <Button size="slim" onClick={() => printCard(l)}>
                          Print
                        </Button>
                        <Button size="slim" variant="plain" onClick={() => setPreviewId(l.id)}>
                          Open
                        </Button>
                        <Button
                          size="slim"
                          variant="plain"
                          tone={l.active ? "critical" : undefined}
                          onClick={() => void toggle(l.id, l.active)}
                        >
                          {l.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <Modal
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          title="QR studio help"
          primaryAction={{ content: "Got it", onAction: () => setHelpOpen(false) }}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text as="p">
                Create a code, then download the PNG or print a sheet for packaging, hangtags, or
                counters.
              </Text>
              <BlockStack gap="200">
                <Text as="p" fontWeight="semibold">
                  Destinations
                </Text>
                <Text as="p" tone="subdued">
                  Product — preselects a catalog item for registration. Campaign — general activate.
                  Support — opens the claim flow.
                </Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="p" fontWeight="semibold">
                  Customer experience
                </Text>
                <Text as="p" tone="subdued">
                  Scanners land on a branded activate page with no login required. After they
                  register, the product appears in their client portal. Every scan is counted.
                </Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="p" fontWeight="semibold">
                  Tips
                </Text>
                <Text as="p" tone="subdued">
                  Use the short URL on packaging, or print/download the QR image directly from this
                  page. Disable a code anytime without deleting history.
                </Text>
              </BlockStack>
            </BlockStack>
          </Modal.Section>
        </Modal>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Create QR code"
          primaryAction={{ content: "Create", onAction: create, loading: busy }}
          secondaryActions={[{ content: "Cancel", onAction: () => setOpen(false) }]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField label="Label" value={label} onChange={setLabel} autoComplete="off" />
              <Select
                label="Destination"
                options={[
                  { label: "Product registration", value: "product" },
                  { label: "Campaign / activate", value: "campaign" },
                  { label: "Support / claim", value: "support" },
                  { label: "Variant", value: "variant" },
                ]}
                value={targetType}
                onChange={setTargetType}
              />
              {targetType === "product" ? (
                <Select
                  label="Product"
                  options={[
                    { label: "Any product", value: "" },
                    ...products.map((p) => ({ label: p.title, value: p.id })),
                  ]}
                  value={productId}
                  onChange={setProductId}
                />
              ) : targetType === "variant" ? (
                <TextField
                  label="Variant / product ID"
                  value={productId}
                  onChange={setProductId}
                  autoComplete="off"
                />
              ) : null}
            </FormLayout>
          </Modal.Section>
        </Modal>

        <Modal
          open={Boolean(preview)}
          onClose={() => setPreviewId(null)}
          title={preview?.label || preview?.code || "QR"}
          primaryAction={{
            content: "Download PNG",
            onAction: () => preview && void download(preview),
          }}
          secondaryActions={[
            { content: "Print", onAction: () => preview && printCard(preview) },
            { content: "Close", onAction: () => setPreviewId(null) },
          ]}
        >
          <Modal.Section>
            {preview ? (
              <BlockStack gap="300" inlineAlign="center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImageUrl(preview.url, 360)}
                  alt="QR preview"
                  width={220}
                  height={220}
                  style={{ borderRadius: 16, border: "1px solid #e5e7eb", padding: 12 }}
                />
                <InlineStack gap="200">
                  <Button onClick={() => void copy(preview.url)}>Copy URL</Button>
                  <Button url={preview.url} external>
                    Open landing
                  </Button>
                </InlineStack>
              </BlockStack>
            ) : null}
          </Modal.Section>
        </Modal>
      </Page>
    </FeatureLock>
  );
}
