"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildCompareRows,
  formatMoney,
  formatQuota,
  formatRules,
  formatSeats,
  isFeaturedPlan,
  planBlurb,
  planCta,
  planFeatureBullets,
  type PublicPlan,
} from "@/lib/marketing-plans";

const CONTACT_EMAIL = "tidyflaw@gmail.com";

const FAQS = [
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrade or downgrade anytime from Plans inside the Shopify Admin app. Limits apply from the moment the new plan is active.",
  },
  {
    q: "How does billing work?",
    a: "Paid plans use Shopify Billing. Charges appear on your Shopify invoice. Test charges may be used during Partner review — production installs bill normally once live.",
  },
  {
    q: "What happens if I hit a monthly limit?",
    a: "Customer registration and claim forms pause with a clear upgrade message until the next month or you move to a higher plan.",
  },
];

export default function PricingPage() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/public/plans")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load plans");
        return json as { plans: PublicPlan[] };
      })
      .then((json) => {
        if (!cancelled) {
          setPlans(json.plans ?? []);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load plans");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = useMemo(
    () => plans.find((p) => isFeaturedPlan(p, plans)) ?? null,
    [plans],
  );

  const compareRows = useMemo(() => buildCompareRows(plans), [plans]);

  const hasHighClaims = plans.some((p) => p.claimsPerMonth >= 99999);

  return (
    <div className="min-h-screen bg-[var(--mk-canvas)] text-[var(--mk-ink)] selection:bg-teal-100 selection:text-teal-950">
      <header className="mk-nav">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/welcome" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl object-cover shadow-sm"
            />
            <div className="leading-tight">
              <span className="mk-display block text-lg font-semibold tracking-tight">AfterSale OS</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--mk-muted)]">
                Pricing
              </span>
            </div>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--mk-muted)] md:flex">
            <Link href="/welcome#product" className="hover:text-[var(--mk-ink)]">
              Product
            </Link>
            <Link href="/pricing" className="text-[var(--mk-ink)]">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-[var(--mk-ink)]">
              Privacy
            </Link>
          </nav>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=AfterSale%20OS%20pricing`}
            className="inline-flex items-center rounded-xl bg-[var(--mk-ink)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--mk-accent)]"
          >
            Talk to sales
          </a>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[var(--mk-line)]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(900px 320px at 10% -10%, rgba(15,118,110,0.14), transparent 55%), radial-gradient(700px 280px at 90% 0%, rgba(12,18,34,0.08), transparent 50%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-16 sm:px-6 sm:pt-20">
            <p className="mk-fade-up text-xs font-bold uppercase tracking-[0.18em] text-[var(--mk-accent)]">
              Live from your AfterSale plans
            </p>
            <h1 className="mk-display mk-fade-up-delay mt-3 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Plans that scale with your aftercare volume.
            </h1>
            <p className="mk-fade-up-delay-2 mt-4 max-w-2xl text-base leading-relaxed text-[var(--mk-muted)] sm:text-lg">
              Prices and limits update from the same database Super Admin edits — so marketing and in-app billing stay
              aligned.
            </p>
            {featured ? (
              <p className="mk-fade-up-delay-2 mt-6 text-sm font-semibold text-[var(--mk-ink)]">
                Most merchants choose <span className="text-[var(--mk-accent)]">{featured.name}</span> when claims and
                repairs become daily work.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mk-price-grid" aria-busy="true" aria-label="Loading plans">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="mk-price-card mk-price-card--skel">
                  <div className="mk-skel" style={{ height: 28, width: "45%" }} />
                  <div className="mk-skel" style={{ height: 48, width: "40%", marginTop: 20 }} />
                  <div className="mk-skel" style={{ height: 90, width: "100%", marginTop: 20 }} />
                  <div className="mk-skel" style={{ height: 120, width: "100%", marginTop: 16 }} />
                </div>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <p className="text-center text-[var(--mk-muted)]">No plans are published yet.</p>
          ) : (
            <div className="mk-price-grid">
              {plans.map((plan, index) => {
                const featuredCard = isFeaturedPlan(plan, plans);
                const previous = index > 0 ? plans[index - 1] : null;
                const bullets = planFeatureBullets(plan, previous);
                return (
                  <article
                    key={plan.id}
                    className={`mk-price-card${featuredCard ? " mk-price-card--featured" : ""}`}
                    style={{ animationDelay: `${index * 0.06}s` }}
                  >
                    {featuredCard ? <span className="mk-price-badge">Most popular</span> : null}
                    <header>
                      <h2 className="mk-display text-2xl font-semibold tracking-tight">{plan.name}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">{planBlurb(plan)}</p>
                    </header>
                    <div className="mt-6 flex items-end gap-1">
                      <span className="mk-display text-4xl font-semibold tracking-tight">
                        {formatMoney(plan.priceMonthlyCents)}
                      </span>
                      <span className="pb-1 text-sm text-[var(--mk-muted)]">
                        {plan.isFree || plan.priceMonthlyCents === 0 ? "forever" : "/ month"}
                      </span>
                    </div>
                    <div className="mk-price-meters">
                      <div>
                        <em>Warranties</em>
                        <strong>{formatQuota(plan.warrantiesPerMonth)} / mo</strong>
                      </div>
                      <div>
                        <em>Claims</em>
                        <strong>{formatQuota(plan.claimsPerMonth, 99999)} / mo</strong>
                      </div>
                      <div>
                        <em>Rules</em>
                        <strong>{formatRules(plan.warrantyRulesLimit)}</strong>
                      </div>
                      <div>
                        <em>Seats</em>
                        <strong>{formatSeats(plan.staffSeats)}</strong>
                      </div>
                    </div>
                    <ul className="mk-price-list">
                      {bullets.map((f) => (
                        <li key={f}>
                          <span aria-hidden>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`AfterSale OS — ${plan.name} plan`)}`}
                      className={`mk-price-cta${featuredCard ? " mk-price-cta--primary" : ""}`}
                    >
                      {planCta(plan)}
                    </a>
                  </article>
                );
              })}
            </div>
          )}
          {hasHighClaims ? (
            <p className="mt-6 text-center text-xs text-[var(--mk-muted)]">
              *High claim limits are treated as unlimited for normal merchant volume. Quotas reset each billing month.
            </p>
          ) : (
            <p className="mt-6 text-center text-xs text-[var(--mk-muted)]">
              Limits come from your live plan settings and reset each billing month.
            </p>
          )}
        </section>

        <section className="border-y border-[var(--mk-line)] bg-[var(--mk-surface)] py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mk-accent)]">Compare</p>
              <h2 className="mk-display mt-2 text-3xl font-semibold tracking-tight">Eight things that matter most</h2>
              <p className="mt-3 text-[var(--mk-muted)]">
                Built from the same plan flags Super Admin controls — marketing and merchant app stay in sync.
              </p>
            </div>

            {loading ? (
              <div className="mt-10 h-64 animate-pulse rounded-20 bg-slate-100" />
            ) : plans.length > 0 ? (
              <div className="mk-compare mt-10 overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Feature</th>
                      {plans.map((p) => (
                        <th
                          key={p.id}
                          scope="col"
                          data-featured={isFeaturedPlan(p, plans) ? "true" : "false"}
                        >
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        {plans.map((p) => {
                          const v = row.cell(p);
                          return (
                            <td
                              key={p.id}
                              data-featured={isFeaturedPlan(p, plans) ? "true" : "false"}
                            >
                              {typeof v === "boolean" ? (
                                v ? (
                                  <span className="mk-yes">Included</span>
                                ) : (
                                  <span className="mk-no">—</span>
                                )
                              ) : (
                                <span className="mk-val">{v}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="mk-display text-center text-3xl font-semibold tracking-tight">Pricing questions</h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((faq, idx) => (
              <button
                key={faq.q}
                type="button"
                className="w-full rounded-2xl border border-[var(--mk-line)] bg-[var(--mk-surface)] p-5 text-left transition hover:border-teal-700/30"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-semibold">{faq.q}</span>
                  <span className="text-[var(--mk-muted)]">{openFaq === idx ? "−" : "+"}</span>
                </div>
                {openFaq === idx ? (
                  <p className="mt-3 border-t border-[var(--mk-line)] pt-3 text-sm leading-relaxed text-[var(--mk-muted)]">
                    {faq.a}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="overflow-hidden rounded-[32px] bg-[#0f172a] px-8 py-12 text-white sm:px-12">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">Ready when you are</p>
                <h2 className="mk-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Install from Shopify, pick a plan in minutes.
                </h2>
                <p className="mt-4 max-w-xl text-white/70">
                  Need help choosing? Tell us your monthly order volume and whether you need repairs or QR packaging —
                  we’ll recommend a plan.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=AfterSale%20OS%20plan%20advice`}
                  className="inline-flex justify-center rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[var(--mk-ink)]"
                >
                  Email {CONTACT_EMAIL}
                </a>
                <Link
                  href="/welcome"
                  className="inline-flex justify-center rounded-xl border border-white/25 px-6 py-3.5 text-sm font-semibold text-white"
                >
                  Back to product
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--mk-line)] bg-[var(--mk-surface)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 text-sm text-[var(--mk-muted)] sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="" className="h-7 w-7 rounded-lg object-cover" />
            <strong className="text-[var(--mk-ink)]">AfterSale OS</strong>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm font-medium">
            <Link href="/welcome" className="hover:text-[var(--mk-accent)]">
              Home
            </Link>
            <Link href="/pricing" className="hover:text-[var(--mk-accent)]">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-[var(--mk-accent)]">
              Privacy
            </Link>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} AfterSale</p>
        </div>
      </footer>
    </div>
  );
}
