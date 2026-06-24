import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface PacketOption {
  id: number;
  code: string;
  name?: string;
}

export interface PacketReceivePayload {
  voucherNo?: string;
  receiveDate: string;
  items: { code: string; qty: number }[];
}


export const fetchPackets = () =>
  api.get<{ data: PacketOption[] } | PacketOption[]>("/packets?limit=100").then(unwrapList<PacketOption>);

export const receivePackets = (data: PacketReceivePayload) =>
  api.post("/packets/receive", data).then((r) => r.data);
