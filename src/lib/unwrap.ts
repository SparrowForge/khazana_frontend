import { AxiosResponse } from "axios";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

const DEFAULT_META: PaginationMeta = { total: 0, page: 1, limit: 10, totalPages: 1, hasNextPage: false, hasPreviousPage: false };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unwrapList = <T>(r: any): T[] => {
  const d = r.data;
  if (Array.isArray(d)) return d;            // raw array: [ ... ]
  if (Array.isArray(d?.data)) return d.data; // wrapped: { data: [ ... ] }
  return d?.data?.items ?? [];               // paginated: { data: { items: [ ... ] } }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unwrapPaginated = <T>(r: any): Paginated<T> => ({
  items: r.data?.data?.items ?? [],
  meta: r.data?.data?.meta ?? DEFAULT_META,
});

/** Extract a single value from a wrapped API response: { data: T } or raw T */
export const unwrap = <T>(r: AxiosResponse<{ data?: T } | T>): T =>
  ((r.data as { data?: T }).data ?? r.data) as T;
