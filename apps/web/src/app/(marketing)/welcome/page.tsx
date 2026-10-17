"use client";

import React, { useState } from "react";

const CONTACT_EMAIL = "tidyflaw@gmail.com";

const SERVICES = [
  {
    icon: (
      <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    tag: "Instant Sync",
    title: "Product registration",
    body: "Customers activate coverage directly from their Shopify orders or receipt upload — fast, searchable, and responsive.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    tag: "Automated",
    title: "Warranty engine",
    body: "Create custom rule tiers by SKU, duration, and serial number. Trigger coverage on purchase or via checkout upsell.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    tag: "Self-Service",
    title: "Branded client portal",
    body: "A unified self-service desk matching your store's exact palette, fonts, and logo. Reduce support tickets by 60%.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    tag: "Fast Track",
    title: "Claims & resolutions",
    body: "Structured claim intake with photo evidence. One-click workflows to approve refunds, replacements, or repairs.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    tag: "Proof of Care",
    title: "Digital certificates",
    body: "Give customers dynamic, downloadable certificates with verifiable QR codes that reinforce trust post-purchase.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
      </svg>
    ),
    tag: "Zero Code",
    title: "Shopify theme app embeds",
    body: "Drag-and-drop widgets straight into Online Store 2.0. Native checkout extensions, account page blocks, and cart upsells.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "1-Click Shopify install",
    subtitle: "Ready in 2 minutes",
    body: "Connect AfterSale OS to your Shopify store. Configure your brand colors, upload your logo, and turn on the portal theme block.",
  },
  {
    n: "02",
    title: "Define rules & coverage",
    subtitle: "Custom warranty logic",
    body: "Set default manufacturer warranties (e.g., 1-year included) or add paid extended warranty add-ons to checkout.",
  },
  {
    n: "03",
    title: "Automate & delight",
    subtitle: "Zero inbox chaos",
    body: "Shoppers register items and submit claims through their portal. Your staff handles approvals and shipping labels in seconds.",
  },
];

const FAQS = [
  {
    q: "Does this require code edits in my Shopify theme?",
    a: "No! AfterSale OS uses modern Shopify Online Store 2.0 Theme App Extensions. You can drag and position portal embeds visually inside the theme customizer without touching liquid code.",
  },
  {
    q: "Can I charge customers for extended warranty coverage?",
    a: "Yes. You can offer complimentary registration or upsell paid extended protection plans directly in cart, at checkout, or within the post-purchase portal.",
  },
  {
    q: "How do customers access their warranty portal?",
    a: "Customers can access it directly via your store navigation, a dedicated page (e.g. yourstore.com/pages/warranty), or through an automated post-purchase email invitation.",
  },
];

