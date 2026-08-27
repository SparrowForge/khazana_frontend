import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

// Vehicle Challan — the gate pass for a loaded van leaving the factory.
// No receiving branch and no stock effect: the real movement is recorded as a
// Stock Issue when an outlet actually takes goods off the van.

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  /** Unit of measure — printed in brackets on the challan. */
  itmUOM?: string;
}

/** One item line loaded onto the vehicle. No price: this document accounts for
 *  what physically went out, not for its value. */
export interface VehicleChallanLinePayload {
  itemId: string;
  qty: number;
}

export interface VehicleChallanPayload {
  challanDate: string;
  route?: string;
  /** Optional — a challan can be raised before a van is assigned. */
  vehicleNo?: string;
  driverName?: string;
  driverMobile?: string;
  voucherNo?: string;
  remarks?: string;
  items: VehicleChallanLinePayload[];
}

/** One row in the list — one per serial number, qty summed across item lines. */
export interface VehicleChallanRecord {
  id?: string;
  serialNo: string;
  voucharNo?: string;
  qty?: number;
  /** How many item lines the challan carries. */
  lines?: number;
  challanDate?: string;
  route?: string;
  vehicleNo?: string;
  driverName?: string;
}

/** Full challan for a serial number, with all its item lines. */
export interface VehicleChallanGroup {
  serialNo: string;
  voucherNo?: string;
  challanDate?: string;
  branchId?: string;
  branchName?: string;
  /** Despatching branch address — heads the printed challan. */
  branchAddress?: string;
  route?: string;
  vehicleNo?: string;
  driverName?: string;
  driverMobile?: string;
  remarks?: string;
  items: {
    itemId: string;
    itemName?: string;
    uom?: string;
    qty: number;
  }[];
}

/** The entry grid lists the whole catalogue, but the shared pagination DTO caps
 *  `limit` at 100 — walk the pages until one comes back short. Mirrors the
 *  Stock Issue sheet, including its deliberate lack of an `isActive` filter. */
export const fetchItems = async (): Promise<AvailableItem[]> => {
  const PAGE_SIZE = 100;
  const all: AvailableItem[] = [];
  for (let page = 1; ; page++) {
    const batch = await api
      .get<{ data: AvailableItem[] } | AvailableItem[]>(`/inventory/items?page=${page}&limit=${PAGE_SIZE}`)
      .then(unwrapList<AvailableItem>);
    all.push(...batch);
    if (batch.length < PAGE_SIZE || page >= 50) break;
  }
  return all;
};

export const fetchVehicleChallans = ({
  page = 1,
  limit = 10,
  fromDate,
  toDate,
}: { page?: number; limit?: number; fromDate?: string; toDate?: string } = {}): Promise<
  Paginated<VehicleChallanRecord>
> => {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("limit", String(limit));
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  return api.get(`/vehicle-challans?${params.toString()}`).then(unwrapPaginated<VehicleChallanRecord>);
};

export const fetchVehicleChallan = (serialNo: string): Promise<VehicleChallanGroup> =>
  api.get(`/vehicle-challans/${encodeURIComponent(serialNo)}`).then((r) => r.data);

/** Returns the saved document, so the caller can print it without a re-fetch. */
export const createVehicleChallan = (data: VehicleChallanPayload): Promise<VehicleChallanGroup> =>
  api.post("/vehicle-challans", data).then((r) => r.data);

export const updateVehicleChallan = (
  serialNo: string,
  data: VehicleChallanPayload,
): Promise<VehicleChallanGroup> =>
  api.patch(`/vehicle-challans/${encodeURIComponent(serialNo)}`, data).then((r) => r.data);

export const deleteVehicleChallan = (serialNo: string) =>
  api.delete(`/vehicle-challans/${encodeURIComponent(serialNo)}`).then((r) => r.data);
