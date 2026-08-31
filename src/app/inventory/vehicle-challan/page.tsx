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
  searchItems, fetchVehicleChallans, fetchVehicleChallan,
  createVehicleChallan, updateVehicleChallan, deleteVehicleChallan,
  type AvailableItem, type VehicleChallanRecord, type VehicleChallanGroup,
} from "./server";
import { fetchSettings, type Settings } from "@/app/admin/settings/server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2, Eye, Printer } from "lucide-react";
import { type ExportColumn } from "@/lib/export/reportExport";
import {
  previewCustomerChallan,
  printCustomerChallan,
  type CustomerChallanData,
  type CustomerChallanLine,
} from "@/lib/export/customerChallanDocument";

// Vehicle Challan — the gate pass for a loaded van leaving the factory.
//
// Modelled on the Stock Issue sheet, minus everything that only makes sense
// once a destination is known: no receiving branch, no availability column, no
// shortage check. Nothing here moves stock — the units are still the factory's
// until an outlet takes them off the van, and that is entered as a real Stock
// Issue at that point. Showing an "Available" figure would invite the operator
// to read this as a stock document, so it is deliberately absent.

/** One printed row of the challan. */
interface ChallanRow extends CustomerChallanLine { sl: number; }

/** Numbered in entry order — the order the sheet prints them in, so the
 *  on-screen table, the print-out and the spreadsheet agree row for row. */
const challanRows = (lines: CustomerChallanLine[]): ChallanRow[] =>
  lines.map((l, i) => ({ ...l, sl: i + 1 }));

const challanColumns: ExportColumn<ChallanRow>[] = [
  { header: "Sl", value: (r) => r.sl, numeric: true },
  { header: "Description", value: (r) => r.itemName, width: 34 },
  { header: "UOM", value: (r) => r.uom ?? "", width: 10 },
  { header: "Qty", value: (r) => r.qty, numeric: true },
  // Printed empty for the receiving party to complete by hand.
  { header: "Remarks", value: () => "", width: 24 },
];

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

// Vehicle No, Route, Driver Name, Driver Mobile and Voucher No are no longer
// entered: none of them appear on the printed customer challan, and the challan
// number is the document's own serial. The columns still exist on the API and
// keep whatever earlier records put there.
const emptyHeader = {
  customerName: "", customerAddress: "", deliveryAddress: "",
  contactPerson: "", contactNo: "", poNo: "", poDate: "", remarks: "",
};

/** One typed line. `itemId` is set only when the description was matched to a
 *  catalogue item; a line typed freehand keeps `itemId` empty and travels on the
 *  challan as text alone — ad-hoc goods are never written to the Item table. */
interface ChallanLine { itemId: string; itemName: string; uom: string; qty: string; }

const BLANK_LINE: ChallanLine = { itemId: "", itemName: "", uom: "", qty: "" };

/** What the catalogue datalist offers, and what a typed value is matched back
 *  against — one string, so picking and typing cannot disagree. */
