"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, Card, FormLayout, Layout, Page, TextField } from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";

export default function NewClaimPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await gqlRequest<{ createMerchantClaim: { id: string } }>(
        `#graphql
        mutation C($input: CreateMerchantClaimInput!) {
          createMerchantClaim(input: $input) { id }
        }`,
        {
          input: {
            email,
            customerName: name || null,
            issueSummary: summary,
            issueDetails: details || null,
          },
        },
      );
      router.push(`/claims/${data.createMerchantClaim.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setLoading(false);
    }
  }

  return (
    <Page title="Create claim" backAction={{ url: "/claims" }}>
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical">{error}</Banner>
          </Layout.Section>
        ) : null}
        <Layout.Section>
          <Card>
            <form onSubmit={onSubmit}>
              <FormLayout>
                <TextField label="Customer email" type="email" value={email} onChange={setEmail} autoComplete="email" requiredIndicator />
                <TextField label="Customer name" value={name} onChange={setName} autoComplete="name" />
                <TextField label="Summary" value={summary} onChange={setSummary} autoComplete="off" requiredIndicator />
                <TextField label="Details" value={details} onChange={setDetails} multiline={4} autoComplete="off" />
                <Button submit variant="primary" loading={loading}>
                  Create claim
                </Button>
              </FormLayout>
            </form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
