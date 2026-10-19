"use client";

import React, { useState } from "react";
import Link from "next/link";

const CONTACT_EMAIL = "tidyflaw@gmail.com";

const SHOWCASES = [
  {
    id: "dashboard",
    label: "Merchant desk",
    title: "Run warranties from Shopify Admin",
    body: "Home, claims, and coverage meters in one calm workspace — no spreadsheet hop.",
    src: "/marketing/dashboard.png",
  },
  {
    id: "portal",
    label: "Customer portal",
    title: "Branded self-service for buyers",
    body: "Register products, open claims, and download certificates in your store’s look.",
    src: "/marketing/portal.png",
  },
  {
    id: "claims",
    label: "Claims desk",
    title: "Evidence-first claim handling",
    body: "Structured intake, status workflow, and resolution paths your team can trust.",
    src: "/marketing/claims.png",
  },
  {
    id: "coverage",
    label: "Coverage engine",
    title: "Rules that match your catalog",
    body: "Duration, serial checks, and product targeting — editable without a developer.",
    src: "/marketing/coverage.png",
  },
];

const FEATURES = [
  {
    title: "Product registration",
    body: "Customers activate coverage from Shopify orders or catalog search — tracked to the SKU.",
  },
  {
    title: "Warranty rules",
    body: "Default and product-level policies with duration, start date, and serial validation.",
  },
  {
    title: "Claims & repairs",
    body: "Photo evidence, status emails, and repair or replacement workflows in one queue.",
  },
  {
    title: "QR packaging codes",
    body: "Print-ready codes that open activation — no customer login required to start.",
  },
  {
    title: "Theme embeds",
    body: "Online Store 2.0 blocks for portal and claim flows — place them in the theme editor.",
  },
  {
    title: "Digital certificates",
    body: "Shareable proof of coverage with your branding for post-purchase trust.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Install from Shopify",
    body: "Connect AfterSale OS, pick a plan, and sync products. Setup wizard walks branding and placement.",
  },
  {
    n: "02",
    title: "Set coverage rules",
    body: "Create a default warranty, attach serial lists if needed, and decide what customers can self-serve.",
  },
  {
    n: "03",
    title: "Go live on storefront",
    body: "Enable theme blocks or share portal links. Claims and registrations land in your admin desk.",
  },
];

const FAQS = [
  {
    q: "Do I need to edit theme code?",
    a: "No. AfterSale OS uses Online Store 2.0 theme app extensions. Place portal and claim blocks in the theme customizer.",
  },
  {
    q: "Can customers register without creating an account first?",
    a: "Yes. QR scans and guest registration start without a forced login. Completing registration can create a portal login for later visits.",
  },
  {
    q: "Where do staff work day to day?",
    a: "Inside Shopify Admin — claims, warranties, products & rules, automations, QR studio, and team invites all live in the embedded app.",
  },
  {
    q: "How do you handle privacy and data?",
    a: "We process order and customer data needed for warranties and claims under your store’s authority. See our Privacy Policy for details.",
  },
];

