"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  fetchPacketOptions, fetchPacketIssues, fetchPacketIssue,
  createPacketIssue, updatePacketIssue, deletePacketIssue, ISSUE_TYPES,
  type PacketOption, type PacketIssueRecord, type PacketIssueGroup,
} from "./server";
import { fetchPacketStock } from "../stock/server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";

const today = () => new Date().toISOString().split("T")[0];

const defaultRange = () => {
  const now = new Date();
  return {
    fromDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
    toDate: today(),
  };
};

export default function PacketIssuePage() {
  const { can } = usePermissions();
  const canAdd = can("Packets", "add");
  const canEdit = can("Packets", "edit");
  const canDelete = can("Packets", "delete");
  // An issue always comes out of the session branch, and the balance it is
  // checked against is that branch's — so the on-hand figures below are read
  // for this branch specifically, not across every branch the user can see.
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const branchName = useAuthStore((s) => s.user?.branchName) ?? "-";

  const [records, setRecords] = useState<PacketIssueRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const initialRange = defaultRange();
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [toDate, setToDate] = useState(initialRange.toDate);

  const [packets, setPackets] = useState<PacketOption[]>([]);
  /** On-hand balance per packet code at the session branch. */
  const [onHand, setOnHand] = useState<Record<string, number>>({});
  const [modal, setModal] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState(today());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [issueType, setIssueType] = useState<string>(ISSUE_TYPES[0]);
  const [qtyByCode, setQtyByCode] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PacketIssueGroup | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = () => {
    setListLoading(true);
    fetchPacketIssues({ page, limit, fromDate, toDate })
      .then(({ items, meta }) => { setRecords(items); setMeta(meta); })
      .catch((err) => toast.error(getErrorMessage(err, "Failed to load packet issues")))
      .finally(() => setListLoading(false));
  };

  /** `includeEmpty` so a packet with nothing on hand still gets a row here and
   *  reads 0, rather than silently falling back to "unknown". */
  const loadOnHand = useCallback(() => {
    if (!sessionBranchId) return;
    fetchPacketStock({ branchId: sessionBranchId, includeEmpty: true })
      .then(({ items }) =>
        setOnHand(Object.fromEntries(items.map((r) => [r.code, r.balance]))))
      .catch(() => {});
  }, [sessionBranchId]);

  useEffect(() => { fetchPacketOptions().then(setPackets).catch(() => {}); }, []);
  useEffect(loadOnHand, [loadOnHand]);
  useEffect(loadList, [page, limit, refreshKey, setMeta, fromDate, toDate]);

  const validLines = useMemo(
    () =>
      packets
        .filter((p) => parseFloat(qtyByCode[p.code] ?? "") > 0)
        .map((p) => ({ code: p.code, name: p.name, qty: parseFloat(qtyByCode[p.code]) })),
    [packets, qtyByCode],
  );

  const totalQty = validLines.reduce((sum, l) => sum + l.qty, 0);

  /** What this document already takes out, so editing an existing issue is
   *  measured against the balance as if it had not been posted — otherwise a
   *  line would look over-issued against its own quantity. */
  const alreadyIssued = useMemo(() => {
    if (!editingSerial || !detail || detail.serialNo !== editingSerial) return {} as Record<string, number>;
    return detail.items.reduce<Record<string, number>>((acc, it) => {
      acc[it.code] = (acc[it.code] ?? 0) + Number(it.qty ?? 0);
      return acc;
    }, {});
  }, [editingSerial, detail]);

  const availableFor = (code: string) => (onHand[code] ?? 0) + (alreadyIssued[code] ?? 0);

  /** Lines the branch cannot cover. The server refuses these too — this just
   *  says so before the round trip. */
  const overIssued = useMemo(
    () => validLines.filter((l) => l.qty > availableFor(l.code)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [validLines, onHand, alreadyIssued],
  );

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
    setDetail(null);
    setIssueDate(today());
    setInvoiceNo("");
    setIssueType(ISSUE_TYPES[0]);
    setQtyByCode({});
    setSearch("");
    setModal(true);
  };

  const openEdit = async (record: PacketIssueRecord) => {
    try {
      const full = await fetchPacketIssue(record.serialNo);
      setDetail(full);
      setEditingSerial(full.serialNo);
      setIssueDate(full.issueDate ? full.issueDate.split("T")[0] : today());
      setInvoiceNo(full.invoiceNo ?? "");
      setIssueType(full.issueType || ISSUE_TYPES[0]);
      setSearch("");
      setQtyByCode(
        full.items.reduce<Record<string, string>>((acc, it) => {
          acc[it.code] = String((parseFloat(acc[it.code] ?? "0") || 0) + Number(it.qty ?? 0));
          return acc;
        }, {}),
      );
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load packet issue entry")); }
  };

  const openDetail = async (record: PacketIssueRecord) => {
    setDetail(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      setDetail(await fetchPacketIssue(record.serialNo));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load packet issue entry"));
      setDetailOpen(false);
    } finally { setDetailLoading(false); }
  };

  const handleDelete = async (record: PacketIssueRecord) => {
    if (!confirm(`Delete packet issue "${record.serialNo}"? The packets it took out will go back into stock.`)) return;
    try {
      await deletePacketIssue(record.serialNo);
      toast.success("Packet issue deleted");
      loadList(); loadOnHand();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  const handleSubmit = async () => {
    if (!validLines.length) { toast.error("Enter a quantity on at least one packet"); return; }
    if (overIssued.length) {
      toast.error(`Not enough stock for ${overIssued.map((l) => l.code).join(", ")}`);
      return;
    }
    const payload = {
      issueDate,
      invoiceNo: invoiceNo || undefined,
      issueType: issueType || undefined,
      items: validLines.map((l) => ({ code: l.code, qty: l.qty })),
    };
    setSubmitting(true);
    try {
      if (editingSerial) {
        await updatePacketIssue(editingSerial, payload);
        toast.success("Packet issue updated");
      } else {
        await createPacketIssue(payload);
        toast.success("Packet issue saved");
      }
      setModal(false);
      loadList(); loadOnHand();
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${editingSerial ? "update" : "save"}`));
    } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Packet Issue"
        subtitle={`Packets issued out of ${branchName}`}
        action={canAdd ? { label: "New Issue", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />

      <div className="mb-4 flex gap-4 items-end">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }} />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>

      <Table loading={listLoading} data={records} emptyMessage="No packet issues in this date range."
        columns={[
          { key: "issueDate", header: "Date", render: (r) => formatDate(r.issueDate) },
          {
            key: "serialNo", header: "Serial No",
            render: (r) => (
              <button onClick={() => openDetail(r)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ),
          },
          { key: "issueType", header: "Type", render: (r) => r.issueType || "-" },
          { key: "invoiceNo", header: "Invoice No", render: (r) => r.invoiceNo || "-" },
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

      <Modal open={modal} onClose={() => setModal(false)} title={editingSerial ? "Edit Packet Issue" : "New Packet Issue"} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-5">
          {editingSerial && <Input label="Serial No" value={editingSerial} disabled readOnly />}
          <Input label="Issue Date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          <Select
            label="Issue Type"
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            options={ISSUE_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <Input label="Invoice No" value={invoiceNo} maxLength={50} onChange={(e) => setInvoiceNo(e.target.value)} />
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
            {validLines.length} packet{validLines.length === 1 ? "" : "s"} to issue
          </div>
        </div>

        <div className="border border-sage-300 rounded-lg overflow-auto max-h-[45vh]">
          <table className="w-full text-sm">
            <thead className="bg-sage-100 sticky top-0 z-10">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Packet Name</th>
                <th className="px-3 py-2 font-medium text-right">Available</th>
                <th className="px-3 py-2 font-medium text-right w-32">Qty</th>
              </tr>
            </thead>
            <tbody>
              {visiblePackets.map((p) => {
                const qty = parseFloat(qtyByCode[p.code] ?? "") || 0;
                const available = availableFor(p.code);
                const over = qty > available;
                return (
                  <tr key={p.code} className={`border-t border-sage-200 ${over ? "bg-red-50" : qty > 0 ? "bg-primary-50/40" : ""}`}>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{p.code}</td>
                    <td className="px-3 py-1.5">{p.name || "-"}</td>
                    <td className={`px-3 py-1.5 text-right ${available <= 0 ? "text-gray-400" : "text-gray-600"}`}>
                      {available}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={qtyByCode[p.code] ?? ""}
                        placeholder="0"
                        onChange={(e) => setQtyByCode((prev) => ({ ...prev, [p.code]: e.target.value }))}
                        className={`w-full border rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 ${
                          over
                            ? "border-red-400 focus:ring-red-500"
                            : "border-sage-400 focus:ring-primary-800"
                        }`}
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

        {overIssued.length > 0 && (
          <p className="mt-3 text-sm text-red-600">
            Not enough stock at {branchName} for {overIssued.map((l) => l.code).join(", ")}.
          </p>
        )}
        <div className="mt-4 flex justify-end text-sm font-medium text-gray-700">
          Total Qty: <span className="ml-2 w-20 text-right">{totalQty}</span>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!validLines.length || overIssued.length > 0}>
            {editingSerial ? "Update Issue" : "Save Issue"}
          </Button>
        </div>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Packet Issue" size="lg">
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
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(detail.issueDate)}</span></div>
              <div><span className="text-gray-500">Issue Type:</span> <span className="font-medium">{detail.issueType || "-"}</span></div>
              <div><span className="text-gray-500">Invoice No:</span> <span className="font-medium">{detail.invoiceNo || "-"}</span></div>
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
