import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchPackets = () =>
  api.get<{ data: PacketOption[] } | PacketOption[]>("/packets?limit=500").then(unwrap<PacketOption[]>);

export const receivePackets = (data: PacketReceivePayload) =>
  api.post("/packets/receive", data).then((r) => r.data);
