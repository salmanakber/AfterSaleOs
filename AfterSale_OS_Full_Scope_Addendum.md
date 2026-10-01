# AfterSale OS — Full-Scope 1.0 Addendum

**Companion to:** `context_1_.md` (AfterSale OS spec)
**Rule:** Where this addendum conflicts with the original document, this addendum wins.
**Verification rule:** Every Shopify-specific requirement below must be re-checked against current Shopify documentation at build time. Platform rules change.
**Revision 2:** Adds the Next.js + Prisma stack (§5A) and the design palette (§5B).
**Revision 3:** Pulls all of Phase 3 into 1.0; adds the Merchant Dashboard guide (§6A) and the Super Admin Dashboard (§6B).

---

## 1. Decision

AfterSale OS **1.0** ships the advanced product, not a thin slice:

- Everything in the original MVP (§5–§56)
- Everything in Phase 2 (§58)
- Everything in Phase 3 (§59): technician portal, parts inventory, multi-location, public API, enterprise/multi-store management, SMS/WhatsApp, ERP integrations, full supplier management and supplier portal
- A **Merchant Dashboard** (§6A) and a **Super Admin Dashboard** (§6B)
- A **Free plan** to drive installs

**Nothing from the original phases is deferred to a later release.** The milestones in §3 set the *build order*, not what is cut. The cut order at the end of §3 is only a contingency if the schedule slips.

**Sections of the original this replaces:** §5 (MVP scope), §57 (MVP out of scope), §58 and §59 (Phases 2 and 3, now in scope), §63 (priorities), §69 (definition of completion), §70 (principle: "do not overbuild").

> New principle: Build everything, but **in milestones where each milestone leaves the app installable and testable**, so a late-stage problem never blocks the whole launch.

---

## 2. Scope of 1.0

| # | Module | Source |
|---|--------|--------|
| 1 | Shopify install, auth, uninstall, compliance webhooks | §5, §41–43, §54 |
| 2 | Warranty rules, types, precedence, versioning | §7–8 + §4 below |
| 3 | Order/product/customer sync + historical backfill | §23–25 + §4 below |
| 4 | Per-unit warranty records, expiry engine | §25–26 + §4 below |
| 5 | Product registration (form, QR, serial validation) | §9, §20–21 |
| 6 | Customer portal + certificate (HTML + PDF) | §10–11, §33 |
| 7 | Claims: form, attachments, eligibility, tracking | §12–14, §19 |
| 8 | Merchant dashboard (full guide in §6A) | §6, §16–17, §36 |
| 9 | Notifications: email, templates, in-app | §18, §39–40 |
| 10 | Staff roles, assignment, activity log, audit | §34–35, §56 |
| 11 | Repairs | §30 |
| 12 | Replacements (Shopify draft order) | §31 |
| 13 | Refund resolution | §47 |
| 14 | Custom claim workflows | §15, §58 |
| 15 | Expiry reminder campaigns | §26, §58 |
| 16 | Analytics incl. failure-rate intelligence | §27–28 |
| 17 | AI assistant (summaries, classification, missing info, drafts) | §29 |
| 18 | QR product support pages, manuals, FAQs | §21–22 |
| 19 | Shopify Flow triggers/actions | §23, §58 |
| 20 | CSV import/export, bulk operations | §37–38 |
| 21 | Supplier management (links, recovery tracking, supplier claims) | §32, §59, §6.12 |
| 22 | Billing: Free + 3 paid plans, usage limits | §64 |
| 23 | Onboarding, empty states, branding | §49–50, §65–66 |
| 24 | Technician portal | §59, §6.13 |
| 25 | Parts inventory | §59, §6.14 |
| 26 | Multi-location | §59, §6.15 |
| 27 | Public API + outbound webhooks | §59, §6.16 |
| 28 | Enterprise / multi-store organizations | §59, §6.17 |
| 29 | SMS / WhatsApp notifications | §59, §6.18 |
| 30 | ERP / accounting integrations | §59, §6.19 |
| 31 | Supplier portal | §59, §6.20 |
| 32 | Super Admin Dashboard | §6B |

---

## 3. Build order (milestones)

Sizes are relative effort (S/M/L/XL), not time estimates. Each milestone has an exit test.

### M0 — Foundation (L)
- App scaffold on Next.js + Prisma (see §5A); embedded admin using App Bridge + Polaris; session-token auth; Shopify extensions built with Shopify CLI in the same repo
- Database with `shop_id` on every table; row-level data-isolation tests
- Webhook ingestion with idempotency (store event IDs), job queue with retries and failure logs
- GraphQL client with rate-limit/cost handling
- Mandatory privacy webhooks (customer data request, customer redact, shop redact) wired to real deletion
- Billing skeleton (Free + paid plans) and **usage counters**
- **Exit:** install → setup → uninstall → reinstall works cleanly; privacy webhooks verifiably delete data; cross-shop access test fails as expected.

