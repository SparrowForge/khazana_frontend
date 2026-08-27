import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export { fetchPacketOptions, type Packet as PacketOption } from "../server";

export const ISSUE_TYPES = ["Sale", "Internal", "Damaged"] as const;

export interface PacketLine {
  code: string;
  qty: number;
}

export interface PacketIssuePayload {
  invoiceNo?: string;
  issueType?: string;
  issueDate: string;
  items: PacketLine[];
}

/** One row in the Packet Issue list — one per serial number, with `qty` summed
 *  across every packet line sharing that serial. */
export interface PacketIssueRecord {
  id?: string;
  serialNo: string;
  invoiceNo?: string;
  issueType?: string;
  qty?: number;
  lineCount?: number;
  issueDate?: string;
  branchId?: string;
}

/** The full issue document for one serial number, with all its lines. */
export interface PacketIssueGroup {
  serialNo: string;
  invoiceNo?: string;
  issueType?: string;
  issueDate?: string;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  items: { code: string; name?: string; qty: number }[];
}

export const fetchPacketIssues = ({
  page = 1,
  limit = 10,
  fromDate,
  toDate,
}: { page?: number; limit?: number; fromDate?: string; toDate?: string } = {}): Promise<Paginated<PacketIssueRecord>> => {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("limit", String(limit));
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  return api.get(`/packets/issue?${params.toString()}`).then(unwrapPaginated<PacketIssueRecord>);
};

export const fetchPacketIssue = (serialNo: string): Promise<PacketIssueGroup> =>
  api.get(`/packets/issue/${encodeURIComponent(serialNo)}`).then((r) => r.data);

export const createPacketIssue = (data: PacketIssuePayload) =>
  api.post("/packets/issue", data).then((r) => r.data);

export const updatePacketIssue = (serialNo: string, data: PacketIssuePayload) =>
  api.patch(`/packets/issue/${encodeURIComponent(serialNo)}`, data).then((r) => r.data);

export const deletePacketIssue = (serialNo: string) =>
  api.delete(`/packets/issue/${encodeURIComponent(serialNo)}`).then((r) => r.data);