export default function WelcomePage() {
  const [active, setActive] = useState("dashboard");
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const activeShow = SHOWCASES.find((s) => s.id === active) ?? SHOWCASES[0]!;

  const handleCopyEmail = () => {
    void navigator.clipboard.writeText(CONTACT_EMAIL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--mk-canvas)] text-[var(--mk-ink)] selection:bg-teal-100 selection:text-teal-950">
      <header className="mk-nav">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <a href="/welcome" className="flex items-center gap-3">
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
                Shopify aftercare
              </span>
            </div>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--mk-muted)] md:flex">
            <a href="#product" className="hover:text-[var(--mk-ink)]">
              Product
            </a>
            <a href="#features" className="hover:text-[var(--mk-ink)]">
              Features
            </a>
            <Link href="/pricing" className="hover:text-[var(--mk-ink)]">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-[var(--mk-ink)]">
              Privacy
            </Link>
          </nav>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=AfterSale%20OS%20demo`}
            className="inline-flex items-center rounded-xl bg-[var(--mk-ink)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--mk-accent)]"
          >
            Request demo
          </a>
        </div>
      </header>

      {/* Full-bleed hero with video */}
      <section className="relative isolate min-h-[88vh] overflow-hidden text-white">
        <video
          className="mk-hero-video"
          autoPlay
          muted
          loop
          playsInline
          poster="/marketing/saas-showcase.png"
          aria-hidden
        >
          <source src="/marketing/hero.mp4" type="video/mp4" />
        </video>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,14,20,0.55) 0%, rgba(10,14,20,0.35) 40%, rgba(10,14,20,0.78) 100%)",
          }}
        />
        <div className="relative z-10 mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 sm:pb-20">
          <p className="mk-fade-up text-xs font-bold uppercase tracking-[0.18em] text-teal-200">AfterSale OS</p>
          <h1 className="mk-display mk-fade-up-delay mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Aftercare that feels like part of your brand.
          </h1>
          <p className="mk-fade-up-delay-2 mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            Warranty registration, claims, QR packaging codes, and a branded customer portal — built for Shopify
            merchants who sell products that need lasting care.
          </p>
          <div className="mk-fade-up-delay-2 mt-8 flex flex-wrap gap-3">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Book%20AfterSale%20demo`}
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-[var(--mk-ink)] transition hover:bg-teal-50"
            >
              Book a merchant demo
            </a>
            <a
              href="#product"
              className="rounded-xl border border-white/30 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              See the product
            </a>
          </div>
        </div>
      </section>

      {/* Product showcase with real screens */}
      <section id="product" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mk-accent)]">Inside the app</p>
          <h2 className="mk-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Real screens from the merchant desk and customer portal.
          </h2>
          <p className="mt-3 text-[var(--mk-muted)]">
            Switch views to explore how AfterSale OS looks in production — admin workflows and the buyer-facing portal.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {SHOWCASES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active === s.id
                  ? "bg-[var(--mk-ink)] text-white"
                  : "bg-white text-[var(--mk-muted)] ring-1 ring-[var(--mk-line)] hover:text-[var(--mk-ink)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="overflow-hidden rounded-[28px] border border-[var(--mk-line)] bg-[#0b1220] shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={activeShow.src}
              src={activeShow.src}
              alt={activeShow.title}
              className="mk-fade-up block h-auto w-full"
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--mk-accent)]">{activeShow.label}</p>
            <h3 className="mk-display mt-2 text-2xl font-semibold tracking-tight">{activeShow.title}</h3>
            <p className="mt-3 text-[var(--mk-muted)] leading-relaxed">{activeShow.body}</p>
            <ul className="mt-6 space-y-2 text-sm text-[var(--mk-ink)]">
              <li className="flex gap-2">
                <span className="text-[var(--mk-accent)]">✓</span> Embedded in Shopify Admin
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--mk-accent)]">✓</span> Brand colors & logo on customer pages
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--mk-accent)]">✓</span> Plan-based feature controls
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marketing/warranty.png"
            alt="Warranty dashboard"
            className="h-auto w-full rounded-3xl border border-[var(--mk-line)] object-cover shadow-sm"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marketing/screens.jpg"
            alt="AfterSale OS screens"
            className="h-auto w-full rounded-3xl border border-[var(--mk-line)] object-cover shadow-sm"
          />
        </div>
      </section>

      <section id="features" className="border-y border-[var(--mk-line)] bg-[var(--mk-surface)] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mk-accent)]">Capabilities</p>
            <h2 className="mk-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything after the sale, in one place.
            </h2>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="mk-display text-xl font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mk-accent)]">Setup</p>
          <h2 className="mk-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Live in days, not months.</h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="border-t border-[var(--mk-ink)] pt-5">
              <span className="font-mono text-sm font-bold text-[var(--mk-accent)]">{s.n}</span>
              <h3 className="mk-display mt-2 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <div className="overflow-hidden rounded-[32px] border border-[var(--mk-line)] bg-[#0f172a] text-white">
          <div className="grid lg:grid-cols-2">
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">For durable goods brands</p>
              <h2 className="mk-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Protect products that are meant to last.
              </h2>
              <p className="mt-4 text-white/70">
                Electronics, furniture, jewelry, outdoor gear — AfterSale OS keeps registration and claims organized
                without bolting on three separate tools.
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-8 inline-flex w-fit rounded-xl bg-white px-5 py-3 text-sm font-bold text-[var(--mk-ink)]"
              >
                Talk to us · {CONTACT_EMAIL}
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/marketing/saas-showcase.png"
              alt="AfterSale OS dashboard showcase"
              className="h-full min-h-[280px] w-full object-cover object-left"
            />
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="mk-display text-center text-3xl font-semibold tracking-tight">Questions</h2>
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
                  {faq.a}{" "}
                  {idx === 3 ? (
                    <Link href="/privacy" className="font-semibold text-[var(--mk-accent)] underline">
                      Read the Privacy Policy
                    </Link>
                  ) : null}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 text-center sm:px-6">
        <h2 className="mk-display text-3xl font-semibold tracking-tight sm:text-5xl">
          Launch AfterSale on your store.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[var(--mk-muted)]">
          Tell us about your catalog and warranty workflow. We’ll help with install, branding, and go-live.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="w-full rounded-xl bg-[var(--mk-accent)] px-8 py-4 text-base font-bold text-white sm:w-auto"
          >
            {CONTACT_EMAIL}
          </a>
          <button
            type="button"
            onClick={handleCopyEmail}
            className="w-full rounded-xl border border-[var(--mk-line)] bg-white px-6 py-4 text-base font-semibold sm:w-auto"
          >
            {copied ? "Copied" : "Copy email"}
          </button>
        </div>
      </section>

      <footer className="border-t border-[var(--mk-line)] bg-[var(--mk-surface)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 text-sm text-[var(--mk-muted)] sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="" className="h-7 w-7 rounded-lg object-cover" />
            <strong className="text-[var(--mk-ink)]">AfterSale OS</strong>
            <span>by Tidyflow</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm font-medium">
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[var(--mk-accent)]">
              Support
            </a>
            <Link href="/pricing" className="hover:text-[var(--mk-accent)]">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-[var(--mk-accent)]">
              Privacy Policy
            </Link>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} AfterSale. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