### M1 — Warranty engine (XL)
- Rules with versioning and precedence; per-unit warranty creation; start-date options; expiry calculation
- Refund/cancellation effects; manual warranty creation
- Historical backfill (see §4)
- **Exit:** automated test matrix for date math and rule precedence passes; 12-month backfill on a large test store completes without timing out or hitting rate limits.

### M2 — Customer experience (XL)
- Registration (theme block + app-proxy page), serial validation modes
- Customer portal: customer-account extension + magic-link fallback
- Certificate (online + PDF), QR codes
- **Exit:** a real customer can register and view warranty on mobile, logged in and as a guest.

### M3 — Claims core (XL)
- Claim form, secure attachment pipeline, eligibility engine
- Merchant claim list/detail, statuses, internal notes, assignment, activity log
- Email notifications and templates
- Super Admin basics (§6B core): shop list, plan and usage, job/webhook failures, read-only support view
- **Exit:** full claim cycle works end-to-end. **← Recommended App Store submission gate (see below).**

### M4 — Resolutions (L)
- Repair workflow, replacement via draft order, refund recording, supplier tracking (portal comes in M9), custom workflows

### M5 — Insights and automation (L)
- Analytics + failure intelligence, expiry campaigns, Flow triggers/actions, CSV import/export, bulk operations, Shopify admin order/product blocks

### M6 — AI assistant (M)
- Summaries, classification, missing-info prompts, suggested replies, credit metering, logs

### M7 — Content and polish (M)
- Manuals/FAQs/support pages, onboarding, empty states, branding, in-app docs

### M8 — Operations at scale (XL)
- Technician portal, parts inventory, multi-location (§6.13–6.15)
- **Exit:** a technician completes a repair from a phone, parts stock decrements correctly, and location scoping blocks cross-location access.

### M9 — Platform and integrations (XL)
- Public API + outbound webhooks, SMS/WhatsApp, ERP connector framework + first connectors, enterprise organizations, supplier portal (§6.16–6.20)
- **Exit:** API key scoping and rate limits tested; organization isolation tests pass; a supplier can respond to a shared claim without seeing customer personal data.

### M10 — Super Admin Dashboard, full (L)
- Everything in §6B: metrics, billing and plan tools, usage and cost reports, feature flags, compliance tracker, announcements, audited support tooling
- **Exit:** the operator can diagnose a failing shop, change its plan or limits, and resolve a privacy request without touching the database directly.

### M11 — Launch hardening (L)
- Security review, load test (large backfill + attachment volume), accessibility, billing test across upgrade/downgrade, full-journey review rehearsal, listing assets

### Submission gate (recommendation)
Submit to Shopify review **after M3**, then ship M4–M10 as updates. Reasons: a smaller first surface means fewer review issues, installs and real feedback start months earlier, and you can still market the full roadmap. If you prefer to submit after M11, accept that you will have no merchant feedback until then.

### If time runs over (cut order)
If any milestone takes more than ~2× its estimate, cut from the bottom of this list first: ERP connectors → SMS/WhatsApp → enterprise organizations → technician portal and parts inventory → AI assistant → QR pages/manuals/FAQs → custom workflows → Flow → bulk operations. Never cut: privacy webhooks, data isolation, per-unit warranties, eligibility override.

---

## 4. Corrections and additions to the original spec

These fix gaps that would cause bugs or churn if left as written.

### 4.1 Warranties are per unit, not per order line
A line item with quantity 3 creates **3 warranty units**, each with its own serial number and claim history. Data model: `order_line_items` → `warranty_units` (one per unit) → `warranties` (one or more per unit).

### 4.2 Start-date rule options
Per rule: purchase date, fulfillment date, delivery date (when carrier events are available), registration date, or fixed date. If the start event hasn't happened, status is `pending_start`. Default for new rules: fulfillment date.

### 4.3 Date math
- End date = start + duration using calendar months, clamped to the last day of the month (Jan 31 + 1 month = Feb 28/29).
- Coverage includes the end date and ends at end-of-day in the **shop's timezone**.
- Store UTC instants plus the timezone used. Lifetime warranties have a null end.

### 4.4 Rule precedence and stacking
Precedence: variant rule > product rule > collection rule > default rule; ties broken by explicit priority number. A unit may have **multiple warranties** of different types (e.g. store warranty plus manufacturer warranty). The claim form lets the customer pick which one applies.

### 4.5 Snapshot the terms
Rule edits create a new **rule version**. Existing warranties keep their original version. A merchant can run "re-evaluate with new version" with a preview and activity-log entry. Terms and duration shown on certificates come from the snapshot.

### 4.6 Refunds, cancellations, returns
Setting per merchant: void warranty on refund (default) or keep. Handle partial refunds by quantity and cancelled orders. All changes are logged with previous and new state.

### 4.7 Serial number modes (per rule)
1. Not required
2. Customer-entered, unique per shop
3. Validated against a merchant-uploaded serial list (each serial claimable once)
4. Assigned at fulfillment (merchant imports/enters by order)

A duplicate or mismatched serial flags the registration for review. The response must never reveal who owns a serial.

