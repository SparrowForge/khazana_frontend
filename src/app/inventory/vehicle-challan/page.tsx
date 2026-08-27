"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import {
  fetchItems, fetchVehicleChallans, fetchVehicleChallan,
  createVehicleChallan, updateVehicleChallan, deleteVehicleChallan,
  type AvailableItem, type VehicleChallanRecord, type VehicleChallanGroup,
} from "./server";
import { fetchSettings, type Settings } from "@/app/admin/settings/server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2, Eye, Printer, Truck } from "lucide-react";
import { type ExportColumn } from "@/lib/export/reportExport";
import {
  previewVehicleChallan,
  printVehicleChallan,
  challanItemName,
  sortChallanLines,
  type DeliveryChallanData,
  type DeliveryChallanLine,
} from "@/lib/export/deliveryChallanDocument";

// Vehicle Challan — the gate pass for a loaded van leaving the factory.
//
// Modelled on the Stock Issue sheet, minus everything that only makes sense
// once a destination is known: no receiving branch, no availability column, no
// shortage check. Nothing here moves stock — the units are still the factory's
// until an outlet takes them off the van, and that is entered as a real Stock
// Issue at that point. Showing an "Available" figure would invite the operator
// to read this as a stock document, so it is deliberately absent.

/** A challan line, numbered. `Received Qty` and `Remarks` stay blank on every
 *  output — the outlet that takes goods off the van writes them in by hand. */
interface ChallanRow extends DeliveryChallanLine { sl: number; }

/** Sorted and numbered exactly as the printed sheet renders them, so the
 *  on-screen table, the print-out and the spreadsheet agree row for row. */
const challanRows = (lines: DeliveryChallanLine[]): ChallanRow[] =>
  sortChallanLines(lines).map((l, i) => ({ ...l, sl: i + 1 }));

const challanColumns: ExportColumn<ChallanRow>[] = [
  { header: "SL No", value: (r) => r.sl, numeric: true },
  { header: "Item Of Name", value: (r) => challanItemName(r), width: 34 },
  { header: "Delivery", value: (r) => r.qty, numeric: true },
  { header: "Received Qty", value: () => "", width: 14 },
  { header: "Remarks", value: () => "", width: 22 },
];

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

const emptyHeader = { route: "", vehicleNo: "", driverName: "", driverMobile: "", voucherNo: "", remarks: "" };

