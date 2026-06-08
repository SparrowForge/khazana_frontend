import api from "@/lib/api";

export interface PacketRow {
  id: number;
  code?: string;
  name?: string;
  received?: number;
  issued?: number;
  balance?: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchPacketReport = (from: string, to: string) =>
  api.get<{ data: PacketRow[] } | PacketRow[]>(`/reports/packet?from=${from}&to=${to}`).then(unwrap<PacketRow[]>);