### 4.8 Purchases outside Shopify
Customers can register with proof of purchase (upload + purchase date + seller). Status `pending_verification` until a merchant approves; source recorded as `manual`. Merchants can also create warranties manually.

### 4.9 Historical backfill
On install, the merchant chooses a lookback (12 months, 24 months, or all available). Use GraphQL bulk operations, run as a background job with progress and resumability. **Note:** apps normally only see recent orders (about 60 days) unless the broader order-history scope is approved by Shopify; request that scope early and handle the "recent only" case gracefully.

### 4.10 Eligibility never hard-blocks
Outcomes: `eligible`, `eligible_needs_review`, `outside_warranty_needs_review`, `not_covered_by_rule`. **No automatic rejection.** Expired status is a soft flag for the merchant to decide, because consumer law in some regions gives customers rights beyond a merchant's warranty. Include a configurable grace period. Add a disclaimer in merchant terms templates; have a lawyer review the default wording.

### 4.11 Ownership transfer
A customer can request a transfer to a new owner email; the merchant approves; history is preserved.

### 4.12 Customer access without duplicate accounts (§33)
Three paths:
1. **Logged in** via Shopify customer accounts (customer-account extension) — full portal.
2. **Storefront** via app proxy with the signed-in customer identity.
3. **Guest:** order number + email → single-use, short-lived magic link. Identical response whether or not the order exists (no account enumeration); rate-limited.

Claim and certificate URLs use unguessable tokens **and** authorization checks.

---

## 5. Shopify platform requirements (verify at build time)

- **API:** GraphQL Admin API only (new public apps must not rely on REST). Pin an API version; upgrade on a regular cadence.
- **Protected customer data:** apply for access early; request only the minimum scopes. Use **optional scopes** where possible so features like replacements, refunds and customer import only ask for extra access when enabled.
- **Webhooks:** prefer declarative app-config subscriptions plus a daily reconciliation job to catch missed events.
- **Extensions:** theme app extension (registration + lookup blocks), customer-account UI extension, app proxy for public pages, Flow extension, admin blocks for order/product pages.
- **Billing:** use Shopify's billing mechanism for all charges, including the Free plan modeling and downgrade handling.
- **Privacy:** customer redact and shop redact must delete attachments from object storage, not only database rows. Respect Shopify's current timing rules for shop redact.
- **Review rehearsal:** test the whole journey (install → OAuth → permissions → app UI → setup → uninstall → reinstall) before submission.

---

## 5A. Tech stack: Next.js + Prisma

**Core:** Next.js (App Router) + TypeScript, Prisma ORM, PostgreSQL.

**Honest trade-off:** Next.js is not Shopify's official app template, so you own the Shopify glue (OAuth/token exchange, session-token verification, webhook HMAC checks, billing flow). Budget for this in M0 and cover it with tests. Use `@shopify/shopify-api` for the heavy lifting and verify against current Shopify docs.

### Recommended layout (monorepo)
```text
/apps/web          Next.js: embedded admin UI, API routes, customer portal pages, app-proxy endpoints
/apps/worker       Background worker: backfill, webhook processing, emails, PDFs, AI jobs
/apps/admin        Super Admin Dashboard (separate deployment, see §6B)
/extensions        Shopify CLI extensions: theme blocks, customer-account UI, Flow, admin blocks
/packages/db       Prisma schema, migrations, tenant-scoped client
/packages/shared   Types, plan limits, date/eligibility logic (unit-tested)
```

### Prisma rules
- Every model has `shopId`; composite indexes start with `shopId`.
- Use **one tenant-scoped Prisma client** (a client extension that injects `shopId` into every query). No raw unscoped client in feature code. Optionally add PostgreSQL row-level security as a second layer.
- Encrypt Shopify access tokens at rest (field-level encryption).
- The Super Admin app uses a **separate `adminPrisma` client** with explicit cross-tenant methods, each wrapped to write an audit-log entry (§6B). Merchant-facing code never imports it.
- Use `prisma migrate` for all schema changes; no manual production edits.
- Use connection pooling if deployed serverless.
- Store money as integer minor units + currency; store timestamps in UTC plus the shop timezone where date math matters (§4.3).

### Background work
- Webhook route does only: verify HMAC → insert `webhook_events` row (idempotency key) → return 200 → enqueue job.
- Anything long (historical backfill, PDF generation, bulk ops, AI, campaign sends) runs in the **worker**, never in a Next.js request. Use a queue (e.g. BullMQ + Redis, or a hosted option like Inngest/Trigger.dev).
- If you host the web app on a serverless platform, the worker must still run somewhere with long-running capability.

### Other services
- **Files:** S3-compatible storage (S3/R2) with signed upload/download URLs and virus scanning.
- **Email:** transactional provider (Resend, Postmark or SES); separate stream for marketing-type reminders.
- **Rate limiting:** Redis-based on guest lookup, magic links, and claim submission.
- **UI:** Polaris for the embedded admin (check whether Shopify currently recommends the React or web-component version); Tailwind with the tokens in §5B for customer-facing pages.
- **PDF:** generated in the worker.
- **Observability:** Sentry, structured logs, job dashboards.
- **Testing:** Vitest for logic (date math, precedence, eligibility, tenant isolation), Playwright for the install-to-claim journey.

