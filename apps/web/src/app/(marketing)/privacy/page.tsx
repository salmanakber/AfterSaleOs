import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — AfterSale OS",
  description:
    "How AfterSale OS collects, uses, and protects merchant and customer data for Shopify warranty and claims workflows.",
};

const CONTACT_EMAIL = "tidyflaw@gmail.com";
const APP_URL = "https://aftersale.tidyflowapp.com";
const LAST_UPDATED = "October 19, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--mk-canvas)] text-[var(--mk-ink)]">
      <header className="mk-nav">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/welcome" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl object-cover" />
            <span className="mk-display text-lg font-semibold tracking-tight">AfterSale OS</span>
          </Link>
          <Link
            href="/welcome"
            className="rounded-xl bg-[var(--mk-ink)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Back to home
          </Link>
        </div>
      </header>

      <article className="mk-privacy">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mk-accent)]">Legal</p>
        <h1>Privacy Policy</h1>
        <p>
          <strong>Last updated:</strong> {LAST_UPDATED}
        </p>
        <p>
          AfterSale OS (“AfterSale”, “we”, “us”) is a Shopify application operated by Tidyflow that helps merchants
          register product warranties, run claims, and offer a branded customer portal. This Privacy Policy explains
          what information we process when you install or use AfterSale OS at{" "}
          <a href={APP_URL}>{APP_URL}</a>.
        </p>

        <h2>1. Who this policy covers</h2>
        <p>This policy applies to:</p>
        <ul>
          <li>
            <strong>Merchants</strong> who install AfterSale OS on a Shopify store (store owners and staff).
          </li>
          <li>
            <strong>End customers</strong> who use registration, portal, claim, certificate, or QR flows offered by a
            merchant through AfterSale OS.
          </li>
          <li>
            <strong>Website visitors</strong> to our marketing site.
          </li>
        </ul>

        <h2>2. Information we collect</h2>
        <p>Depending on how the app is used, we may process:</p>
        <ul>
          <li>
            <strong>Shop &amp; account data:</strong> Shopify shop domain, shop name, contact email, plan and billing
            status, staff member emails/roles you add in Team, and authentication session tokens required to call the
            Shopify Admin API.
          </li>
          <li>
            <strong>Order &amp; product data:</strong> order numbers, line items, product titles, variants, SKUs, and
            related identifiers synced from Shopify to determine coverage and registration eligibility.
          </li>
          <li>
            <strong>Customer warranty data:</strong> name, email, phone (if provided), serial numbers, registration
            details, claim descriptions, attachments (such as photos), and claim status history.
          </li>
          <li>
            <strong>Usage &amp; technical data:</strong> QR scan counts, approximate device/browser user-agent, and
            server logs needed for security and troubleshooting.
          </li>
          <li>
            <strong>Marketing site contact:</strong> information you voluntarily send to {CONTACT_EMAIL}.
          </li>
        </ul>
        <p>
          We do not intentionally collect payment card numbers. Shopify Billing and Shopify Checkout handle payments
          when merchants subscribe or when customers pay optional warranty fees on the storefront.
        </p>

        <h2>3. How we use information</h2>
        <ul>
          <li>Provide warranty registration, certificates, claims, repairs, QR links, and the customer portal.</li>
          <li>Authenticate merchants (including Shopify session / token exchange) and enforce plan entitlements.</li>
          <li>Send transactional emails related to registrations, claims, and status updates (when enabled).</li>
          <li>Improve reliability, prevent abuse, and comply with legal obligations.</li>
          <li>Respond to support requests you send us.</li>
        </ul>
        <p>We do not sell personal information.</p>

        <h2>4. Legal bases &amp; Shopify context</h2>
        <p>
          Merchants are typically the controller of their customer data. AfterSale OS processes that data as a service
          provider / processor to deliver the features the merchant enables. Where we act as a controller (for example,
          merchant account contact details or our marketing site), we process data to perform our contract with you and
          for legitimate interests such as securing and improving the service.
        </p>

        <h2>5. Sharing</h2>
        <p>We may share information with:</p>
        <ul>
          <li>
            <strong>Shopify</strong>, as required to run an embedded app, billing, and Admin API operations.
          </li>
          <li>
            <strong>Infrastructure &amp; email providers</strong> that host the app, database, or send transactional
            mail on our behalf, under contractual confidentiality and security obligations.
          </li>
          <li>
            <strong>The merchant’s storefront experience</strong> — customer-facing pages show brand and warranty
            information the merchant configures.
          </li>
          <li>
            Authorities when required by law, or professional advisors under confidentiality.
          </li>
        </ul>

        <h2>6. Data retention</h2>
        <p>
          We retain merchant and customer records for as long as the app remains installed and as needed to provide the
          service, resolve disputes, and meet legal requirements. When a merchant uninstalls, we stop active processing
          for that shop; residual backups may persist for a limited period before deletion according to our operational
          schedules, unless a longer retention is required by law or an open support matter.
        </p>

        <h2>7. Security</h2>
        <p>
          We use industry-standard measures appropriate to the sensitivity of the data, including encrypted transport
          (HTTPS), access controls, and least-privilege practices for production systems. No method of transmission or
          storage is 100% secure; please contact us if you believe there has been unauthorized access.
        </p>

        <h2>8. International transfers</h2>
        <p>
          Our servers and subprocessors may be located outside your country. Where required, we use appropriate
          safeguards for cross-border transfers.
        </p>

        <h2>9. Your rights</h2>
        <p>
          Depending on your location, you may have rights to access, correct, delete, or export personal information, or
          to object to certain processing. End customers should contact the merchant store first for warranty/claim
          data held on their behalf. Merchants and individuals may also contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>10. Children’s privacy</h2>
        <p>
          AfterSale OS is not directed to children under 16, and we do not knowingly collect personal information from
          children.
        </p>

        <h2>11. Cookies &amp; similar technologies</h2>
        <p>
          The merchant app and portal may use cookies or local storage for session continuity (for example, keeping a
          customer signed into the portal). Our marketing site uses minimal technical storage required to deliver the
          pages. We do not run third-party advertising trackers on the marketing site as of the date above.
        </p>

        <h2>12. Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. The “Last updated” date will change when we do. Material
          changes for merchants may also be communicated through the app or email on file.
        </p>

        <h2>13. Contact</h2>
        <p>
          Questions about privacy or data requests:
          <br />
          Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <br />
          App / website: <a href={APP_URL}>{APP_URL}</a>
        </p>
        <p>
          For Shopify marketplace listing purposes, this Privacy Policy is publicly available at{" "}
          <a href={`${APP_URL}/privacy`}>{APP_URL}/privacy</a>.
        </p>
      </article>
    </div>
  );
}
