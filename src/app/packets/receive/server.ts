import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

/** The packet catalogue the entry grid is built from. Shared with Packet Issue
 *  and Packet Info so there is one definition of what a packet looks like. */
export { fetchPacketOptions, type Packet as PacketOption } from "../server";

export interface PacketLine {
  code: string;
  qty: number;
}

export interface PacketReceivePayload {
  /** Supplier voucher / challan number. Note the column spelling: the table
   *  column is `VoucharNo`, and the API mirrors it rather than silently
   *  translating — an earlier `voucherNo` payload was rejected outright. */
  voucharNo?: string;
  receiveDate: string;
  items: PacketLine[];
}

/** One row in the Packet Receive list — one per serial number, with `qty`
 *  summed across every packet line sharing that serial. */
export interface PacketReceiveRecord {
  id?: string;
  serialNo: string;
  voucharNo?: string;
  qty?: number;
  lineCount?: number;
  receiveDate?: string;
  branchId?: string;
}

/** The full receive document for one serial number, with all its lines. */
export interface PacketReceiveGroup {
  serialNo: string;
  voucharNo?: string;
  receiveDate?: string;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  items: { code: string; name?: string; qty: number }[];
}

export const fetchPacketReceives = ({
  page = 1,
  limit = 10,
  fromDate,
  toDate,
}: { page?: number; limit?: number; fromDate?: string; toDate?: string } = {}): Promise<Paginated<PacketReceiveRecord>> => {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("limit", String(limit));
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  return api.get(`/packets/receive?${params.toString()}`).then(unwrapPaginated<PacketReceiveRecord>);
};

export const fetchPacketReceive = (serialNo: string): Promise<PacketReceiveGroup> =>
  api.get(`/packets/receive/${encodeURIComponent(serialNo)}`).then((r) => r.data);

export const createPacketReceive = (data: PacketReceivePayload) =>
  api.post("/packets/receive", data).then((r) => r.data);

export const updatePacketReceive = (serialNo: string, data: PacketReceivePayload) =>
  api.patch(`/packets/receive/${encodeURIComponent(serialNo)}`, data).then((r) => r.data);

export const deletePacketReceive = (serialNo: string) =>
  api.delete(`/packets/receive/${encodeURIComponent(serialNo)}`).then((r) => r.data);
