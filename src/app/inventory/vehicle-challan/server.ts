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

/** One line of the challan. No price: this document accounts for what physically
 *  went out, not for its value.
 *
 *  `itemId` is set only when the line was picked from the catalogue. A line typed
 *  by hand carries just `itemName`/`uom` — ad-hoc goods are NOT added to the Item
 *  table, they exist only on this challan. */
export interface VehicleChallanLinePayload {
  itemId?: string;
  itemName?: string;
  uom?: string;
  qty: number;
}

export interface VehicleChallanPayload {
  challanDate: string;
  customerName?: string;
  customerAddress?: string;
  deliveryAddress?: string;
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
  customerName?: string;
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
  branchVatNo?: string;
  branchMobileNo?: string;
  customerName?: string;
  customerAddress?: string;
  deliveryAddress?: string;
  route?: string;
  vehicleNo?: string;
  driverName?: string;
  driverMobile?: string;
  remarks?: string;
  items: {
    itemId: string | null;
    itemName?: string;
    uom?: string;
    qty: number;
  }[];
}

/** Type-ahead lookup against the catalogue.
 *
 *  Deliberately NOT a full catalogue load: challan lines are added one at a
 *  time, and most of them are goods that are not in the Item table at all, so
 *  walking every page up front would be work done for nothing. The server caps
 *  the page; a short list is all a picker needs.
 */
export const searchItems = (term: string, limit = 20): Promise<AvailableItem[]> => {
  const params = new URLSearchParams({ page: "1", limit: String(limit) });
  const q = term.trim();
  if (q) params.append("search", q);
  return api
    .get<{ data: AvailableItem[] } | AvailableItem[]>(`/inventory/items?${params.toString()}`)
    .then(unwrapList<AvailableItem>);
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
