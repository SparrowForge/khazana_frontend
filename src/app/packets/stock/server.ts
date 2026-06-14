import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface PacketStock {
  id: number;
  code: string;
  name?: string;
  totalReceived?: number;
  totalIssued?: number;
  balance?: number;
}


export const fetchPacketStock = () =>
  api.get<{ data: PacketStock[] } | PacketStock[]>("/packets/stock").then(unwrapList<PacketStock>);
