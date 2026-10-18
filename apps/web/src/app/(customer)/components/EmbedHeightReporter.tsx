"use client";

import { useEffect } from "react";

/**
 * When the portal runs inside a Shopify theme-block iframe, report document
 * height to the parent so the frame can grow instead of scrolling awkwardly.
 */
export function EmbedHeightReporter({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (window.parent === window) return;

    let frame = 0;
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = document.querySelector(".as-customer-root") as HTMLElement | null;
        const shell = document.querySelector(".as-shell") as HTMLElement | null;
        const height = Math.ceil(
          Math.max(
            root?.scrollHeight ?? 0,
            shell?.scrollHeight ?? 0,
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
          ),
        );
        window.parent.postMessage(
          { source: "aftersale", type: "aftersale-embed-height", height: Math.max(420, height + 8) },
          "*",
        );
      });
    };

    report();
    const ro = new ResizeObserver(report);
    ro.observe(document.body);
    if (document.documentElement) ro.observe(document.documentElement);
    window.addEventListener("load", report);
    const interval = window.setInterval(report, 1200);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("load", report);
      window.clearInterval(interval);
    };
  }, [enabled]);

  return null;
}