---

## 5B. Design system and color palette

**Approach:** Keep the embedded admin close to Polaris so it feels native in Shopify. Apply the brand palette to your own surfaces (charts, status badges, dashboard highlights) and to customer-facing pages, where the merchant can override the accent color.

**Why indigo:** signals trust and protection, and stands apart from Shopify's own green.

### Core tokens (light)
| Role | Hex | Use |
|---|---|---|
| Primary (Shield Indigo) | `#4338CA` | Buttons, links, active states |
| Primary hover | `#3730A3` | Hover/pressed |
| Primary tint | `#EEF2FF` | Selected rows, soft backgrounds |
| Accent (Amber) | `#F59E0B` | Highlights, "expiring" emphasis. Use as a **background** with dark text, not as text on white |
| Ink (text) | `#0F172A` | Main text |
| Muted text | `#64748B` | Secondary text |
| Border | `#E2E8F0` | Dividers, inputs |
| Background | `#F8FAFC` | Page background |
| Surface | `#FFFFFF` | Cards |

### Status colors
| State | Color | Notes |
|---|---|---|
| Active / Approved / Completed | `#16A34A` | Green |
| Expiring soon | `#D97706` | Amber-dark |
| Pending / In review | `#0284C7` | Sky blue |
| Expired | `#64748B` | **Slate, deliberately not red**, since expiry is a soft flag (§4.10) |
| Rejected / Void | `#DC2626` | Red, only for explicit decisions |

For badges use a light tint background with a dark text version of the color to keep contrast accessible.

### Dark mode
Background `#0B1220`, surface `#111A2B`, border `#1E293B`, text `#E2E8F0`, primary `#818CF8`.

### Customer-facing pages
Default to the palette above; let the merchant set one accent color and logo. Auto-check text contrast against the chosen accent and fall back to dark or light text. Target WCAG AA.

A ready-to-use token file is provided as `theme.ts`.

---

## 6. Phase 2 and Phase 3 feature specifications

### 6.1 Repairs
Statuses from §30 (Repair Required → Product Received → Diagnosis → Repairing → Quality Check → Ready → Shipped → Completed). Fields: repair ID, claim, unit, diagnosis, notes, repair cost, shipping details, completion date. Technician is a plain staff assignment in 1.0 (no separate portal). Each status can trigger a customer email.

### 6.2 Replacements
Creates a Shopify **draft order** for the replacement item at zero cost, tagged and linked to the claim. Merchant reviews and completes it (Growth+ plans may auto-complete via a setting). Track the resulting order's fulfillment via webhooks and update the claim. Replacement unit gets a new warranty: inherit remaining term or restart (merchant setting).

### 6.3 Refunds
Record refund as a resolution with amount and reason. Issue the refund through Shopify only after merchant confirmation and only if the required scope is granted; otherwise deep-link to the Shopify admin order.

### 6.4 Custom claim workflows
Merchants define statuses, order, and allowed transitions. **Every custom status maps to a system state** (open, waiting_customer, approved, rejected, in_resolution, completed, cancelled) so analytics, notifications and Flow still work. Each status can have its own email template. Ship a default preset matching §15.

### 6.5 Staff and permissions
Use Shopify staff identity for sign-in; the app stores a role/permission map (§34). Assignment, "my claims" view, and permission checks on every action.

### 6.6 AI assistant
- Features: claim summary, issue classification, missing-information prompts, suggested replies.
- **Suggest-only.** AI output never approves, rejects, sends, or changes status on its own; a staff member must act.
- Treat customer text and attachments as **untrusted input** (prompt-injection safe: instructions inside a claim are data, not commands).
- Send minimal data (claim text, product name); strip emails/phones/addresses.
- Provider-agnostic interface; credit metering per plan; log metadata in `ai_processing_logs` with a retention limit.
- Graceful fallback when the provider is down.

### 6.7 Expiry reminder campaigns
Merchant-configurable schedule (default 30 / 7 / 0 days). Optional link to a collection or discount code the merchant chooses (repeat-purchase goal). Reminders that promote offers count as marketing: include unsubscribe and honor consent.

### 6.8 Analytics
Units sold (from order quantities), claim rate = claims ÷ units, by product/variant/supplier/purchase-month cohort/serial range, by issue category, resolution time, repair/replacement/refund rates, optional cost tracking. Use precomputed snapshots for speed; CSV export.

### 6.9 QR codes, product support pages, manuals, FAQs
QR per product, variant or campaign, pointing to a short URL served through the merchant's storefront (app proxy) for brand trust. Page shows product info, register, warranty lookup, claim entry, manuals (PDF), FAQs, troubleshooting. Track scans.

### 6.10 Shopify Flow
Triggers: warranty created, warranty expiring, claim created, claim status changed. Actions: add internal note, change claim status. Confirm current Flow extension capabilities before finalizing.

