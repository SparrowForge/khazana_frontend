"use client";
import { useEffect, useRef } from "react";

/**
 * A one-line "on-hand stock just moved" signal.
 *
 * Screens that price or validate against stock (the credit sale forms, and any
 * other catalogue-driven form later) hold their own copy of the item list. When
 * something books stock elsewhere — a Production Entry from the quick dialog,
 * or the Production Entry page in another tab — that copy is silently stale and
 * the invoice keeps refusing lines that are now coverable.
 *
 * So the mutation announces itself and every open listener re-pulls. Two hops:
 *   • a window CustomEvent, for listeners in the same document; and
 *   • a BroadcastChannel, which reaches the app's *other* tabs (it never echoes
 *     back to the sender, so a page listening to both hears each change once).
 */
const EVENT = "khazana:stock-changed";
const CHANNEL_NAME = "khazana-stock";

/** `undefined` = not resolved yet, `null` = unsupported (or server render). */
let channel: BroadcastChannel | null | undefined;

const getChannel = (): BroadcastChannel | null => {
  if (channel !== undefined) return channel;
  channel =
    typeof window !== "undefined" && "BroadcastChannel" in window
      ? new BroadcastChannel(CHANNEL_NAME)
      : null;
  return channel;
};

/**
 * Announce that on-hand stock changed. Call it right after a mutation the
 * server has already confirmed — never optimistically, since listeners react by
 * re-reading stock from the API.
 */
export const emitStockChanged = (reason?: string) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { reason } }));
  try {
    getChannel()?.postMessage({ reason });
  } catch {
    // A closed channel (or a browser that refuses the clone) must never take
    // the mutation's own success path down with it.
  }
};

/**
 * Re-run `onChange` whenever stock moves anywhere in the app.
 *
 * The callback is held in a ref, so a handler redefined on every render (the
 * usual `const loadItems = () => ...`) doesn't re-subscribe on every render.
 */
export function useStockChanged(onChange: () => void) {
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; });

  useEffect(() => {
    const handler = () => callback.current();
    window.addEventListener(EVENT, handler);
    const ch = getChannel();
    ch?.addEventListener("message", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      ch?.removeEventListener("message", handler);
    };
  }, []);
}
