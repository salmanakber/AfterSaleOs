"use client";

import { useEffect, useRef, useState } from "react";
import { publicApiUrl } from "@/lib/public-api";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type SessionPayload = {
  email: string;
  orders?: unknown[];
  warranties?: unknown[];
};

/**
 * Google Identity Services button. Renders only when NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * was present at build time.
 */
export function GoogleContinueButton({
  shop,
  onSuccess,
  onError,
  onBusy,
}: {
  shop: string;
  onSuccess: (session: SessionPayload) => void;
  onError?: (message: string) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const cbRef = useRef({ onSuccess, onError, onBusy, shop });
  cbRef.current = { onSuccess, onError, onBusy, shop };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    if (document.getElementById("as-google-gsi")) {
      setReady(true);
      return;
    }
    const s = document.createElement("script");
    s.id = "as-google-gsi";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!ready || !GOOGLE_CLIENT_ID || !hostRef.current || !shop) return;
    const g = (
      window as unknown as {
        google?: {
          accounts: {
            id: {
              initialize: (c: unknown) => void;
              renderButton: (el: HTMLElement, c: unknown) => void;
            };
          };
        };
      }
    ).google;
    if (!g?.accounts?.id) return;

    g.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp: { credential?: string }) => {
        const { shop: s, onSuccess: ok, onError: fail, onBusy: busy } = cbRef.current;
        if (!resp.credential || !s) return;
        busy?.(true);
        try {
          const res = await fetch(publicApiUrl("/api/public/customer-auth/google"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shop: s, credential: resp.credential }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Google sign-in failed");
          ok({
            email: json.email,
            orders: json.orders ?? [],
            warranties: json.warranties ?? [],
          });
        } catch (err) {
          fail?.(err instanceof Error ? err.message : "Google sign-in failed");
        } finally {
          busy?.(false);
        }
      },
    });

    hostRef.current.innerHTML = "";
    g.accounts.id.renderButton(hostRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: Math.min(360, hostRef.current.clientWidth || 320),
    });
  }, [ready, shop]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="as-google-wrap">
      <div ref={hostRef} className="as-google-host" />
    </div>
  );
}

export function isGoogleSignInConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}