const catalogueLabel = (it: AvailableItem) => `${it.itmCode} — ${it.itmName ?? ""}`.trim();

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
  /** What is typed in the Customer Name box, and the debounced value the list is
   *  actually fetched with — the filter is a server-side match, so a request per
   *  keystroke would be one per letter of the name. */
  const [customerFilter, setCustomerFilter] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");

  const [modal, setModal] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [serialNo, setSerialNo] = useState("");
  const [header, setHeader] = useState(emptyHeader);
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<ChallanLine[]>([{ ...BLANK_LINE }]);
  /** Catalogue suggestions for whichever description box is being typed in.
   *  Fetched a handful at a time — the catalogue is never loaded whole. */
  const [suggestions, setSuggestions] = useState<AvailableItem[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<VehicleChallanGroup | null>(null);

  const setField = (patch: Partial<typeof emptyHeader>) => setHeader((prev) => ({ ...prev, ...patch }));

  /** The lines that will actually be saved: a description and a qty > 0. */
  const validLines = useMemo(
    () =>
      lines
        .filter((l) => l.itemName.trim() && parseFloat(l.qty) > 0)
        .map((l) => ({
          itemId: l.itemId || undefined,
          itemName: l.itemName.trim(),
          uom: l.uom.trim() || undefined,
          qty: parseFloat(l.qty),
        })),
    [lines],
  );

  const setLine = (i: number, patch: Partial<ChallanLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLine = () => setLines((prev) => [...prev, { ...BLANK_LINE }]);

  const totalDraftQty = useMemo(
    () => Math.round(validLines.reduce((sum, l) => sum + l.qty, 0) * 100) / 100,
    [validLines],
  );
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? [{ ...BLANK_LINE }] : prev.filter((_, idx) => idx !== i)));

  /** Typing in the description box. An exact match against a catalogue label
   *  binds the line to that item and fills its unit; anything else stays ad-hoc,
   *  and the unit is whatever the operator types. */
  const setLineItem = (i: number, typed: string) => {
    const match = suggestions.find((it) => catalogueLabel(it) === typed);
    setLine(i, match
      ? { itemId: match.id, itemName: match.itmName || match.itmCode, uom: match.itmUOM ?? "" }
      : { itemId: "", itemName: typed });
  };

  const loadList = () => {
    setListLoading(true);
    fetchVehicleChallans({ page, limit, fromDate, toDate, customerName: customerQuery })
      .then(({ items, meta }) => { setChallans(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    // Letterhead only — a failure here still leaves a printable challan, just
    // with the fallback company name.
    fetchSettings().then(setSettings).catch(() => {});
  }, []);

  /** Debounced type-ahead. Only the box being typed in drives it, so opening the
   *  form costs nothing and a long catalogue is never pulled down whole. */
  useEffect(() => {
    if (!modal) return;
    const t = setTimeout(() => {
      searchItems(itemQuery).then(setSuggestions).catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [itemQuery, modal]);
  useEffect(() => {
    const t = setTimeout(() => {
      setCustomerQuery(customerFilter);
      // Narrowing the list can leave the current page past the end of it, which
      // reads as "no challans" rather than "page 3 of 1".
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [customerFilter, setPage]);

  useEffect(loadList, [page, limit, refreshKey, setMeta, fromDate, toDate, customerQuery]);

  const openCreate = () => {
    setEditingSerial(null);
    setSerialNo("");
    setHeader(emptyHeader);
    setChallanDate(new Date().toISOString().split("T")[0]);
    setLines([{ ...BLANK_LINE }]);
    setModal(true);
  };

  const openEdit = async (record: VehicleChallanRecord) => {
    try {
      const full = await fetchVehicleChallan(record.serialNo);
      setEditingSerial(full.serialNo);
      setSerialNo(full.serialNo);
      setHeader({
        customerName: full.customerName ?? "",
        customerAddress: full.customerAddress ?? "",
        deliveryAddress: full.deliveryAddress ?? "",
        contactPerson: full.contactPerson ?? "",
        contactNo: full.contactNo ?? "",
        poNo: full.poNo ?? "",
        // Stored as a timestamp; the date input wants the calendar day alone.
        poDate: full.poDate ? full.poDate.split("T")[0] : "",
        remarks: full.remarks ?? "",
      });
      setChallanDate(full.challanDate ? full.challanDate.split("T")[0] : new Date().toISOString().split("T")[0]);
      // One row per saved line, in the order it was written — an ad-hoc line has
      // no id to collapse on, and two lines of the same thing may be deliberate.
      setLines(
        full.items.length
          ? full.items.map((it) => ({
              itemId: it.itemId ?? "",
              itemName: it.itemName ?? "",
              uom: it.uom ?? "",
              qty: String(Number(it.qty ?? 0)),
            }))
          : [{ ...BLANK_LINE }],
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
    if (!validLines.length) { toast.error("Add at least one line with a description and a quantity"); return; }
    setSubmitting(true);
    try {
      const payload = {
        challanDate,
        customerName: header.customerName || undefined,
        customerAddress: header.customerAddress || undefined,
        deliveryAddress: header.deliveryAddress || undefined,
        contactPerson: header.contactPerson || undefined,
        contactNo: header.contactNo || undefined,
        poNo: header.poNo || undefined,
        // Sent only when filled — an empty string is not a date the API accepts.
        poDate: header.poDate || undefined,
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

  /** The printed challan — the customer-facing A4 sheet, not the branch-to-branch
   *  pad. Everything the sheet cannot fill in prints as a blank label for the
   *  receiving party to complete by hand. */
  const buildChallan = (opts: {
    challanNo: string;
    challanDate: string | Date;
    branchAddress?: string;
    vatNo?: string;
    mobileNo?: string;
    customerName?: string;
    customerAddress?: string;
    deliveryAddress?: string;
    contactPerson?: string;
    contactNo?: string;
    poNo?: string;
    poDate?: string;
    items: CustomerChallanLine[];
  }): CustomerChallanData => ({
    companyName: settings?.companyName || "Khazana Mithai",
    // The challan belongs to the despatching branch, so its address heads it;
    // the company address is the fallback for a branch without one.
    companyAddress: opts.branchAddress || settings?.companyAddress || undefined,
    vatNo: opts.vatNo,
    mobileNo: opts.mobileNo,
    challanNo: opts.challanNo,
    challanDate: opts.challanDate,
    customerName: opts.customerName,
    customerAddress: opts.customerAddress,
    deliveryAddress: opts.deliveryAddress,
    contactPerson: opts.contactPerson,
    contactNo: opts.contactNo,
    poNo: opts.poNo,
    poDate: opts.poDate,
    items: opts.items,
  });

  /** Lines for the document being typed — straight off the form, since an
   *  ad-hoc line has no catalogue row to read back from. */
  const draftChallanLines = (): CustomerChallanLine[] =>
    validLines.map((l) => ({ itemName: l.itemName, uom: l.uom, qty: l.qty }));

  const handlePreview = () => {
    if (!validLines.length) { toast.error("Add at least one line with a description and a quantity to preview"); return; }
    previewCustomerChallan(
      buildChallan({
        // An unsaved document has no serial, so the field prints blank rather
        // than "New".
        challanNo: editingSerial || "",
        challanDate,
        customerName: header.customerName,
        customerAddress: header.customerAddress,
        deliveryAddress: header.deliveryAddress,
        contactPerson: header.contactPerson,
        contactNo: header.contactNo,
        poNo: header.poNo,
        poDate: header.poDate,
        items: draftChallanLines(),
      }),
    );
  };

  /** The saved document's challan — same builder, lines straight off the record. */
  const savedChallan = (doc: VehicleChallanGroup): CustomerChallanData =>
    buildChallan({
      // The document's own serial IS the challan number — there is no longer a
      // Voucher No to override it with.
      challanNo: doc.serialNo,
      challanDate: doc.challanDate ?? "",
      branchAddress: doc.branchAddress,
      vatNo: doc.branchVatNo,
      mobileNo: doc.branchMobileNo,
      customerName: doc.customerName,
      customerAddress: doc.customerAddress,
      deliveryAddress: doc.deliveryAddress,
      contactPerson: doc.contactPerson,
      contactNo: doc.contactNo,
      poNo: doc.poNo,
      poDate: doc.poDate,
      items: doc.items.map((it) => ({ itemName: it.itemName ?? "-", uom: it.uom, qty: Number(it.qty ?? 0) })),
    });

  return (
    <AppLayout>
      <PageHeader
        title="Challan Entry"
        subtitle="Gate pass for a loaded vehicle — records what left the factory, does not move stock"
        action={canAdd ? { label: "New Challan", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />

      <div className="mb-4 flex flex-wrap gap-4 items-end">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }} />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <Input
          label="Customer Name"
          placeholder="Any customer…"
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="w-64"
        />
      </div>

      <Table loading={listLoading} data={challans}
        columns={[
          { key: "challanDate", header: "Date", render: (r) => formatDate(r.challanDate) },
          {
            key: "serialNo", header: "Challan No",
            render: (r) => r.serialNo ? (
              <button onClick={() => showReport(r.serialNo)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ) : "-",
          },
          // Who the challan was made out to, not what carried it: the van's
          // details belong on the printed gate pass, the list is read to find
          // a customer's document.
          { key: "customerName", header: "Customer", render: (r) => r.customerName || "-" },
          { key: "contactNo", header: "Contact No", render: (r) => r.contactNo || "-" },
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
          {/* Typed by hand: a challan can be made out to a party that has no
              Customer record. These three head the printed sheet. */}
          <Input
            label="Customer Name"
            placeholder="Mr. Kabir"
            value={header.customerName}
            onChange={(e) => setField({ customerName: e.target.value })}
          />
          <Input
            label="Customer Address"
            placeholder="Dhaka"
            value={header.customerAddress}
            onChange={(e) => setField({ customerAddress: e.target.value })}
          />
          <Input
            label="Delivery Address"
            placeholder="Gazipur"
            value={header.deliveryAddress}
            onChange={(e) => setField({ deliveryAddress: e.target.value })}
            className="col-span-2"
          />
          {/* Contact and purchase-order details: the printed challan has always
              carried these labels, blank, for the party to fill in by hand. */}
          <Input
            label="Contact Person"
            placeholder="Mr. Rahman"
            value={header.contactPerson}
            onChange={(e) => setField({ contactPerson: e.target.value })}
          />
          <Input
            label="Contact No"
            placeholder="01711-000000"
            value={header.contactNo}
            onChange={(e) => setField({ contactNo: e.target.value })}
          />
          <Input
            label="PO No"
            placeholder="PO-4471"
            value={header.poNo}
            onChange={(e) => setField({ poNo: e.target.value })}
          />
          <Input
            label="PO Date"
            type="date"
            value={header.poDate}
            onChange={(e) => setField({ poDate: e.target.value })}
          />
          <Input label="Remarks" value={header.remarks} onChange={(e) => setField({ remarks: e.target.value })} />
        </div>

        {/* Lines are added one at a time. The description box offers catalogue
            matches as you type, but it does not require one: anything typed that
            is not in the catalogue travels on the challan as text and is NOT
            written to the Item table. */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-sm font-medium text-gray-600">Items</span>
          <span className="text-sm text-gray-500">
            {validLines.length} line{validLines.length === 1 ? "" : "s"}
            {totalDraftQty > 0 ? ` · ${totalDraftQty} total qty` : ""}
          </span>
        </div>

        <datalist id="challan-item-options">
          {suggestions.map((it) => (
            <option key={it.id} value={catalogueLabel(it)} />
          ))}
        </datalist>

        <div className="space-y-2">
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-xs font-semibold text-gray-600 px-1">
            <span>Description</span><span>UOM</span><span>Qty</span><span className="w-5" />
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center">
              <input
                list="challan-item-options"
                value={line.itemName}
                onChange={(e) => setLineItem(i, e.target.value)}
                onFocus={() => setItemQuery(line.itemName)}
                placeholder="Pick an item or type a description"
                className="w-full border border-sage-400 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
              />
              <input
                value={line.uom}
                onChange={(e) => setLine(i, { uom: e.target.value })}
                placeholder="Pcs"
                className="w-full border border-sage-400 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.qty}
                onChange={(e) => setLine(i, { qty: e.target.value })}
                placeholder="0"
                className="w-full border border-sage-400 rounded-md px-2 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
              />
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600" title="Remove line">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
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
                  <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(report.challanDate)}</span></div>
                  <div><span className="text-gray-500">From Branch:</span> <span className="font-medium">{report.branchName || "-"}</span></div>
                  <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{report.customerName || "-"}</span></div>
                  <div><span className="text-gray-500">Customer Address:</span> <span className="font-medium">{report.customerAddress || "-"}</span></div>
                  <div><span className="text-gray-500">Delivery Address:</span> <span className="font-medium">{report.deliveryAddress || "-"}</span></div>
                  <div><span className="text-gray-500">Contact Person:</span> <span className="font-medium">{report.contactPerson || "-"}</span></div>
                  <div><span className="text-gray-500">Contact No:</span> <span className="font-medium">{report.contactNo || "-"}</span></div>
                  <div><span className="text-gray-500">PO No:</span> <span className="font-medium">{report.poNo || "-"}</span></div>
                  <div><span className="text-gray-500">PO Date:</span> <span className="font-medium">{report.poDate ? formatDate(report.poDate) : "-"}</span></div>
                </div>

                <div className="mb-3 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => previewCustomerChallan(challan)}>
                    <Eye size={14} /> Preview
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => printCustomerChallan(challan)}>
                    <Printer size={14} /> Print
                  </Button>
                  <ReportExportButtons
                    rows={challanRowsData}
                    columns={challanColumns}
                    meta={{
                      title: "Challan",
                      subtitle: [
                        report.customerName || "",
                        `Challan No: ${challan.challanNo || "-"}`,
                        `Date: ${formatDate(report.challanDate)}`,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      footer: ["", "Total", "", totalQty.toFixed(2), ""],
                    }}
                    showPrint={false}
                  />
                </div>

                <Table
                  data={challanRowsData.map((r) => ({ id: r.sl, ...r }))}
                  columns={[
                    { key: "sl", header: "Sl", className: "text-center w-16" },
                    { key: "itemName", header: "Description" },
                    { key: "uom", header: "UOM", className: "text-center w-24", render: (r) => r.uom ?? "" },
                    { key: "qty", header: "Qty", className: "text-right", render: (r) => r.qty.toFixed(2) },
                    // Left empty for the receiving party to write in by hand.
                    { key: "remarks", header: "Remarks", render: () => "" },
                  ]}
                />
                <div className="mt-2 pr-4 text-right text-sm font-semibold text-gray-700">
                  Total Qty: {totalQty.toFixed(2)}
                </div>
              </>
            );
          })()
        )}
      </Modal>
    </AppLayout>
  );
}
