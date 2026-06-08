import api from "@/lib/api";

export interface Settings {
  id?: number;
  companyName?: string;
  companyAddress?: string;
  companyUtility?: string;
  reportFooter?: string;
}

export const fetchSettings = () =>
  api.get<Settings>("/admin/settings").then((r) => r.data);

export const updateSettings = (data: Partial<Settings>) =>
  api.patch<Settings>("/admin/settings", data).then((r) => r.data);
