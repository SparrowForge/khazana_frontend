import { AxiosResponse } from "axios";

/** Extract the items array from a paginated API response: { data: { items: T[], meta } } */
export const unwrapList = <T>(r: AxiosResponse<{ data: { items: T[] } }>): T[] =>
  r.data?.data?.items ?? [];

/** Extract a single value from a wrapped API response: { data: T } or raw T */
export const unwrap = <T>(r: AxiosResponse<{ data?: T } | T>): T =>
  ((r.data as { data?: T }).data ?? r.data) as T;
