import api from "@/lib/api";

export interface AuditLog {
  serialNo: number;
  actionPage?: string;
  actionDone?: string;
  userName?: string;
  date?: string;
  module?: string;
  ipAddress?: string;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchAuditLog = () =>
  api.get<{ data: AuditLog[] } | AuditLog[]>("/admin/audit-log").then(unwrap<AuditLog[]>);
