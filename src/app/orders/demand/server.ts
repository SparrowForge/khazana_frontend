import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

/** Which round of demand an order is. Stored as these exact strings; the Demand
 *  Report filters on them. Mirrors DEMAND_ORDER_TYPES on the backend. */
export const DEMAND_ORDER_TYPES = [
  { value: "First", label: "First Order" },
  { value: "Second", label: "Second Order" },
  { value: "Special", label: "Special Order" },
];

/** Label for a stored value — "-" for an order raised before the field existed. */
export const demandTypeLabel = (value?: string | null): string =>
  DEMAND_ORDER_TYPES.find((t) => t.value === value)?.label ?? "-";

export interface DemandOrder {
  id: string;
  serialNo?: string;
  fromBranchId?: string;
  toBranchId?: string;
  demandDate?: string;
  requiredDate?: string;
  /** 'First' | 'Second' | 'Special'; absent on orders raised before the field. */
  orderType?: string;
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
  orderType?: string;
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
