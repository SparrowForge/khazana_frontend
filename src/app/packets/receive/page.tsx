"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  fetchPacketOptions, fetchPacketReceives, fetchPacketReceive,
  createPacketReceive, updatePacketReceive, deletePacketReceive,
  type PacketOption, type PacketReceiveRecord, type PacketReceiveGroup,
} from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";

const today = () => new Date().toISOString().split("T")[0];

/** Default list window: this calendar month to date, matching Production. */
const defaultRange = () => {
  const now = new Date();
  return {
    fromDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
    toDate: today(),
  };
};

export default function PacketReceivePage() {
  const { can } = usePermissions();
  const canAdd = can("Packets", "add");
  const canEdit = can("Packets", "edit");
  const canDelete = can("Packets", "delete");
  // A receive always lands in the session branch — the backend reads it off the
  // token — so the field is shown for confirmation, not for choosing.
  const branchName = useAuthStore((s) => s.user?.branchName) ?? "-";

  const [records, setRecords] = useState<PacketReceiveRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const initialRange = defaultRange();
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [toDate, setToDate] = useState(initialRange.toDate);

  const [packets, setPackets] = useState<PacketOption[]>([]);
  const [modal, setModal] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [receiveDate, setReceiveDate] = useState(today());
  const [voucharNo, setVoucharNo] = useState("");
  /** Typed quantity keyed by packet code. Absent = untouched = qty 0. */
  const [qtyByCode, setQtyByCode] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PacketReceiveGroup | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = () => {
    setListLoading(true);
    fetchPacketReceives({ page, limit, fromDate, toDate })
      .then(({ items, meta }) => { setRecords(items); setMeta(meta); })
      .catch((err) => toast.error(getErrorMessage(err, "Failed to load packet receives")))
      .finally(() => setListLoading(false));
  };

  useEffect(() => { fetchPacketOptions().then(setPackets).catch(() => {}); }, []);
  useEffect(loadList, [page, limit, refreshKey, setMeta, fromDate, toDate]);

  /** The lines that will actually be saved: qty > 0, in catalogue order. */
  const validLines = useMemo(
    () =>
      packets
        .filter((p) => parseFloat(qtyByCode[p.code] ?? "") > 0)
        .map((p) => ({ code: p.code, name: p.name, qty: parseFloat(qtyByCode[p.code]) })),
    [packets, qtyByCode],
  );

  const totalQty = validLines.reduce((sum, l) => sum + l.qty, 0);

  /** Rows already carrying a qty stay visible so a search can't hide input the
   *  user has typed but not yet saved. */
  const visiblePackets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packets;
    return packets.filter(
      (p) =>
        parseFloat(qtyByCode[p.code] ?? "") > 0 ||
        p.code.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q),
    );
  }, [packets, qtyByCode, search]);

  const openCreate = () => {
    setEditingSerial(null);
    setReceiveDate(today());
    setVoucharNo("");
    setQtyByCode({});
    setSearch("");
    setModal(true);
  };

  const openEdit = async (record: PacketReceiveRecord) => {
    try {
      const full = await fetchPacketReceive(record.serialNo);
      setEditingSerial(full.serialNo);
      setReceiveDate(full.receiveDate ? full.receiveDate.split("T")[0] : today());
      setVoucharNo(full.voucharNo ?? "");
      setSearch("");
      // Repeated lines for one packet collapse into the grid's single row.
      setQtyByCode(
        full.items.reduce<Record<string, string>>((acc, it) => {
          acc[it.code] = String((parseFloat(acc[it.code] ?? "0") || 0) + Number(it.qty ?? 0));
          return acc;
        }, {}),
      );
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load packet receive entry")); }
  };

  const openDetail = async (record: PacketReceiveRecord) => {
    setDetail(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      setDetail(await fetchPacketReceive(record.serialNo));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load packet receive entry"));
      setDetailOpen(false);
    } finally { setDetailLoading(false); }
  };

  const handleDelete = async (record: PacketReceiveRecord) => {
    if (!confirm(`Delete packet receive "${record.serialNo}"? The packets it brought in will be removed from stock.`)) return;
    try {
      await deletePacketReceive(record.serialNo);
      toast.success("Packet receive deleted");
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  const handleSubmit = async () => {
    if (!validLines.length) { toast.error("Enter a quantity on at least one packet"); return; }
    const payload = {
      receiveDate,
      voucharNo: voucharNo || undefined,
      items: validLines.map((l) => ({ code: l.code, qty: l.qty })),
    };
    setSubmitting(true);
    try {
      if (editingSerial) {
        await updatePacketReceive(editingSerial, payload);
        toast.success("Packet receive updated");
      } else {
        await createPacketReceive(payload);
        toast.success("Packet receive saved");
      }
      setModal(false);
      loadList();
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${editingSerial ? "update" : "save"}`));
    } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Packet Receive"
        subtitle={`Packets received into ${branchName}`}
        action={canAdd ? { label: "New Receive", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />

      <div className="mb-4 flex gap-4 items-end">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }} />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>

      <Table loading={listLoading} data={records} emptyMessage="No packet receives in this date range."
        columns={[
          { key: "receiveDate", header: "Date", render: (r) => formatDate(r.receiveDate) },
          {
            key: "serialNo", header: "Serial No",
            render: (r) => (
              <button onClick={() => openDetail(r)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ),
          },
          { key: "voucharNo", header: "Voucher No", render: (r) => r.voucharNo || "-" },
          { key: "lineCount", header: "Packets", className: "text-right", render: (r) => r.lineCount ?? 0 },
          { key: "qty", header: "Total Qty", className: "text-right", render: (r) => r.qty ?? 0 },
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

      <Modal open={modal} onClose={() => setModal(false)} title={editingSerial ? "Edit Packet Receive" : "New Packet Receive"} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-5">
          {editingSerial && <Input label="Serial No" value={editingSerial} disabled readOnly />}
          <Input label="Receive Date" type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} />
          <Input label="Voucher No" value={voucharNo} maxLength={50} onChange={(e) => setVoucharNo(e.target.value)} />
          <Input label="Branch" value={branchName} disabled readOnly />
        </div>

        <div className="flex items-center justify-between gap-3 mb-2">
          <Input
            placeholder="Search packets by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <div className="text-sm text-gray-500">
            {validLines.length} packet{validLines.length === 1 ? "" : "s"} to receive
          </div>
        </div>

        {/* The whole packet catalogue with the quantity typed inline — the same
            sheet Production and Stock Receive use. Only rows carrying a
            quantity are sent. */}
        <div className="border border-sage-300 rounded-lg overflow-auto max-h-[45vh]">
          <table className="w-full text-sm">
            <thead className="bg-sage-100 sticky top-0 z-10">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Packet Name</th>
                <th className="px-3 py-2 font-medium">UOM</th>
                <th className="px-3 py-2 font-medium text-right w-32">Qty</th>
              </tr>
            </thead>
            <tbody>
              {visiblePackets.map((p) => {
                const qty = parseFloat(qtyByCode[p.code] ?? "") || 0;
                return (
                  <tr key={p.code} className={`border-t border-sage-200 ${qty > 0 ? "bg-primary-50/40" : ""}`}>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{p.code}</td>
                    <td className="px-3 py-1.5">{p.name || "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">{p.uom || "-"}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={qtyByCode[p.code] ?? ""}
                        placeholder="0"
                        onChange={(e) => setQtyByCode((prev) => ({ ...prev, [p.code]: e.target.value }))}
                        className="w-full border border-sage-400 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
                      />
                    </td>
                  </tr>
                );
              })}
              {visiblePackets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    {packets.length ? "No packets match that search." : "No packets defined yet — add one under Packet Info."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end text-sm font-medium text-gray-700">
          Total Qty: <span className="ml-2 w-20 text-right">{totalQty}</span>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!validLines.length}>
            {editingSerial ? "Update Receive" : "Save Receive"}
          </Button>
        </div>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Packet Receive" size="lg">
        {detailLoading || !detail ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading...</div>
        ) : (
          <>
            <div className="mb-4 pb-4 border-b border-sage-300">
              <h3 className="text-lg font-semibold text-gray-900">{detail.branchName || branchName}</h3>
              {detail.branchAddress && <p className="text-sm text-gray-600">{detail.branchAddress}</p>}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-sm">
              <div><span className="text-gray-500">Serial No:</span> <span className="font-medium">{detail.serialNo}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(detail.receiveDate)}</span></div>
              <div><span className="text-gray-500">Voucher No:</span> <span className="font-medium">{detail.voucharNo || "-"}</span></div>
            </div>
            <Table
              data={detail.items.map((it, i) => ({ id: i, ...it }))}
              columns={[
                { key: "code", header: "Code" },
                { key: "name", header: "Packet Name", render: (r) => r.name || "-" },
                { key: "qty", header: "Qty", className: "text-right" },
              ]}
            />
            <div className="mt-3 flex justify-end text-sm font-medium text-gray-700">
              Total Qty: <span className="ml-2">{detail.items.reduce((s, i) => s + Number(i.qty ?? 0), 0)}</span>
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
