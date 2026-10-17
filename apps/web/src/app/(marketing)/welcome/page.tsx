const CONTACT_EMAIL = "tidyflaw@gmail.com";

const SERVICES = [
  {
    title: "Product registration",
    body: "Customers activate coverage from your catalog or their orders — searchable, branded, and mobile-ready.",
  },
  {
    title: "Warranty engine",
    body: "Rules by product, duration, and serial mode. Coverage starts automatically or when shoppers opt in at checkout.",
  },
  {
    title: "Client portal",
    body: "One desk for activate, registered products, file a claim, and track requests — with your logo and colors.",
  },
  {
    title: "Claims & resolutions",
    body: "Structured claim intake, staff workflow, status emails, and clear paths to refund, replace, or repair.",
  },
  {
    title: "Certificates",
    body: "Shareable warranty certificates customers can open anytime — proof of coverage that builds trust.",
  },
  {
    title: "Storefront embeds",
    body: "Theme blocks for portal, register, claim, and checkout opt-in — width, columns, and style you control.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Connect Shopify",
    body: "Install AfterSale OS, set your brand kit, and place portal or opt-in blocks on the storefront.",
  },
  {
    n: "02",
    title: "Define coverage",
    body: "Create warranty rules for products and collections. Optional registration fee at checkout or in the portal.",
  },
  {
    n: "03",
    title: "Serve & resolve",
    body: "Customers self-serve in the portal. Your team manages claims, notes, and resolutions from one admin.",
  },
];

export default function WelcomePage() {
  return (
    <div className="mkt">
      <div className="mkt-atmosphere" aria-hidden>
        <span className="mkt-orb mkt-orb--a" />
        <span className="mkt-orb mkt-orb--b" />
        <span className="mkt-grain" />
      </div>

      <header className="mkt-nav">
        <a className="mkt-brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="" width={36} height={36} />
          <span>AfterSale</span>
        </a>
        <nav className="mkt-nav__links" aria-label="Page">
          <a href="#services">Services</a>
          <a href="#how">How it works</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="mkt-nav__cta" href={`mailto:${CONTACT_EMAIL}`}>
          Talk to us
        </a>
      </header>

      <main>
        <section className="mkt-hero">
          <div className="mkt-hero__plane">
            <p className="mkt-hero__brand">AfterSale</p>
            <h1>Warranty care that feels like your brand.</h1>
            <p className="mkt-hero__lede">
              Register products, run coverage, and resolve claims in one Shopify-native system —
              with a client portal customers actually want to use.
            </p>
            <div className="mkt-hero__actions">
              <a className="mkt-btn mkt-btn--primary" href={`mailto:${CONTACT_EMAIL}?subject=AfterSale%20OS%20demo`}>
                Request a demo
              </a>
              <a className="mkt-btn mkt-btn--ghost" href="#services">
                See what you get
              </a>
            </div>
          </div>
          <div className="mkt-hero__visual" aria-hidden>
            <div className="mkt-hero__card mkt-hero__card--portal">
              <span>Client portal</span>
              <strong>Activate · Products · Claims</strong>
              <em>Branded for your store</em>
            </div>
            <div className="mkt-hero__card mkt-hero__card--cert">
              <span>Certificate</span>
              <strong>Coverage confirmed</strong>
            </div>
          </div>
        </section>

        <section className="mkt-strip" aria-label="Highlights">
          <p>Shopify-native</p>
          <p>Branded portal</p>
          <p>Checkout opt-in</p>
          <p>Claims workflow</p>
        </section>

        <section className="mkt-section" id="services">
          <header className="mkt-section__head">
            <p className="mkt-eyebrow">Services</p>
            <h2>Everything after the sale, in one OS.</h2>
            <p>
              AfterSale OS replaces scattered forms and inboxes with a single warranty stack — from
              registration through claim resolution.
            </p>
          </header>
          <div className="mkt-grid">
            {SERVICES.map((s) => (
              <article key={s.title} className="mkt-card">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mkt-section mkt-section--alt" id="how">
          <header className="mkt-section__head">
            <p className="mkt-eyebrow">How it works</p>
            <h2>Live in days, not months.</h2>
            <p>Three steps from install to a branded care experience on your storefront.</p>
          </header>
          <ol className="mkt-steps">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="mkt-steps__n">{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mkt-section">
          <header className="mkt-section__head">
            <p className="mkt-eyebrow">Built for merchants</p>
            <h2>Admin that stays out of the way.</h2>
          </header>
          <div className="mkt-split">
            <ul className="mkt-bullets">
              <li>Warranty rules, registrations, and claim queues inside Shopify Admin</li>
              <li>Portal color kit — buttons, backgrounds, text, and logo your customers see</li>
              <li>Optional warranty fee at checkout or pay-to-activate in the portal</li>
              <li>Google, Shopify, or email login for customers — your choice</li>
              <li>Theme embeds for portal, register, claim, and product-page opt-in</li>
            </ul>
            <aside className="mkt-aside">
              <p className="mkt-aside__kicker">Who it’s for</p>
              <p>
                DTC brands that sell durable goods and want post-purchase trust without bolting on
                five tools.
              </p>
            </aside>
          </div>
        </section>

        <section className="mkt-cta" id="contact">
          <p className="mkt-eyebrow">Contact</p>
          <h2>Let’s put AfterSale on your store.</h2>
          <p>
            Tell us about your catalog and warranty needs. We’ll walk you through install, branding,
            and go-live.
          </p>
          <a className="mkt-btn mkt-btn--primary mkt-btn--lg" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          <p className="mkt-cta__note">We usually reply within one business day.</p>
        </section>
      </main>

      <footer className="mkt-foot">
        <div className="mkt-foot__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="" width={28} height={28} />
          <strong>AfterSale OS</strong>
        </div>
        <p>© {new Date().getFullYear()} AfterSale · A Tidyflow product</p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </footer>
    </div>
  );
}
