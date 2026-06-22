import { useCallback, useState } from "react";
import type { PaginationMeta } from "@/lib/unwrap";

export interface PaginationState {
  page: number;
  limit: number;
  meta: PaginationMeta | null;
  refreshKey: number;
  setPage: (p: number) => void;
  setLimit: (l: number) => void;
  setMeta: (m: PaginationMeta) => void;
  resetPage: () => void;
}

export function usePagination(defaultLimit = 10): PaginationState {
  const [page, setPageState] = useState(1);
  const [limit, setLimitState] = useState(defaultLimit);
  const [meta, setMetaState] = useState<PaginationMeta | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const setPage = useCallback((p: number) => setPageState(p), []);

  const setLimit = useCallback((l: number) => {
    setLimitState(l);
    setPageState(1);
  }, []);

  // Wrap in useCallback so ESLint exhaustive-deps can detect stability
  // across the custom hook boundary and won't warn in consuming components.
  const setMeta = useCallback((m: PaginationMeta) => setMetaState(m), []);

  // Always set page to 1 AND bump refreshKey so the effect re-runs
  // regardless of whether page was already 1. Both updates batch in React 18.
  const resetPage = useCallback(() => {
    setPageState(1);
    setRefreshKey((k) => k + 1);
  }, []);

  return { page, limit, meta, refreshKey, setPage, setLimit, setMeta, resetPage };
}
