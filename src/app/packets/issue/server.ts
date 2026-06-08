import api from "@/lib/api";

export interface PacketOption {
  id: number;
  code: string;
  name?: string;
}

export interface PacketIssuePayload {
  invoiceNo?: string;
  issueDate: string;
  issueType: string;
  items: { code: string; qty: number }[];
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchPackets = () =>
  api.get<{ data: PacketOption[] } | PacketOption[]>("/packets?limit=500").then(unwrap<PacketOption[]>);

export const issuePackets = (data: PacketIssuePayload) =>
  api.post("/packets/issue", data).then((r) => r.data);
