export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** Matches `[data-tour="..."]` on the page. Omit for centered card. */
  target?: string;
  /** Optional tab/section hint for pages that switch UI */
  tab?: string;
};

export type TourDefinition = {
  id: string;
  title: string;
  steps: TourStep[];
};

export const TOURS: Record<string, TourDefinition> = {
  welcome: {
    id: "welcome",
    title: "Welcome tour",
    steps: [
      {
        id: "hello",
        title: "Welcome to AfterSale OS",
        body: "This short tour shows how warranties, claims, and customer pages fit together — then you can explore at your own pace.",
      },
      {
        id: "nav",
        title: "Your workspace",
        body: "Use the sidebar for day-to-day work: Claims and Warranties for operations, Products & Rules for coverage, and Setup for automations, QR, team, and customer pages.",
        target: "sidebar",
      },
      {
        id: "setup",
        title: "Finish setup first",
        body: "Complete these checklist items before go-live: pick a plan, create a default warranty rule, and publish customer entry points.",
        target: "setup-checklist",
      },
      {
        id: "customers",
        title: "How customers reach you",
        body: "Customer pages is where branding, share links, Shopify theme blocks (Liquid), and embed codes live. Take the Customer pages tour next.",
        target: "hero-customer-pages",
      },
    ],
  },
  "customer-pages": {
    id: "customer-pages",
    title: "Customer pages tour",
    steps: [
      {
        id: "three-ways",
        title: "Three ways to go live",
        body: "Share a hosted link, add Shopify theme blocks (Liquid) in the Online Store editor, or paste an iframe embed into any page. Same customer flows — different placement.",
        target: "cx-ways",
      },
      {
        id: "liquid",
        title: "Shopify theme blocks (Liquid)",
        body: "After shopify app deploy, open Online Store → Customize → Add section → Apps. Choose AfterSale register, claim, lookup, or the embed variants. Blocks sit inside your theme like any section.",
        target: "cx-liquid",
        tab: "share",
      },
      {
        id: "embed",
        title: "Embed iframe",
        body: "Copy an iframe snippet for help centers, landing pages, or custom HTML sections. embed=1 uses a compact layout without the full marketing chrome.",
        target: "cx-embed",
        tab: "embed",
      },
      {
        id: "brand",
        title: "Brand once",
        body: "Upload a logo and set an accent color. Hosted pages, embeds, and PDF certificates pick this up automatically.",
        target: "cx-brand",
        tab: "brand",
      },
      {
        id: "preview",
        title: "Preview before you publish",
        body: "Live preview loads the real customer experience with your branding. Open in a new tab when you want to test outside the admin iframe.",
        target: "cx-preview",
        tab: "preview",
      },
    ],
  },
  rules: {
    id: "rules",
    title: "Products & rules tour",
    steps: [
      {
        id: "rules-intro",
        title: "Coverage starts with a rule",
        body: "A default rule decides duration, start date, serial requirements, and terms for products that don’t have a more specific assignment.",
        target: "rules-panel",
      },
      {
        id: "serials",
        title: "Serial lists (optional)",
        body: "When serial mode is “Validated against list”, create a list, import serials, then link that list to the rule so registrations check the right inventory.",
        target: "serials-panel",
      },
    ],
  },
  qr: {
    id: "qr",
    title: "QR codes tour",
    steps: [
      {
        id: "qr-intro",
        title: "Short links for packaging",
        body: "Create a QR link, copy the short URL, and encode it with any QR generator. Scans open product registration on your storefront with tracking.",
        target: "qr-panel",
      },
    ],
  },
  automations: {
    id: "automations",
    title: "Automations tour",
    steps: [
      {
        id: "workflow",
        title: "Claim workflow",
        body: "Statuses and transitions control how claims move. Rename labels for your team language, then customize the email template for each status.",
        target: "automations-statuses",
      },
    ],
  },
};

const STORAGE_KEY = "aftersale.tours.v1";

type TourState = {
  completed: string[];
  skippedWelcome: boolean;
};

function readState(): TourState {
  if (typeof window === "undefined") return { completed: [], skippedWelcome: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: [], skippedWelcome: false };
    const parsed = JSON.parse(raw) as TourState;
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      skippedWelcome: Boolean(parsed.skippedWelcome),
    };
  } catch {
    return { completed: [], skippedWelcome: false };
  }
}

function writeState(state: TourState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isTourCompleted(tourId: string) {
  return readState().completed.includes(tourId);
}

export function markTourCompleted(tourId: string) {
  const state = readState();
  if (!state.completed.includes(tourId)) {
    state.completed.push(tourId);
    writeState(state);
  }
}

export function shouldAutoStartWelcome() {
  const state = readState();
  return !state.completed.includes("welcome") && !state.skippedWelcome;
}

export function skipWelcomeTour() {
  const state = readState();
  state.skippedWelcome = true;
  writeState(state);
}

export function resetTours() {
  localStorage.removeItem(STORAGE_KEY);
}
