import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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


export const fetchPackets = () =>
  api.get<{ data: PacketOption[] } | PacketOption[]>("/packets?limit=100").then(unwrapList<PacketOption>);

export const issuePackets = (data: PacketIssuePayload) =>
  api.post("/packets/issue", data).then((r) => r.data);