export default function VehicleChallanPage() {
  const { can } = usePermissions();
  const canAdd = can("VehicleChallan", "add");
  const canEdit = can("VehicleChallan", "edit");
  const canDelete = can("VehicleChallan", "delete");

  const [challans, setChallans] = useState<VehicleChallanRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);

  const [modal, setModal] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [serialNo, setSerialNo] = useState("");
  const [header, setHeader] = useState(emptyHeader);
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split("T")[0]);
  /** Keyed by item id. Absent = untouched, which is the same as qty 0. */
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<VehicleChallanGroup | null>(null);

  // The despatching branch is always the session branch, and the page is
  // factory-only, so there is nothing to pick.
  const sessionUser = useAuthStore((st) => st.user);

  const setField = (patch: Partial<typeof emptyHeader>) => setHeader((prev) => ({ ...prev, ...patch }));

  /** The lines that will actually be saved: qty > 0, in catalogue order. */
  const validLines = useMemo(
    () =>
      availableItems
        .map((it) => ({ item: it, qty: parseFloat(entries[it.id] ?? "") }))
        .filter(({ qty }) => qty > 0)
        .map(({ item, qty }) => ({ itemId: item.id, qty })),
    [availableItems, entries],
  );

  /** The grid shows every item; a catalogue of any size needs a filter. Rows
   *  already carrying a qty stay visible so a search can't hide pending input. */
  const visibleItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return availableItems;
    return availableItems.filter(
      (it) =>
        parseFloat(entries[it.id] ?? "") > 0 ||
        it.itmCode?.toLowerCase().includes(q) ||
        it.itmName?.toLowerCase().includes(q),
    );
  }, [availableItems, entries, itemSearch]);

  const loadList = () => {
    setListLoading(true);
    fetchVehicleChallans({ page, limit, fromDate, toDate })
      .then(({ items, meta }) => { setChallans(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    // Letterhead only — a failure here still leaves a printable challan, just
    // with the fallback company name.
    fetchSettings().then(setSettings).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadList, [page, limit, refreshKey, setMeta, fromDate, toDate]);

  const openCreate = () => {
    setEditingSerial(null);
    setSerialNo("");
    setHeader(emptyHeader);
    setChallanDate(new Date().toISOString().split("T")[0]);
    setEntries({});
    setItemSearch("");
    setModal(true);
  };

  const openEdit = async (record: VehicleChallanRecord) => {
    try {
      const full = await fetchVehicleChallan(record.serialNo);
      setEditingSerial(full.serialNo);
      setSerialNo(full.serialNo);
      setHeader({
        route: full.route ?? "",
        vehicleNo: full.vehicleNo ?? "",
        driverName: full.driverName ?? "",
        driverMobile: full.driverMobile ?? "",
        voucherNo: full.voucherNo ?? "",
        remarks: full.remarks ?? "",
      });
      setChallanDate(full.challanDate ? full.challanDate.split("T")[0] : new Date().toISOString().split("T")[0]);
      setItemSearch("");
      // Repeated lines of one item collapse into the grid's single row for it.
      setEntries(
        full.items.reduce<Record<string, string>>((acc, it) => {
          const previous = parseFloat(acc[it.itemId] ?? "0") || 0;
          acc[it.itemId] = String(previous + Number(it.qty ?? 0));
          return acc;
        }, {}),
      );
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load vehicle challan")); }
  };

  /** Opens the report modal on a serial number, loading the saved document. */
  const showReport = async (serial: string) => {
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      setReport(await fetchVehicleChallan(serial));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load the challan"));
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handleDelete = async (record: VehicleChallanRecord) => {
    if (!confirm(`Delete vehicle challan "${record.serialNo}"?`)) return;
    try {
      await deleteVehicleChallan(record.serialNo);
      toast.success("Vehicle challan deleted");
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  const handleSubmit = async () => {
    if (!validLines.length) { toast.error("Enter a quantity on at least one item"); return; }
    setSubmitting(true);
    try {
      const payload = {
        challanDate,
        route: header.route || undefined,
        vehicleNo: header.vehicleNo.trim() || undefined,
        driverName: header.driverName || undefined,
        driverMobile: header.driverMobile || undefined,
        voucherNo: header.voucherNo || undefined,
        remarks: header.remarks || undefined,
        items: validLines,
      };
      // Both endpoints return the saved document, so the challan can be shown
      // without a second round trip.
      const saved = editingSerial
        ? await updateVehicleChallan(editingSerial, payload)
        : await createVehicleChallan(payload);
      toast.success(editingSerial ? "Vehicle challan updated" : "Vehicle challan saved");
      setModal(false);
      loadList();
      // Straight to the challan the van has to leave with.
      setReport(saved);
      setReportLoading(false);
      setReportOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${editingSerial ? "update" : "save"}`));
    } finally { setSubmitting(false); }
  };

  /** The printed challan header. There is no receiving branch: the route heads
   *  the pad, and the vehicle/driver line identifies the delivery instead. */
  const buildChallan = (opts: {
    challanNo: string;
    challanDate: string | Date;
    branchName?: string;
    branchAddress?: string;
    route?: string;
    vehicleNo?: string;
    driverName?: string;
    driverMobile?: string;
    items: DeliveryChallanLine[];
  }): DeliveryChallanData => ({
    companyName: settings?.companyName || "Khazana Mithai Limited",
    companyAddress: settings?.companyAddress || undefined,
    fromBranchName: opts.branchName,
    // The challan belongs to the despatching branch, so its address heads it.
    letterheadAddress: opts.branchAddress,
    // No outlet to name; the route is what the van is going out to serve. Falls
    // back to the vehicle so the heading is never blank.
    toBranchName: opts.route || opts.vehicleNo || "",
    vehicleNo: opts.vehicleNo,
    driverName: opts.driverName,
    driverMobile: opts.driverMobile,
    challanNo: opts.challanNo,
    issueDate: opts.challanDate,
    preparedBy: sessionUser?.name || sessionUser?.userName || undefined,
    items: opts.items,
  });

  /** Challan lines for the document being typed. Nothing is saved yet, so the
   *  name and unit come off the catalogue row. */
  const draftChallanLines = (): DeliveryChallanLine[] =>
    validLines.map((l) => {
      const item = availableItems.find((it) => it.id === l.itemId);
      return { itemName: item?.itmName || item?.itmCode || "-", uom: item?.itmUOM, qty: l.qty };
    });

  const handlePreview = () => {
    if (!validLines.length) { toast.error("Enter a quantity on at least one item to preview"); return; }
    previewVehicleChallan(
      buildChallan({
        // An unsaved document has no serial, so the field prints blank rather
        // than "New".
        challanNo: header.voucherNo || editingSerial || "",
        challanDate,
        branchName: sessionUser?.branchName ?? undefined,
        route: header.route,
        vehicleNo: header.vehicleNo,
        driverName: header.driverName,
        driverMobile: header.driverMobile,
        items: draftChallanLines(),
      }),
    );
  };

  /** The saved document's challan — same builder, lines straight off the record. */
  const savedChallan = (doc: VehicleChallanGroup): DeliveryChallanData =>
    buildChallan({
      challanNo: doc.voucherNo || doc.serialNo,
      challanDate: doc.challanDate ?? "",
      branchName: doc.branchName,
      branchAddress: doc.branchAddress,
      route: doc.route,
      vehicleNo: doc.vehicleNo,
      driverName: doc.driverName,
      driverMobile: doc.driverMobile,
      items: doc.items.map((it) => ({ itemName: it.itemName ?? "-", uom: it.uom, qty: Number(it.qty ?? 0) })),
    });

  return (
    <AppLayout>
      <PageHeader
        title="Challan Entry"
        subtitle="Gate pass for a loaded vehicle — records what left the factory, does not move stock"
        action={canAdd ? { label: "New Challan", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />

      <div className="mb-4 flex gap-4 items-end">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>

      <Table loading={listLoading} data={challans}
        columns={[
          {
            key: "serialNo", header: "Challan No",
            render: (r) => r.serialNo ? (
              <button onClick={() => showReport(r.serialNo)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ) : "-",
          },
          { key: "challanDate", header: "Date", render: (r) => formatDate(r.challanDate) },
          { key: "vehicleNo", header: "Vehicle No", render: (r) => r.vehicleNo || "-" },
          { key: "route", header: "Route", render: (r) => r.route || "-" },
          { key: "driverName", header: "Driver", render: (r) => r.driverName || "-" },
          { key: "lines", header: "Items", className: "text-right", render: (r) => r.lines ?? "-" },
          { key: "qty", header: "Total Qty", className: "text-right", render: (r) => Number(r.qty ?? 0).toFixed(2) },
          {
            key: "actions", header: "",
            render: (r) => (
              <div className="flex items-center gap-3">
                {canEdit && (
                  <button onClick={() => openEdit(r)} className="text-primary-800 hover:underline" title="Edit">
                    <Edit2 size={14} />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600" title="Delete">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editingSerial ? "Edit Challan" : "New Challan"}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4 mb-5">
          {editingSerial && <Input label="Challan No" value={serialNo} disabled readOnly />}
          <Input label="Date" type="date" value={challanDate} onChange={(e) => setChallanDate(e.target.value)} />
          <Input
            label="Vehicle No"
            placeholder="DHAKA METRO-TA-11-2233"
            value={header.vehicleNo}
            onChange={(e) => setField({ vehicleNo: e.target.value })}
          />
          <Input
            label="Route / Destination"
            placeholder="Mirpur - Uttara"
            value={header.route}
            onChange={(e) => setField({ route: e.target.value })}
          />
          <Input label="Driver Name" value={header.driverName} onChange={(e) => setField({ driverName: e.target.value })} />
          <Input label="Driver Mobile" value={header.driverMobile} onChange={(e) => setField({ driverMobile: e.target.value })} />
          <Input label="Voucher No" value={header.voucherNo} onChange={(e) => setField({ voucherNo: e.target.value })} />
          <Input label="Remarks" value={header.remarks} onChange={(e) => setField({ remarks: e.target.value })} />
        </div>

        <div className="flex items-center justify-between gap-3 mb-2">
          <Input
            placeholder="Search items by code or name..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="w-72"
          />
          <div className="text-sm text-gray-500">
            {validLines.length} item{validLines.length === 1 ? "" : "s"} on the vehicle
          </div>
        </div>

        {/* The whole catalogue, with the quantity typed inline. No "Available"
            column and no shortage check: loading a van is not a stock movement,
            so there is no balance for it to draw down. */}
        <div className="border border-sage-300 rounded-lg overflow-auto max-h-[45vh]">
          <table className="w-full text-sm">
            <thead className="bg-sage-100 sticky top-0 z-10">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Item ID</th>
                <th className="px-3 py-2 font-medium">Item Name</th>
                <th className="px-3 py-2 font-medium text-right w-32">Loaded Qty</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it) => {
                const value = entries[it.id] ?? "";
                const qty = parseFloat(value) || 0;
                return (
                  <tr key={it.id} className={`border-t border-sage-200 ${qty > 0 ? "bg-primary-50/40" : ""}`}>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{it.itmCode}</td>
                    <td className="px-3 py-1.5">{it.itmName}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={value}
                        placeholder="0"
                        onChange={(e) => setEntries((prev) => ({ ...prev, [it.id]: e.target.value }))}
                        className="w-full border border-sage-400 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
                      />
                    </td>
                  </tr>
                );
              })}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-gray-400">
                    No items match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          This challan tracks the vehicle only — it does <span className="font-medium">not</span> change stock. Enter a
          normal <span className="font-medium">Stock Issue</span> for whatever an outlet actually receives off the van;
          anything else comes back to the factory.
        </p>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="secondary" onClick={handlePreview} disabled={!validLines.length}>
            <Eye size={14} /> Preview
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!validLines.length}>
            {editingSerial ? "Update Vehicle Challan" : "Save Vehicle Challan"}
          </Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Vehicle Challan Report" size="lg">
        {reportLoading || !report ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading...</div>
        ) : (
          (() => {
            const challan = savedChallan(report);
            const challanRowsData = challanRows(challan.items);
            const totalQty = challanRowsData.reduce((sum, r) => sum + r.qty, 0);
            return (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-sm">
                  <div><span className="text-gray-500">Challan No:</span> <span className="font-medium">{report.serialNo}</span></div>
                  <div><span className="text-gray-500">Voucher No:</span> <span className="font-medium">{report.voucherNo || "-"}</span></div>
                  <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(report.challanDate)}</span></div>
                  <div><span className="text-gray-500">From Branch:</span> <span className="font-medium">{report.branchName || "-"}</span></div>
                  <div className="flex items-center gap-1.5">
                    <Truck size={14} className="text-gray-400" />
                    <span className="text-gray-500">Vehicle:</span> <span className="font-medium">{report.vehicleNo || "-"}</span>
                  </div>
                  <div><span className="text-gray-500">Route:</span> <span className="font-medium">{report.route || "-"}</span></div>
                  <div><span className="text-gray-500">Driver:</span> <span className="font-medium">{report.driverName || "-"}</span></div>
                  <div><span className="text-gray-500">Driver Mobile:</span> <span className="font-medium">{report.driverMobile || "-"}</span></div>
                </div>

                <div className="mb-3 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => previewVehicleChallan(challan)}>
                    <Eye size={14} /> Preview
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => printVehicleChallan(challan)}>
                    <Printer size={14} /> Print
                  </Button>
                  <ReportExportButtons
                    rows={challanRowsData}
                    columns={challanColumns}
                    meta={{
                      title: "Vehicle Challan",
                      subtitle: [
                        challan.toBranchName,
                        `Vehicle: ${report.vehicleNo || "-"}`,
                        `Challan No: ${challan.challanNo || "-"}`,
                        `Date: ${formatDate(report.challanDate)}`,
                      ].join(" · "),
                      footer: ["", "", totalQty.toFixed(2), "", ""],
                    }}
                    showPrint={false}
                  />
                </div>

                <Table
                  data={challanRowsData.map((r) => ({ id: r.sl, ...r }))}
                  columns={[
                    { key: "sl", header: "SL No", className: "text-center w-16" },
                    { key: "itemName", header: "Item Of Name", render: (r) => challanItemName(r) },
                    { key: "qty", header: "Delivery", className: "text-right", render: (r) => r.qty.toFixed(2) },
                    { key: "received", header: "Received Qty", render: () => "" },
                    { key: "remarks", header: "Remarks", render: () => "" },
                  ]}
                />
                <div className="mt-2 pr-4 text-right text-sm font-semibold text-gray-700">
                  Total Delivery: {totalQty.toFixed(2)}
                </div>
              </>
            );
          })()
        )}
      </Modal>
    </AppLayout>
  );
}
