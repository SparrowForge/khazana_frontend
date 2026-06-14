import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface PacketRow {
  id: number;
  code?: string;
  name?: string;
  received?: number;
  issued?: number;
  balance?: number;
}


export const fetchPacketReport = (from: string, to: string) =>
  api.get<{ data: PacketRow[] } | PacketRow[]>(`/reports/packet?from=${from}&to=${to}`).then(unwrapList<PacketRow>);
