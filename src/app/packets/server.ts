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
  /** Omitted on update — the code is system-generated and never re-keyed. */
  code?: string;
  name?: string;
  uom?: string;
  weight?: number;
  rate?: number;
  isActive?: number;
}


export const fetchPackets = () =>
  api.get<{ data: Packet[] } | Packet[]>("/packets").then(unwrapList<Packet>);

/** Every active packet, for the receive/issue entry grids.
 *
 *  The shared pagination DTO caps `limit` at 100, so walk the pages until one
 *  comes back short rather than silently showing only the first hundred —
 *  same approach as the Production entry sheet. */
export const fetchPacketOptions = async (): Promise<Packet[]> => {
  const PAGE_SIZE = 100;
  const all: Packet[] = [];
  for (let page = 1; ; page++) {
    const batch = await api
      .get<{ data: Packet[] } | Packet[]>(`/packets?page=${page}&limit=${PAGE_SIZE}`)
      .then(unwrapList<Packet>);
    all.push(...batch);
    // A short page is the last one; the guard stops a malformed response (an
    // endpoint that ignores `page`) from looping forever.
    if (batch.length < PAGE_SIZE || page >= 50) break;
  }
  return all;
};

/** Next system-generated packet code: P001, P002, ... */
export const fetchNextPacketCode = (): Promise<string> =>
  api.get<{ code: string }>("/packets/next-code").then((r) => r.data.code);

export const createPacket = (data: PacketPayload) =>
  api.post<Packet>("/packets", data).then((r) => r.data);

export const updatePacket = (code: string, data: Omit<Partial<PacketPayload>, "code">) =>
  api.patch<Packet>(`/packets/${encodeURIComponent(code)}`, data).then((r) => r.data);

export const deletePacket = (code: string) =>
  api.delete(`/packets/${encodeURIComponent(code)}`).then((r) => r.data);