export default function WelcomePage() {
  const [activeTab, setActiveTab] = useState<"portal" | "cert" | "claims">("portal");
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(CONTACT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAFBFD] text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 relative overflow-hidden">
      {/* Subtle Background Glows (Light & Fresh) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[550px] pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-32 left-1/4 w-[480px] h-[480px] bg-indigo-200/40 rounded-full blur-3xl opacity-70 animate-pulse" />
        <div className="absolute -top-20 right-1/4 w-[420px] h-[420px] bg-emerald-200/40 rounded-full blur-3xl opacity-60" />
        <div className="absolute top-48 left-1/3 w-[350px] h-[350px] bg-amber-100/50 rounded-full blur-3xl opacity-50" />
      </div>

      {/* Floating Header */}
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="backdrop-blur-md bg-white/80 border border-slate-200/80 shadow-sm rounded-2xl px-5 py-3.5 flex items-center justify-between transition-all">
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white font-bold text-lg">
              A
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 tracking-tight text-lg leading-tight flex items-center gap-1.5">
                AfterSale <span className="text-[10px] uppercase tracking-wider font-extrabold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200/60">OS</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Shopify App</span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#interactive-preview" className="hover:text-indigo-600 transition-colors">Interactive Demo</a>
            <a href="#how" className="hover:text-indigo-600 transition-colors">How it works</a>
            <a href="#faq" className="hover:text-indigo-600 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyEmail}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-200/70"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy email</span>
                </>
              )}
            </button>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=AfterSale%20OS%20Early%20Access`}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-indigo-600 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm hover:shadow-indigo-500/25 transition-all duration-200"
            >
              <span>Get Access</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 max-w-6xl mx-auto text-center">
        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-indigo-100 shadow-sm shadow-indigo-100/50 mb-6 text-xs font-semibold text-slate-700">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-indigo-600 font-bold">Shopify App OS 2.0</span>
          <span className="text-slate-300">•</span>
          <span>Warranty & Claims Infrastructure</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.12]">
          Warranty care that turns <br className="hidden sm:block" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600">
            one-time buyers into loyal advocates.
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
          Register products, issue verifiable digital warranty certificates, and handle claims with automated self-service. All right inside your Shopify store.
        </p>

        {/* Hero Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Book%20AfterSale%20Demo`}
            className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all text-sm sm:text-base flex items-center gap-2"
          >
            <span>Request merchant demo</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
          <a
            href="#interactive-preview"
            className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200/90 shadow-sm hover:-translate-y-0.5 transition-all text-sm sm:text-base"
          >
            Explore live preview
          </a>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
            No theme coding required
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
            Works with Shopify & Plus
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
            100% Brand Customizable
          </span>
        </div>
      </section>

      {/* Interactive App Preview Showcase */}
      <section id="interactive-preview" className="py-12 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl shadow-indigo-100/60 overflow-hidden">
          {/* Top Mock Window Bar */}
          <div className="bg-slate-50/90 border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
              <span className="ml-3 text-xs font-mono text-slate-400 hidden sm:inline">
                https://yourbrand.myshopify.com/apps/aftersale
              </span>
            </div>

            {/* Interactive Switcher Tabs */}
            <div className="flex bg-slate-200/60 p-1 rounded-xl text-xs font-medium text-slate-600">
              <button
                onClick={() => setActiveTab("portal")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "portal" ? "bg-white text-indigo-600 font-bold shadow-sm" : "hover:text-slate-900"
                }`}
              >
                1. Customer Portal
              </button>
              <button
                onClick={() => setActiveTab("cert")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "cert" ? "bg-white text-indigo-600 font-bold shadow-sm" : "hover:text-slate-900"
                }`}
              >
                2. Live Certificate
              </button>
              <button
                onClick={() => setActiveTab("claims")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "claims" ? "bg-white text-indigo-600 font-bold shadow-sm" : "hover:text-slate-900"
                }`}
              >
                3. Claims Desk
              </button>
            </div>
          </div>

          {/* Interactive Screen Content */}
          <div className="p-6 sm:p-10 bg-gradient-to-b from-white to-slate-50/50 min-h-[420px] flex items-center justify-center">
            {activeTab === "portal" && (
              <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                      K
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Kinectic Goods Portal</h4>
                      <p className="text-xs text-slate-500">Logged in as alex@example.com</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200/60">
                    2 Active Coverages
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Serial #KG-9921-X</span>
                      <h5 className="font-bold text-slate-800 text-sm">Nordic Ergonomic Chair V2</h5>
                      <p className="text-xs text-slate-500">Coverage valid until Oct 2026</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveTab("cert")} className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-semibold rounded-lg hover:border-indigo-400">
                        View Certificate
                      </button>
                      <button onClick={() => setActiveTab("claims")} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700">
                        File Claim
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order #1042</span>
                      <h5 className="font-bold text-slate-800 text-sm">Desk Lamp Lumina Pro</h5>
                      <p className="text-xs text-slate-500">Unregistered purchase</p>
                    </div>
                    <button className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">
                      + Activate Warranty
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "cert" && (
              <div className="w-full max-w-lg bg-white rounded-2xl border-2 border-indigo-100 p-8 shadow-lg relative animate-fadeIn">
                <div className="absolute top-4 right-4 text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  VERIFIED • ACTIVE
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">Warranty Certificate</h4>
                    <p className="text-xs text-slate-400">Official Authenticity Guarantee</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-dashed border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Product</span>
                    <strong className="text-slate-800 text-sm">Nordic Ergonomic Chair</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Policy Tier</span>
                    <strong className="text-indigo-600 text-sm">3-Year Full Care</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Covered Since</span>
                    <strong className="text-slate-800">Oct 14, 2023</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Expires</span>
                    <strong className="text-slate-800">Oct 14, 2026</strong>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                  <span>Powered by AfterSale OS</span>
                  <span className="font-mono text-[11px] text-slate-400">SHA-256 Verified</span>
                </div>
              </div>
            )}

            {activeTab === "claims" && (
              <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Claim #CLM-4019</span>
                    <h4 className="font-bold text-slate-900 text-base">Hydraulic Cylinder Issue</h4>
                  </div>
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200">
                    Under Review
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl text-xs text-slate-600 mb-4">
                  &ldquo;The height adjustment slips down after ~15 minutes of seating. Uploaded photo of bottom lever.&rdquo;
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold">
                    Approve Replacement
                  </button>
                  <button className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">
                    Request Extra Photos
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Services / Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            Comprehensive Suite
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Everything after the sale, in one unified OS.
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Replace messy spreadsheets, manual email threads, and multiple clunky plugins with a single Shopify-native workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="group p-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-indigo-50/50 transition-colors">
                    {s.icon}
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                    {s.tag}
                  </span>
                </div>
                <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {s.title}
                </h3>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed font-normal">
                  {s.body}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                <span>Learn more</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works (3 Steps) */}
      <section id="how" className="py-20 bg-gradient-to-b from-white via-indigo-50/30 to-white border-y border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              Fast Integration
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Go live in days, not months.
            </h2>
            <p className="mt-3 text-slate-600 text-base">
              A frictionless onboarding experience engineered specifically for busy Shopify merchants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {STEPS.map((step) => (
              <div key={step.n} className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm relative group hover:border-indigo-300 transition-all">
                <div className="text-4xl font-black text-indigo-600/20 font-mono mb-4 group-hover:text-indigo-600 transition-colors">
                  {step.n}
                </div>
                <span className="text-xs font-bold text-indigo-600 tracking-wide uppercase">
                  {step.subtitle}
                </span>
                <h3 className="mt-1 font-bold text-xl text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Merchant Highlights Split */}
      <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-8 sm:p-14 shadow-xl overflow-hidden relative">
          {/* Subtle decoration inside dark card for contrast highlight */}
          <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-2xl relative z-10">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/10">
              Built Specifically for DTC
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
              An admin dashboard that stays out of your way.
            </h2>
            <p className="mt-3 text-slate-300 text-base">
              Designed for merchants who sell durable items (electronics, furniture, jewelry, gear) and need enterprise-level protection without enterprise complexity.
            </p>

            <ul className="mt-8 space-y-3.5">
              {[
                "Full warranty rule control right inside the native Shopify Admin",
                "Portal customizer: pick button radii, hero text, and brand colors",
                "Monetize with pay-to-activate or optional cart add-on rules",
                "Fast customer login via Shopify Shop Pay, Google, or Magic Link",
              ].map((bullet, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-slate-200 font-medium">
                  <div className="w-5 h-5 rounded-full bg-emerald-400/20 text-emerald-400 flex items-center justify-center shrink-0">
                    ✓
                  </div>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 pt-8 border-t border-white/10 flex flex-wrap items-center gap-4">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=AfterSale%20Consultation`}
                className="px-6 py-3 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold text-sm transition-all"
              >
                Schedule 1-on-1 Setup Call
              </a>
              <span className="text-xs text-slate-400">Response within 24 business hours</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            Got Questions?
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className="border border-slate-200/90 rounded-2xl bg-white p-5 cursor-pointer transition-all hover:border-indigo-300"
              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
            >
              <div className="flex items-center justify-between font-bold text-slate-900 text-base">
                <span>{faq.q}</span>
                <span className="text-slate-400 text-lg">{openFaq === idx ? "−" : "+"}</span>
              </div>
              {openFaq === idx && (
                <p className="mt-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-20 px-4 sm:px-6 max-w-4xl mx-auto text-center">
        <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-b from-indigo-50/60 to-white border border-indigo-100 shadow-xl shadow-indigo-100/40">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
            Ready to upgrade your store?
          </span>
          <h2 className="mt-4 text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Let’s launch AfterSale on your store.
          </h2>
          <p className="mt-4 text-slate-600 max-w-xl mx-auto text-base">
            Tell us about your catalog size and warranty workflow. We’ll personally guide you through install, branding kit configuration, and go-live.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-lg shadow-indigo-500/25 transition-all"
            >
              Contact Us: {CONTACT_EMAIL}
            </a>
            <button
              onClick={handleCopyEmail}
              className="w-full sm:w-auto px-5 py-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base border border-slate-200 transition-all"
            >
              {copied ? "Copied to Clipboard!" : "Copy Email"}
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-400 font-medium">
            Direct developer support • Free onboarding assistance
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
              A
            </div>
            <strong className="text-slate-900 font-semibold">AfterSale OS</strong>
            <span className="text-slate-300">|</span>
            <span>A product by Tidyflow</span>
          </div>

          <div className="flex items-center gap-6 text-xs sm:text-sm font-medium">
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-indigo-600 transition-colors">
              Support ({CONTACT_EMAIL})
            </a>
            <a href="#how" className="hover:text-indigo-600 transition-colors">Documentation</a>
            <a href="#features" className="hover:text-indigo-600 transition-colors">Theme Embeds</a>
          </div>

          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} AfterSale. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}