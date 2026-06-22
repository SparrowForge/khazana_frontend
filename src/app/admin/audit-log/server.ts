import api from "@/lib/api";

export interface AuditLog {
  id: string;
  actionPage?: string;
  actionDone?: string;
  userName?: string;
  date?: string;
  module?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const fetchAuditLog = (): Promise<AuditLog[]> =>
  api.get<AuditLog[]>("/admin/audit-log").then((r) => Array.isArray(r.data) ? r.data : []);
