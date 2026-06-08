import api from "@/lib/api";

export interface PacketStock {
  id: number;
  code: string;
  name?: string;
  totalReceived?: number;
  totalIssued?: number;
  balance?: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchPacketStock = () =>
  api.get<{ data: PacketStock[] } | PacketStock[]>("/packets/stock").then(unwrap<PacketStock[]>);
