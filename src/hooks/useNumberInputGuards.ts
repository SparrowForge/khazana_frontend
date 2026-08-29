"use client";
import { useEffect } from "react";
import { installNumberInputGuards } from "@/lib/numberInputGuards";

/**
 * Blocks wheel- and arrow-key edits on every `<input type="number">` in the
 * app. Called ONCE, from `AppShell` — the guards are delegated off the
 * document, so one call covers every page and every field rendered later.
 *
 * Individual fields opt out with `data-allow-scroll` / `class="allow-scroll"`.
 * See `lib/numberInputGuards.ts`.
 */
export function useNumberInputGuards(): void {
  useEffect(() => installNumberInputGuards(), []);
}

export default useNumberInputGuards;
