import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface DemandOrder {
  id: string;
  serialNo?: string;
  fromBranchId?: string;
  toBranchId?: string;
  demandDate?: string;
  requiredDate?: string;
  remarks?: string;
  isActive?: number;
  createBy?: string;
  createDate?: string;
}

export interface DemandOrderDetail {
  id: string;
  itemId: string;
  qty: number;
  remarks?: string;
}

export interface DemandOrderRecord extends DemandOrder {
  details?: DemandOrderDetail[];
}

export interface DemandOrderPayload {
  toBranchId: string;
  demandDate: string;
  requiredDate?: string;
  remarks?: string;
  items: { itemId: string; qty: number; remarks?: string }[];
}

export const fetchDemandOrders = ({ page = 1, limit = 10 } = {}): Promise<Paginated<DemandOrder>> =>
  api.get(`/demand-orders?page=${page}&limit=${limit}`).then(unwrapPaginated<DemandOrder>);

export const fetchDemandOrder = (id: string): Promise<DemandOrderRecord> =>
  api.get(`/demand-orders/${id}`).then((r) => r.data);

export const createDemandOrder = (data: DemandOrderPayload) =>
  api.post<DemandOrder>("/demand-orders", data).then((r) => r.data);

export const updateDemandOrder = (id: string, data: DemandOrderPayload) =>
  api.patch<DemandOrder>(`/demand-orders/${id}`, data).then((r) => r.data);

export const deleteDemandOrder = (id: string) =>
  api.delete(`/demand-orders/${id}`).then((r) => r.data);
