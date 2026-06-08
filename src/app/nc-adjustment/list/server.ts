import api from "@/lib/api";

export interface NC {
  id: string;
  ncmstrCode?: string;
  ncmstrDate?: string;
  ncmstrName?: string;
  ncmstrContactNo?: string;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchNcAdjustments = () =>
  api.get<{ data: NC[] } | NC[]>("/nc").then(unwrap<NC[]>);
