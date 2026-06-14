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

export interface PacketStock {
  id: number;
  packetCode: string;
  packet?: { name?: string };
  quantity: number;
}

export interface PacketReceivePayload {
  voucherNo?: string;
  date: string;
  items: { packetCode: string; qty: number }[];
}

export interface PacketIssuePayload {
  voucherNo?: string;
  date: string;
  items: { packetCode: string; qty: number }[];
}


export const packetsService = {
  list: (limit = 500) =>
    api.get<{ data: Packet[] } | Packet[]>(`/packets?limit=${limit}`).then(unwrapList<Packet>),

  create: (data: PacketPayload) =>
    api.post<Packet>("/packets", data).then((r) => r.data),

  update: (id: number, data: Partial<PacketPayload>) =>
    api.patch<Packet>(`/packets/${id}`, data).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/packets/${id}`).then((r) => r.data),

  receive: (data: PacketReceivePayload) =>
    api.post("/packets/receive", data).then((r) => r.data),

  issue: (data: PacketIssuePayload) =>
    api.post("/packets/issue", data).then((r) => r.data),

  listStock: () =>
    api.get<{ data: PacketStock[] } | PacketStock[]>("/packets/stock").then(unwrapList<PacketStock>),
};
