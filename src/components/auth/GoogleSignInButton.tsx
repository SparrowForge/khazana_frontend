"use client";
import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID } from "@/app/login/server";

/** The slice of Google Identity Services this component uses. GIS attaches
 *  itself to `window.google` once its script loads. */
interface GoogleIdApi {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdApi;
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

/** Loads the GIS script once per page, no matter how many buttons mount. */
function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google script failed to load")));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google script failed to load"));
    document.head.appendChild(script);
  });
}

/**
 * Google's own rendered sign-in button.
 *
 * Google requires ITS button markup — a hand-rolled one can't produce a
 * credential — so this hosts the iframe GIS renders and simply forwards the ID
 * token upward. Renders nothing at all when no client id is configured, so a
 * deployment without Google set up shows a normal password-only form rather
 * than a button that can't work.
 */
export default function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // The callback is held in a ref so re-renders never re-initialise GIS.
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !hostRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => callbackRef.current(response.credential),
        });
        window.google.accounts.id.renderButton(hostRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "center",
          // GIS renders at a FIXED pixel width, so a hardcoded 320 pokes out of
          // the sign-in card on a narrow phone. Measure the slot instead and
          // stay inside GIS's own 200-400 range.
          width: Math.max(200, Math.min(400, hostRef.current.clientWidth || 320)),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  if (failed) {
    return (
      <p className="text-xs text-gray-400 text-center">
        Google sign-in is unavailable right now — please use your username and password.
      </p>
    );
  }

  return (
    <div className={disabled ? "pointer-events-none opacity-50" : ""}>
      {/* GIS replaces this node's contents with its own iframe. */}
      <div ref={hostRef} className="flex justify-center [&>div]:!w-full" />
    </div>
  );
}
