import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface AuditLog {
  serialNo: number;
  actionPage?: string;
  actionDone?: string;
  userName?: string;
  date?: string;
  module?: string;
  ipAddress?: string;
}


export const fetchAuditLog = () =>
  api.get<{ data: AuditLog[] } | AuditLog[]>("/admin/audit-log").then(unwrapList<AuditLog>);
