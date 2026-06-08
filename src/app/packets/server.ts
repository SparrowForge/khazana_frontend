import api from "@/lib/api";

export interface Packet {
  id: number;
  code: string;
  name?: string;
  uom?: string;
  weight?: number;
  rate?: number;
  isActive?: number;
}

export interface PacketPayload {
  code: string;
  name?: string;
  uom?: string;
  weight?: number;
  rate?: number;
  isActive?: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchPackets = () =>
  api.get<{ data: Packet[] } | Packet[]>("/packets").then(unwrap<Packet[]>);

export const createPacket = (data: PacketPayload) =>
  api.post<Packet>("/packets", data).then((r) => r.data);

export const updatePacket = (id: number, data: Partial<PacketPayload>) =>
  api.patch<Packet>(`/packets/${id}`, data).then((r) => r.data);

export const deletePacket = (id: number) =>
  api.delete(`/packets/${id}`).then((r) => r.data);
