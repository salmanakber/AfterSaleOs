"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { PageEmpty, PageLoading } from "./PageLoading";
import { FeatureLock } from "./FeatureLock";

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  productCount: number;
  claimCount: number;
};

type SupplierClaim = {
  id: string;
  claimId: string;
  claimNumber: string | null;
  supplierId: string;
  supplierName: string;
  recoverable: boolean;
  amountCents: number | null;
  currency: string;
  status: string;
  notes: string | null;
  createdAt: string;
};

type ProductLink = {
  id: string;
  shopifyProductId: string;
  productTitle: string | null;
  supplierId: string;
  supplierName: string;
  supplierWarrantyMonths: number | null;
};

type Product = { id: string; title: string; shopifyProductId: string };

const QUERY = `#graphql
  query Suppliers {
    suppliers(activeOnly: false) {
      id name email phone notes active productCount claimCount
    }
    supplierClaims(limit: 100) {
      id claimId claimNumber supplierId supplierName recoverable
      amountCents currency status notes createdAt
    }
    productSupplierLinks {
      id shopifyProductId productTitle supplierId supplierName supplierWarrantyMonths
    }
    products(limit: 100) { id title shopifyProductId }
  }
`;

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [claims, setClaims] = useState<SupplierClaim[]>([]);
  const [links, setLinks] = useState<ProductLink[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [linkSupplierId, setLinkSupplierId] = useState("");
  const [linkProductId, setLinkProductId] = useState("");
  const [linkMonths, setLinkMonths] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    gqlRequest<{
      suppliers: Supplier[];
      supplierClaims: SupplierClaim[];
      productSupplierLinks: ProductLink[];
      products: Product[];
    }>(QUERY)
      .then((d) => {
        setSuppliers(d.suppliers);
        setClaims(d.supplierClaims);
        setLinks(d.productSupplierLinks);
        setProducts(d.products);
        if (!linkSupplierId && d.suppliers[0]) setLinkSupplierId(d.suppliers[0].id);
        if (!linkProductId && d.products[0]) setLinkProductId(d.products[0].shopifyProductId);
        setHasLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [linkSupplierId, linkProductId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation C($input: CreateSupplierInput!) {
          createSupplier(input: $input) { id }
        }`,
        { input: { name, email: email || null, phone: phone || null, notes: notes || null } },
      );
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function linkProduct() {
    if (!linkSupplierId || !linkProductId) return;
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation L($supplierId: ID!, $shopifyProductId: String!, $months: Int) {
          linkProductSupplier(
            supplierId: $supplierId
            shopifyProductId: $shopifyProductId
            supplierWarrantyMonths: $months
          ) { id }
        }`,
        {
          supplierId: linkSupplierId,
          shopifyProductId: linkProductId,
          months: linkMonths ? parseInt(linkMonths, 10) : null,
        },
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed");
    } finally {
      setBusy(false);
    }
  }

  const recovered = claims
    .filter((c) => c.status === "REIMBURSED")
    .reduce((s, c) => s + (c.amountCents ?? 0), 0);
  const recoverable = claims
    .filter((c) => c.recoverable && c.status !== "REJECTED")
    .reduce((s, c) => s + (c.amountCents ?? 0), 0);

  return (
    <FeatureLock feature="supplierPortal" mode="replace">
    <Page
      title="Suppliers"
      subtitle={hasLoaded ? `${suppliers.length} suppliers` : "Loading…"}
    >
      <div className="as-m-ops-surface">
        {error ? (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        ) : null}

        <div className="as-m-ops-banner">
          <div>
            <p className="as-m-ops-kicker">Operations</p>
            <h2>Supplier recovery</h2>
            <p>
              Recoverable ${(recoverable / 100).toFixed(2)} · Recovered $
              {(recovered / 100).toFixed(2)}
            </p>
          </div>
          <Button onClick={load} loading={loading && hasLoaded} disabled={loading && !hasLoaded}>
            Refresh
          </Button>
        </div>

        {loading && !hasLoaded ? (
          <PageLoading label="Loading suppliers" />
        ) : (
          <Layout>
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Add supplier
                  </Text>
                  <FormLayout>
                    <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
                    <TextField label="Email" value={email} onChange={setEmail} autoComplete="off" />
                    <TextField label="Phone" value={phone} onChange={setPhone} autoComplete="off" />
                    <TextField
                      label="Notes"
                      value={notes}
                      onChange={setNotes}
                      multiline={2}
                      autoComplete="off"
                    />
                    <Button variant="primary" loading={busy} onClick={create}>
                      Create supplier
                    </Button>
                  </FormLayout>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Link product
                  </Text>
                  <FormLayout>
                    <Select
                      label="Supplier"
                      options={
                        suppliers.length
                          ? suppliers.map((s) => ({ label: s.name, value: s.id }))
                          : [{ label: "No suppliers yet", value: "" }]
                      }
                      value={linkSupplierId}
                      onChange={setLinkSupplierId}
                    />
                    <Select
                      label="Product"
                      options={
                        products.length
                          ? products.map((p) => ({
                              label: p.title,
                              value: p.shopifyProductId,
                            }))
                          : [{ label: "No products yet", value: "" }]
                      }
                      value={linkProductId}
                      onChange={setLinkProductId}
                    />
                    <TextField
                      label="Supplier warranty (months)"
                      type="number"
                      value={linkMonths}
                      onChange={setLinkMonths}
                      autoComplete="off"
                    />
                    <Button loading={busy} onClick={linkProduct}>
                      Save link
                    </Button>
                  </FormLayout>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Suppliers
                  </Text>
                  {suppliers.length === 0 ? (
                    <PageEmpty title="No suppliers yet" body="Add a supplier to start tracking recovery." />
                  ) : (
                    <DataTable
                      columnContentTypes={["text", "text", "text", "numeric", "numeric", "text"]}
                      headings={["Name", "Email", "Phone", "Products", "Claims", "Active"]}
                      rows={suppliers.map((s) => [
                        s.name,
                        s.email ?? "—",
                        s.phone ?? "—",
                        String(s.productCount),
                        String(s.claimCount),
                        s.active ? "Yes" : "No",
                      ])}
                    />
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Product links
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text"]}
                    headings={["Product", "Supplier", "Supplier warranty"]}
                    rows={links.map((l) => [
                      l.productTitle ?? l.shopifyProductId,
                      l.supplierName,
                      l.supplierWarrantyMonths != null ? `${l.supplierWarrantyMonths} mo` : "—",
                    ])}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Supplier claims
                  </Text>
                  {claims.length === 0 ? (
                    <PageEmpty
                      title="No supplier claims"
                      body="Mark claims as recoverable from the claim detail Resolve tab."
                    />
                  ) : (
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text", "text"]}
                      headings={["Claim", "Supplier", "Amount", "Status", "Notes"]}
                      rows={claims.map((c) => [
                        <Button key={c.id} url={`/claims/${c.claimId}`} variant="plain">
                          {c.claimNumber ?? c.claimId}
                        </Button>,
                        c.supplierName,
                        c.amountCents != null
                          ? `${(c.amountCents / 100).toFixed(2)} ${c.currency}`
                          : "—",
                        c.status,
                        c.notes ?? "—",
                      ])}
                    />
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}
      </div>
    </Page>
    </FeatureLock>
  );
}
