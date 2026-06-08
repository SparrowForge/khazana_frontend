import api from "@/lib/api";

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
}

export interface IssuePayload {
  voucherNo?: string;
  issueDate: string;
  items: { itemCode: string; qty: number; unitPrice: number }[];
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/items?limit=500").then(unwrap<AvailableItem[]>);

export const issueStock = (data: IssuePayload) =>
  api.post("/inventory/issue", data).then((r) => r.data);