### 6.11 CSV import/export and bulk operations
Import: existing warranties, serial lists, registrations, with column mapping, row preview, dry run, and per-row error report. Export: warranties, claims, products, analytics. Bulk actions (select rows → assign, change status, export, apply rule) run as background jobs with progress and per-row results. *(Reuse the import/mapping/preview engine from TidySync where possible.)*

### 6.12 Supplier management
Supplier records; link products to suppliers; optional supplier warranty duration; per-claim "recoverable from supplier" flag, amount, and status (not filed / filed / accepted / rejected / reimbursed). Report: recoverable vs recovered. The supplier portal is specified in §6.20.

### 6.13 Technician portal
A separate, simplified interface for the people who do repairs.
- Invited by a merchant admin; passwordless login (magic link) with optional 2FA. Every session is scoped to one shop and, optionally, to specific locations.
- Sees only repairs assigned to them (or their location's queue, if the merchant allows).
- Views: My queue, Repair detail, Parts used, Time log. Actions: update repair status, add diagnosis notes and photos, log parts used (decrements stock, §6.14), log time, mark ready or complete.
- Customer data is minimized: product, issue and first name by default; contact details and address only if the merchant enables them for that role.
- Mobile-first layout, since technicians often work from a phone or tablet.
- Every action is audit-logged. Technicians never see billing, analytics, settings, or other staff's claims.

### 6.14 Parts inventory
- Parts catalog: SKU, name, supplier, unit cost, compatible products/variants, reorder level, per-location stock.
- Logging a part on a repair decrements stock and adds its cost to the repair. Negative stock is blocked (override requires a reason).
- Stock adjustments, restock log, low-stock alerts (dashboard + email), CSV import/export.
- Parts stock is separate from Shopify product inventory by default, because parts are usually not sold products. Optional link to a Shopify inventory item where they are.
- Analytics: parts cost per product, most-used parts, stock value.

### 6.15 Multi-location
- Locations: service centers, warehouses, stores. Optionally mapped to Shopify locations. Each has an address, return-shipping address and hours.
- Claims, repairs and parts are assigned to a location. Staff and technicians can be restricted to specific locations.
- Per-location parts stock with transfers between locations (request → ship → receive).
- Reports and filters by location. The claim form can suggest the nearest drop-off or service location.
- Location count is limited per plan (§8).

### 6.16 Public API and outbound webhooks
- **REST JSON API v1**, versioned and documented with OpenAPI: warranties, claims, registrations, products, repairs, parts, suppliers.
- **API keys** per shop: scoped permissions (read/write per resource), hashed at rest, shown once, rotatable, with last-used timestamp.
- Rate limits per key and per shop, idempotency keys on create endpoints, cursor pagination.
- **Outbound webhooks:** warranty.created, warranty.expiring, registration.created, claim.created, claim.status_changed, repair.status_changed. Signed with HMAC, retried with backoff, delivery log with manual replay.
- The API goes through the same tenant-scoped data layer and permission checks as the dashboard.

### 6.17 Enterprise / multi-store organizations
- An **organization** groups multiple connected shops under owner/admin members.
- Consolidated dashboard and analytics across stores (claims, claim rates, costs, resolution times) with per-store filters.
- Shared configuration: push warranty rule sets, claim workflows and email templates from one store (or an organization template) to others, with preview and per-store override.
- Organization-level roles, and optional SSO (SAML/OIDC) on the Enterprise plan.
- **Isolation:** cross-store queries are allowed only through explicit organization-membership checks, never by relaxing `shopId` scoping. Add tests that a member of organization A can never read organization B.
- **Billing note:** Shopify billing is per shop, so organization-wide pricing or invoicing needs a separate arrangement. Verify what Shopify allows before promising it.

### 6.18 SMS / WhatsApp notifications
- Provider integration (for example Twilio or a WhatsApp Business provider) behind a channel interface alongside email.
- Used for claim status updates, repair progress and expiry reminders. Templates per status. WhatsApp requires pre-approved message templates.
- **Consent first:** capture opt-in at registration or claim, honor opt-out keywords (e.g. STOP), quiet hours, and country-specific rules. Marketing-type reminders need explicit consent.
- Inbound handling is limited to opt-out and attaching customer replies to the claim as notes.
- Delivery status tracking, automatic email fallback, per-message cost recorded for usage billing.
- Usage-billed on paid plans (cost plus margin); off by default.

### 6.19 ERP and accounting integrations
- Build a **connector framework** first: encrypted OAuth credential storage, field-mapping UI, sync log with retries and error details, per-connector enable/disable.
- Initial connectors: QuickBooks Online and Xero (accounting), plus a generic webhook/CSV export for everything else.
- Data flows: product and serial master data in; repair costs, refunds and credit notes out.
- Add ERP connectors (e.g. NetSuite, Odoo, SAP Business One) **only against real merchant demand**, one at a time.
- Sync is idempotent and resumable. Conflicts are flagged for a human, never silently overwritten.

### 6.20 Supplier portal
- Merchants invite suppliers by email. Suppliers get a separate portal login scoped to the claims the merchant has shared with them.
- Supplier sees: product, serial, issue summary, evidence the merchant chooses to share, and the requested recovery amount. Customer personal data is hidden by default.
- Supplier actions: accept, reject (with reason), request more information, upload documents, add shipping/RMA tracking, update reimbursement status.
- Message thread per supplier claim, notifications both ways, full audit trail.
- The merchant dashboard shows supplier response times and recovery rates (§6.12).

---

## 6A. Merchant Dashboard

The merchant dashboard is the embedded app inside the Shopify admin. Build it with Polaris so it feels native. Design goal: a merchant opens it and immediately sees what needs their action.

### Navigation
Home · Claims · Warranties · Registrations · Repairs · Resolutions · Products & Rules · Customers · Parts & Locations · Suppliers · Campaigns · Analytics · Automations · Integrations · Settings · Plans & Usage · Help

Items are hidden by role permissions, and show an upgrade prompt when the plan doesn't include them.

### Screen guide
| Screen | What the merchant does | Key contents | Milestone |
|---|---|---|---|
| **Home** | Sees what needs attention today | Setup checklist; KPI cards; "needs attention" list; usage meter; recent activity | M0 shell, M3 full |
| **Claims** | Reviews and resolves claims | Table with filters/saved views/bulk actions; claim detail (below) | M3 |
| **Warranties** | Looks up and manages coverage | Search by serial, order, email; detail with rule version, dates, history, claims; manual create, void, extend, transfer (all logged with reason) | M1 |
| **Registrations** | Verifies registrations | Queue of pending-verification items, proof of purchase, serial conflicts, approve/reject | M2 |
| **Products & Rules** | Defines coverage | Product list with coverage badge; rule editor (type, duration, start rule, serial mode, exclusions, terms, claim categories, grace period); impact preview; assignments by product/variant/collection; version history; manuals, FAQs, QR, supplier link | M1, M2, M7 |
| **Customers** | Sees a customer's full picture | Orders, warranties, claims, messages, consent status; merchant-initiated data deletion on request | M3 |
| **Repairs** | Runs repairs | Board view by status plus list; detail with diagnosis, parts used, cost, technician, location, shipping | M4 |
| **Resolutions** | Tracks replacements and refunds | Replacement draft orders linked to claims, refund log, amounts | M4 |
| **Parts & Locations** | Manages stock and sites | Parts catalog, per-location stock, transfers, low-stock alerts; location list | M8 |
| **Suppliers** | Recovers cost from suppliers | Supplier list, supplier claims, recoverable vs recovered, portal invites | M4, M9 |
| **Campaigns** | Runs expiry reminders | Schedule, templates, preview, send log, unsubscribes, results | M5 |
| **Analytics** | Finds failing products | Tabs: Overview, Products (failure rates), Suppliers, Resolution time, Costs, Cohorts; CSV export | M5 |
| **Automations** | Customizes the process | Claim workflows and statuses, notification templates, auto-assignment rules, Flow guidance | M4, M5 |
| **Integrations** | Connects other systems | API keys, outbound webhooks, SMS/WhatsApp, accounting/ERP connectors, health status | M9 |
| **Settings** | Configures the app | Branding (logo, accent color), customer portal, email sender domain, terms and policies, claim form builder, staff and roles, data retention, language and timezone | M0–M7 |
| **Plans & Usage** | Manages subscription | Current plan, usage meters, upgrade, invoices (via Shopify) | M0 |
| **Help** | Gets support | Docs, contact support, changelog | M7 |

### Home in detail
1. **Setup checklist** (hides when done): create first rule → review backfilled warranties → customize customer pages → send a test notification.
2. **KPI cards:** open claims, awaiting my action, average first-response time, claim rate (30 days), warranties expiring this month, active warranties.
3. **Needs attention:** claims waiting longer than a threshold, registrations pending verification, claims near SLA breach, low-stock parts, failed syncs or webhooks.
4. **Usage meter** against plan limits, with an upgrade link when near a limit.
5. **Recent activity** feed and quick actions (create warranty, create claim, import CSV).

### Claim detail in detail
- **Header:** claim ID, status, priority, SLA timer, assignee, location.
- **Left column:** customer, product and unit, applicable warranty, eligibility result with reasons and a visible **override** control (never a hard block).
- **Center:** timeline combining customer messages, internal notes, status changes and attachments gallery.
- **Right column (actions):** change status, request info, approve/reject, create repair, create replacement draft order, record refund, mark recoverable from supplier, share with supplier.
- **AI panel (suggest-only):** summary, category, missing-information prompts, suggested reply. A person always sends or applies.

### Roles
Owner/Admin (everything), Support agent (claims, warranties, customers), Analyst (read-only analytics), Technician (technician portal only), Supplier (supplier portal only). Permissions are checked server-side on every action.

### UX rules
Server-side pagination and filtering, saved views, bulk actions with progress and per-row results, an empty state with one clear next action on every screen, inline help, responsive layout for the Shopify mobile admin, keyboard and screen-reader support (WCAG AA), consistent status badges from §5B.

---

## 6B. Super Admin Dashboard

The Super Admin Dashboard is **your internal operations console**, used by you and your team to run the product. Merchants never see it.

### Access and security
- Separate app and deployment (`/apps/admin`), not embedded in Shopify.
- Sign-in via company SSO or passkeys with required 2FA; optional IP allowlist.
- Roles: `super_admin`, `support`, `finance` (read-only billing), `developer` (jobs and logs).
- **Every action is written to `admin_audit_logs`** (who, what, which shop, why, when).
- Uses the separate `adminPrisma` client (§5A). Customer personal data is **masked by default** with a logged "reveal" action.
- Treat this app as your highest-value attack target: least privilege, short sessions, no shared accounts.

### Modules
| Module | What it shows or does |
|---|---|
| **Overview** | Installs/uninstalls, active shops, MRR and plan mix (from Shopify billing data), activation funnel (install → rule → warranty → registration → claim → resolved), churn and retention cohorts, top errors |
| **Shops** | Search by domain or email. Shop detail: plan, install date, granted scopes, status, usage vs limits, activation stage, last active, record counts, health (webhook failures, backfill status, sync errors), internal notes. Actions: grant trial or comp plan, raise limits temporarily, re-run backfill or sync, re-register webhooks, suspend/reinstate for abuse, export data on request |
| **Support tools** | Read-only **view-as-merchant**: requires a reason, is time-limited, fully audited, and never allows editing customer data. PII masked by default |
| **Billing and plans** | Plan definitions and limits editor, subscriptions and trials, credits and discounts, failed or frozen subscriptions, usage-based charges (SMS/WhatsApp, AI) |
| **Usage and costs** | Storage, email, SMS/WhatsApp and AI usage per shop; cost per free merchant; top consumers; abuse flags |
| **Jobs and webhooks** | Queue depth, failed jobs with retry and dead-letter handling, webhook event log by shop/topic/status, reconciliation results, backfill progress |
| **Compliance** | Privacy request tracker (customer data request, customer redact, shop redact): received, due, completed, evidence of deletion; retention job logs; audit log search |
| **Feature flags and releases** | Per-shop and percentage flags, kill switches (AI, SMS/WhatsApp, uploads), maintenance banner, merchant announcements, changelog publishing |
| **Content** | Default email and notification templates, default workflow presets, help-center links |
| **Integrations health** | Email, SMS/WhatsApp, AI and ERP connector status and error rates; API key abuse and rate-limit offenders |
| **Abuse and moderation** | Files flagged by virus scan, suspicious guest-lookup attempts, reported content |
| **Admin users** | Invite and remove admins, assign roles, review admin audit log |

### Rules
- Platform-level tables have no `shop_id`; they are reachable only through the audited admin client.
- Support never changes a merchant's customer data directly. Corrections go through documented admin actions that log before and after state.
- Privacy requests must be completable from this dashboard, with proof of deletion kept.


---

## 7. Data model additions

Add to §45:

```text
order_line_items, warranty_units, serial_numbers, serial_lists
warranty_rule_versions, rule_assignments
workflow_definitions, workflow_statuses, workflow_transitions
repairs, replacements, resolutions
suppliers, product_suppliers, supplier_claims
manuals, faqs, qr_scans
campaigns, campaign_sends
ai_processing_logs, usage_counters, plan_limits
backfill_jobs, webhook_events (idempotency), sync_cursors
guest_access_tokens, ownership_transfers
technicians, parts, part_stock, part_usages, stock_adjustments
locations, location_staff, location_transfers
api_keys, api_request_logs, outbound_webhooks, webhook_deliveries
organizations, organization_members, organization_shops, shared_configs
messaging_consents, message_logs (email / SMS / WhatsApp)
integrations, integration_mappings, integration_sync_logs
supplier_users, supplier_claim_messages

-- Super Admin (platform-level, no shop_id, admin client only, see §6B) --
admin_users, admin_audit_logs, impersonation_sessions
feature_flags, announcements, plan_definitions
shop_notes, privacy_requests, job_failures
```

Every merchant-data table carries `shop_id`; every merchant-facing query is scoped by it (§42). Super Admin tables are platform-level and are accessed only through the audited admin client (§6B). Implement as Prisma models using the tenant-scoped client described in §5A.

---

## 8. Plans, limits, and cost control

Prices from §64 are preliminary. **All limits below are starting proposals** to tune after you model storage, email and AI costs per free merchant.

| | Free | Starter ~$19 | Growth ~$49 | Pro ~$99 |
|---|---|---|---|---|
| Warranties created / month | 50 | 500 | 2,500 | 10,000+ |
| Claims / month | 10 | 100 | 500 | Fair use |
| Attachment storage | 1 GB | 10 GB | 50 GB | 250 GB |
| Staff seats | 1 | 2 | 5 | 15 |
| AI credits / month | 10 | 50 | 300 | 1,500 |
| Warranty rules | 3 | 10 | Unlimited | Unlimited |
| Locations | 1 | 1 | 3 | 10 |
| Technician accounts | 0 | 0 | 5 | 25 |
| Public API | No | No | No | Yes |

**Feature gating (suggested):**
- **Free:** rules, registration, portal, online certificate, claims core, default email templates, basic analytics, "Powered by AfterSale" on customer pages.
- **Starter adds:** custom branding and templates, PDF certificate, QR codes, CSV export, backfill beyond 12 months.
- **Growth adds:** repairs, replacement automation, custom workflows, advanced analytics, Flow, expiry campaigns, bulk operations, supplier tracking and supplier portal, technician portal.
- **Pro adds:** AI assistant at scale, parts inventory, multi-location, public API and outbound webhooks, accounting/ERP connectors, highest limits, priority support.
- **Enterprise (custom, contact us):** multi-store organizations, SSO, custom limits and SLA.
- **SMS/WhatsApp:** usage-billed on paid plans (cost plus margin); off by default.

**Rules for limits:**
- **Never block a customer** from submitting a claim or registration because the merchant is over a limit. Accept it, show the merchant an upgrade banner, and restrict merchant-side features instead.
- Enforce limits server-side with usage counters; show usage in the dashboard.
- Cap file size and types per plan; scan uploads; lifecycle rules delete orphaned files.
- Track **cost per free merchant** monthly (storage, email, AI, support).

---

## 9. Free-plan install and activation plan

- **Listing:** one clear promise (e.g. "Warranty registration and claims for your Shopify store, free to start"), demo video, screenshots of the customer portal and claim flow.
- **Activation funnel to track:** install → first rule created → first warranty created → first customer registration → first claim → first resolved claim. Set baselines after the first ~50 installs.
- **First value in minutes:** onboarding (§65) ends with backfilled warranties visible on the dashboard.
- **Reviews:** ask for a review after a merchant's first successful setup or first resolved claim, following Shopify's rules on review requests.
- **Upgrade triggers:** limit reached, backfill beyond 12 months, branding/templates, analytics, repairs/replacements, AI.

---

## 10. Risks and containment

| Risk | Containment |
|---|---|
| Scope too large to finish | Milestone exit tests; submission gate after M3; cut order in §3 |
| Free plan costs exceed revenue | Plan limits, file caps, small AI credits, monthly cost-per-free-merchant review |
| Review rejection | Full-journey rehearsal; optional scopes; only required webhooks |
| Demand unproven | Run 10+ merchant conversations **during M0–M3** (installers of your other app, Shopify Community threads, r/shopify, migration agencies); decide at ~20 real installs using the activation funnel |
| Support burden from free users | In-app docs, templates, status page, a support macro library |
| Legal exposure on warranty wording | Merchant-owned terms; disclaimer; lawyer review of defaults |
| Third-party dependence (SMS, WhatsApp, ERP) | Connector framework first; add each connector only against real merchant demand; usage-bill messaging; consent handling built in |
| Super Admin is a high-value attack target | Separate deployment, passkeys/2FA, IP allowlist, least-privilege roles, full audit log, masked PII by default |
| Scope growth from pulling in all of Phase 3 | Same milestone exit tests; submission gate after M3; contingency cut order in §3 |

---

## 11. Definition of done for 1.0

A merchant can:

1. Install, connect, and onboard in minutes; uninstall/reinstall cleanly with privacy webhooks handled.
2. Create versioned warranty rules with precedence, start-date options and serial modes.
3. Get per-unit warranties created automatically, with historical backfill.
4. Let customers register products (form, QR) and verify serials.
5. Give customers a portal (logged in or guest) with certificate (online + PDF).
6. Receive claims with secure attachments and automatic, non-blocking eligibility results.
7. Manage claims with notes, assignment, custom statuses, and an audit trail.
8. Resolve claims via repair, replacement (draft order), or refund.
9. Send configurable email notifications and expiry reminders.
10. See analytics including failure rates by product, variant and supplier.
11. Use the AI assistant (suggest-only) within plan credits.
12. Import/export CSV and run bulk actions.
13. Use Flow triggers/actions and QR/support pages.
14. Subscribe, upgrade, downgrade, and stay within enforced limits on Free and paid plans.
15. Give technicians a portal, track parts stock, and run repairs across multiple locations.
16. Connect through the public API and outbound webhooks, and sync with accounting/ERP connectors.
17. Notify customers by SMS/WhatsApp with consent handling.
18. Manage multiple stores from one organization (Enterprise).
19. Share claims with suppliers through the supplier portal and track recovery.

The platform operator can:

1. Monitor installs, MRR, activation, usage and costs from the Super Admin Dashboard.
2. Diagnose a failing shop (jobs, webhooks, backfill) and fix it without touching the database.
3. Change plans, limits and feature flags, and publish announcements.
4. Support merchants through audited, read-only view-as-merchant sessions.
5. Complete and prove privacy requests (data request, customer redact, shop redact).
