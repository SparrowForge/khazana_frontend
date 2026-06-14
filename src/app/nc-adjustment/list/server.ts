import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface NC {
  id: string;
  ncmstrCode?: string;
  ncmstrDate?: string;
  ncmstrName?: string;
  ncmstrContactNo?: string;
}


export const fetchNcAdjustments = () =>
  api.get<{ data: NC[] } | NC[]>("/nc-adjustment").then(unwrapList<NC>);
