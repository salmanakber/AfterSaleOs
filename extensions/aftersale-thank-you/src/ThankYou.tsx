import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

/**
 * Thank-you page: sync order → warranties via Admin API (no PCD webhook required)
 * + deep-link to portal with email when available.
 */
export default async function extension() {
  render(<ThankYouRegister />, document.body);
}

type OrderHint = {
  id?: string;
  name?: string;
  email?: string;
};

function readOrderHint(): OrderHint {
  const api = shopify as typeof shopify & {
    orderConfirmation?: {
      order?: { id?: string; name?: string; email?: string };
      number?: string;
    };
    order?: { id?: string | number; name?: string; email?: string; confirmationNumber?: string };
  };

  const conf = api.orderConfirmation?.order;
  if (conf?.id || conf?.name) {
    return {
      id: conf.id ? String(conf.id) : undefined,
      name: conf.name || api.orderConfirmation?.number,
      email: conf.email,
    };
  }

  const order = api.order;
  if (order) {
    return {
      id: order.id != null ? String(order.id) : undefined,
      name: order.name || order.confirmationNumber,
      email: order.email,
    };
  }

  return {};
}

function ThankYouRegister() {
  const shopDomain = shopify.shop.myshopifyDomain;
  const [status, setStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const [portalUrl, setPortalUrl] = useState(
    `https://aftersale.tidyflowapp.com/apps/aftersale/portal?shop=${encodeURIComponent(shopDomain)}`,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hint = readOrderHint();
      const qs = new URLSearchParams({ shop: shopDomain });
      if (hint.email) qs.set("email", hint.email);
      if (hint.name) qs.set("order", hint.name);
      setPortalUrl(`https://aftersale.tidyflowapp.com/apps/aftersale/portal?${qs.toString()}`);

      if (!hint.id && !hint.name) {
        setStatus("idle");
        return;
      }

      setStatus("syncing");
      try {
        const res = await fetch("https://aftersale.tidyflowapp.com/api/public/checkout-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            shop: shopDomain,
            orderId: hint.id,
            orderName: hint.name,
            email: hint.email,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; portalUrl?: string };
        if (cancelled) return;
        if (json.portalUrl) setPortalUrl(json.portalUrl);
        setStatus(res.ok && json.ok ? "ok" : "error");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopDomain]);

  return (
    <s-banner
      heading={status === "ok" ? "Warranty registration started" : "Your product warranty"}
      tone={status === "error" ? "warning" : "info"}
    >
      <s-stack direction="block" gap="base">
        <s-text>
          {status === "syncing"
            ? "Registering your purchase for warranty coverage…"
            : status === "ok"
              ? "Coverage is being set up for this order. Open your warranty portal anytime."
              : "Protect your purchase — open your warranty portal to view coverage or register products."}
        </s-text>
        <s-button href={portalUrl} target="_blank">
          Open warranty portal
        </s-button>
      </s-stack>
    </s-banner>
  );
}
