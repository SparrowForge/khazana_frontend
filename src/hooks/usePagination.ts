import { useState } from "react";
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
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const setPage = (p: number) => setPageState(p);

  const setLimit = (l: number) => {
    setLimitState(l);
    setPageState(1);
  };

  const resetPage = () => {
    if (page !== 1) setPageState(1);
    else setRefreshKey((k) => k + 1);
  };

  return { page, limit, meta, refreshKey, setPage, setLimit, setMeta, resetPage };
}
