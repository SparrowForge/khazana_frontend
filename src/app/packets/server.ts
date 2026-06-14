import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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


export const fetchPackets = () =>
  api.get<{ data: Packet[] } | Packet[]>("/packets").then(unwrapList<Packet>);

export const createPacket = (data: PacketPayload) =>
  api.post<Packet>("/packets", data).then((r) => r.data);

export const updatePacket = (code: string, data: Partial<PacketPayload>) =>
  api.patch<Packet>(`/packets/${code}`, data).then((r) => r.data);

export const deletePacket = (code: string) =>
  api.delete(`/packets/${code}`).then((r) => r.data);
