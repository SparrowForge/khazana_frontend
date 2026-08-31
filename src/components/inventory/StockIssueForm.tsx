"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  fetchItems, issueStock, updateIssue,
  type AvailableItem, type IssueGroup,
} from "@/app/inventory/issue/server";
import { useIssueChallan } from "./useIssueChallan";
// One gross-up rule for the whole app: list price + VAT, rounded to 2dp. The
// same helper prices a Production Entry, so the two screens can't disagree.
import { vatInclusiveRate } from "@/app/inventory/production/server";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { isFactoryBranch } from "@/lib/branch";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Eye } from "lucide-react";
import { previewDeliveryChallan, type DeliveryChallanLine } from "@/lib/export/deliveryChallanDocument";

/** What the user typed against one item in the entry grid. The grid lists the
 *  whole catalogue, so most items carry an empty `qty` and are simply skipped —
 *  only rows with qty > 0 are ever sent. */
interface ItemEntry { qty: string; isProduction: boolean; }

const BLANK_ENTRY: ItemEntry = { qty: "", isProduction: false };

const today = () => new Date().toISOString().split("T")[0];

interface Props {
  /**
   * `modal` is the compact dialog body used by the Stock Issue list — a short,
   * scrolling grid under the header fields. `page` is the full-screen Item
   * Issue screen: the catalogue fills the height beside a standing document
   * panel, the way the POS terminal puts its cart beside the products.
   *
   * Only the arrangement differs — the fields, the rules and the save are one
   * implementation, so the two screens can never drift apart.
   */
  variant?: "modal" | "page";
  /** The document being edited. Null/absent means a new one is being written. */
  document?: IssueGroup | null;
  /** Dialog close. Omitted on the full page, which offers Clear instead. */
  onCancel?: () => void;
  /** The saved document's serial — the caller shows its Delivery Challan. */
  onSaved: (serialNo: string) => void;
}

/**
 * The Stock Issue entry form: header fields, the whole catalogue with a
 * quantity against each item, and the save that writes one Item_Issue document.
 *
 * Stock is read when this mounts rather than being handed in, so a form opened
 * after other issues have gone out quotes current on-hand rather than whatever
 * the screen behind it loaded.
 */
export default function StockIssueForm({ variant = "modal", document: doc, onCancel, onSaved }: Props) {
  const isPage = variant === "page";
  const editingSerial = doc?.serialNo ?? null;

  const { branches, branchName, buildChallan } = useIssueChallan();
  // Issuing branch is always the session branch and is not editable — an issue
  // can only send stock out of the branch the user is logged in at.
  const sessionUser = useAuthStore((st) => st.user);
  const issueBranchId = sessionUser?.branchId ?? "";
  const isFactorySession = isFactoryBranch(sessionUser);

  const [voucherNo, setVoucherNo] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [receiveBranchId, setReceiveBranchId] = useState("");
  /** Keyed by item id. Absent = untouched, which is the same as qty 0. */
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  /** Qty per item as the document being edited was saved. Editing is
   *  purge-and-replace — the stock it already took out comes back to it — so
   *  current on-hand plus this is what the form may commit. Empty when creating. */
  const [heldStock, setHeldStock] = useState<Record<string, number>>({});

  const loadItems = () => {
    setItemsLoading(true);
    return fetchItems()
      .then(setAvailableItems)
      .catch(() => {})
      .finally(() => setItemsLoading(false));
  };
  useEffect(() => { loadItems(); }, []);

  /** Blank sheet — the state a new document starts from, and what the full page
   *  returns to after one is saved so the next can be typed straight away. */
  const resetForm = () => {
    setVoucherNo("");
    setIssueDate(today());
    setReceiveBranchId("");
    setEntries({});
    setItemSearch("");
    setHeldStock({});
  };

  // Hydrate from the record being edited. Keyed on the serial so re-opening the
  // same document reloads it, and switching to a new one clears the sheet.
  useEffect(() => {
    if (!doc) { resetForm(); return; }
    setVoucherNo(doc.voucherNo ?? "");
    setIssueDate(doc.issueDate ? doc.issueDate.split("T")[0] : today());
    setReceiveBranchId(doc.receiveBranchId ?? "");
    setItemSearch("");
    // Repeated lines of one item collapse into the grid's single row for it,
    // the same way the server sums them against one balance.
    setEntries(
      doc.items.reduce<Record<string, ItemEntry>>((acc, it) => {
        const previous = parseFloat(acc[it.itemId]?.qty ?? "0") || 0;
        acc[it.itemId] = {
          qty: String(previous + Number(it.qty ?? 0)),
          isProduction: acc[it.itemId]?.isProduction || !!it.isProduction,
        };
        return acc;
      }, {}),
    );
    setHeldStock(
      doc.items.reduce<Record<string, number>>((acc, it) => {
        acc[it.itemId] = (acc[it.itemId] ?? 0) + Number(it.qty ?? 0);
        return acc;
      }, {}),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.serialNo]);

  /** On-hand qty an issue may still draw on for an item. An issue can't drive
   *  Inventory negative, so this is the ceiling — the server enforces it again. */
  const availableFor = (itemId: string) =>
    (availableItems.find((it) => it.id === itemId)?.stock ?? 0) + (heldStock[itemId] ?? 0);

  /** Lines asking for more than is available, summed per item so the same item
   *  entered on two lines is measured against one balance. */
  const stockShortages = (rows: { itemId: string; qty: number }[]) => {
    const wanted: Record<string, number> = {};
    for (const r of rows) wanted[r.itemId] = (wanted[r.itemId] ?? 0) + r.qty;
    return Object.entries(wanted)
      .map(([itemId, qty]) => {
        const meta = availableItems.find((it) => it.id === itemId);
        return { name: meta?.itmName || meta?.itmCode || itemId, qty, available: availableFor(itemId) };
      })
      .filter((r) => r.qty > r.available);
  };

  const entryFor = (itemId: string) => entries[itemId] ?? BLANK_ENTRY;

  const setEntry = (itemId: string, patch: Partial<ItemEntry>) =>
    setEntries((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? BLANK_ENTRY), ...patch } }));

  /** The lines that will actually be saved: qty > 0, in catalogue order. A
   *  production tick on a zero-qty row is ignored rather than rejected — the
   *  user simply hasn't filled that row in. */
  const validLines = useMemo(
    () =>
      availableItems
        .map((it) => ({ item: it, entry: entries[it.id] }))
        .filter(({ entry }) => parseFloat(entry?.qty ?? "") > 0)
        .map(({ item, entry }) => ({
          itemId: item.id,
          itemName: item.itmName || item.itmCode,
          qty: parseFloat(entry!.qty),
          unitPrice: Number(item.price ?? 0),
          // Only the factory may produce, so the flag can never leave a shop
          // session even if a stale checkbox state survived a branch switch.
          isProduction: isFactorySession && entry!.isProduction,
        })),
    [availableItems, entries, isFactorySession],
  );

  const totalQty = validLines.reduce((sum, l) => sum + l.qty, 0);

  /** Every branch except the one issuing — a document that sends stock to the
   *  branch it came from is meaningless. A legacy record whose receiving branch
   *  IS the issuing branch keeps its value listed, so opening it for edit shows
   *  what was saved instead of silently blanking the field. */
  const receiveBranchOptions = useMemo(
    () =>
      branches
        .filter((b) => b.id !== issueBranchId || b.id === receiveBranchId)
        .map((b) => ({ value: b.id, label: b.branchName })),
    [branches, issueBranchId, receiveBranchId],
  );

  /** Items the production flag can apply to at all: a tick on a zero-qty row is
   *  never sent, so those rows are neither counted nor toggled by Check All. */
  const productionEligible = useMemo(
    () => availableItems.filter((it) => parseFloat(entries[it.id]?.qty ?? "") > 0),
    [availableItems, entries],
  );
  const checkedCount = productionEligible.filter((it) => entries[it.id]?.isProduction).length;
  const allChecked = productionEligible.length > 0 && checkedCount === productionEligible.length;

  /** Tick every item that has a quantity, or clear them all when they already
   *  are. Rows with no quantity are left alone — checking them would set a flag
   *  the save then silently drops. */
  const toggleAllProduction = () => {
    const next = !allChecked;
    setEntries((prev) => {
      const draft = { ...prev };
      for (const it of productionEligible) {
        draft[it.id] = { ...(draft[it.id] ?? BLANK_ENTRY), isProduction: next };
      }
      return draft;
    });
  };

  /** Part-ticked reads as a dash rather than a misleading empty box; the DOM
   *  property has no JSX attribute, so it has to be set on the node. */
  const checkAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkAllRef.current) {
      checkAllRef.current.indeterminate = checkedCount > 0 && !allChecked;
    }
  }, [checkedCount, allChecked]);

  /** The grid shows every item; a catalogue of any size needs a filter. Rows
   *  already carrying a qty stay visible so a search can't hide pending input. */
  const visibleItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return availableItems;
    return availableItems.filter(
      (it) =>
        parseFloat(entries[it.id]?.qty ?? "") > 0 ||
        it.itmCode?.toLowerCase().includes(q) ||
        it.itmName?.toLowerCase().includes(q),
    );
  }, [availableItems, entries, itemSearch]);

  /** Challan lines for the document being typed. Nothing is saved yet, so the
   *  name and unit come off the catalogue row rather than the issue record. */
  const draftChallanLines = (): DeliveryChallanLine[] =>
    validLines.map((l) => {
      const item = availableItems.find((it) => it.id === l.itemId);
      return { itemName: item?.itmName || item?.itmCode || "-", uom: item?.itmUOM, qty: l.qty };
    });

  const handlePreview = () => {
    if (!validLines.length) { toast.error("Enter a quantity on at least one item to preview"); return; }
    previewDeliveryChallan(
      buildChallan({
        // A challan number is the voucher the outlet quotes back; an unsaved
        // document has neither, so the field prints blank rather than "New".
        challanNo: voucherNo || editingSerial || "",
        issueDate,
        issueBranchId,
        receiveBranchId,
        items: draftChallanLines(),
      }),
    );
  };

  const handleSubmit = async () => {
    if (!issueBranchId) { toast.error("No branch on this session — sign in again"); return; }
    if (!receiveBranchId) { toast.error("Select the receiving branch"); return; }
    // Every quantity zero or blank is the same as an empty submission: nothing
    // to issue, so there is no document to write.
    if (!validLines.length) { toast.error("Enter a quantity on at least one item"); return; }
    // Production lines are exempt: the same quantity is added to stock before
    // the issue takes it out, so they can never come up short. The server
    // applies the identical rule in InventoryService#stockCheckedLines.
    const short = stockShortages(validLines.filter((l) => !l.isProduction));
    if (short.length) {
      toast.error(`Not enough stock: ${short.map((s) => `${s.name} (${s.available} available, ${s.qty} requested)`).join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      // `itemName` is carried only for the panel on screen — the DTO whitelist
      // rejects anything it does not declare, so it is dropped here.
      const items = validLines.map(({ itemId, qty, unitPrice, isProduction }) => ({ itemId, qty, unitPrice, isProduction }));
      const payload = { voucherNo, issueDate, issueBranchId, receiveBranchId, items };
      let serial = editingSerial ?? "";
      if (editingSerial) {
        await updateIssue(editingSerial, payload);
        toast.success("Stock issue updated");
      } else {
        // The create endpoint returns the written Item_Issue rows; every line of
        // one document shares the serial, so the first row carries it.
        const rows = (await issueStock(payload)) as { serialNo?: string }[] | undefined;
        toast.success("Stock issue saved");
        serial = rows?.[0]?.serialNo ?? "";
        // A blank sheet for the next document, over the stock this issue has
        // just reduced — the full page stays open, so both have to be reset.
        resetForm();
        loadItems();
      }
      onSaved(serial);
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${editingSerial ? "update" : "save"}`));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── The pieces: written once, arranged differently per variant ──────────

  const headerFields = (
    <div className={isPage ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4 mb-5"}>
      {editingSerial && <Input label="Serial No" value={editingSerial} disabled readOnly />}
      <Input label="Voucher No" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
      <Input label="Date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
      {/* Fixed to the session branch: an issue can only send stock out of
          the branch the user is logged in at, so there is nothing to pick. */}
      <Input label="Issuing Branch" value={branchName(issueBranchId)} disabled readOnly />
      {/* The issuing branch is dropped from the list — stock cannot be
          issued to the branch it is leaving. */}
      <Select label="Issued To Branch" value={receiveBranchId} onChange={(e) => setReceiveBranchId(e.target.value)}
        placeholder="Select branch..." options={receiveBranchOptions} />
    </div>
  );

  const searchRow = (
    <div className="flex items-center justify-between gap-3 mb-2">
      <Input
        placeholder="Search items by code or name..."
        value={itemSearch}
        onChange={(e) => setItemSearch(e.target.value)}
        className={isPage ? "w-full max-w-sm" : "w-72"}
      />
      <div className="text-sm text-gray-500 shrink-0">
        {validLines.length} item{validLines.length === 1 ? "" : "s"} to issue
        {isFactorySession && validLines.some((l) => l.isProduction)
          ? ` · ${validLines.filter((l) => l.isProduction).length} to production`
          : ""}
      </div>
    </div>
  );

  // The whole catalogue, with the quantity typed inline. Scrolls rather than
  // paginates so a part-filled sheet is never split across pages.
  const itemGrid = (
    <div className={`border border-sage-300 rounded-lg overflow-auto bg-white ${isPage ? "flex-1 min-h-0" : "max-h-[45vh]"}`}>
      <table className="w-full text-sm">
        <thead className="bg-sage-100 sticky top-0 z-10">
          <tr className="text-left text-gray-600">
            <th className="px-3 py-2 font-medium">Item ID</th>
            <th className="px-3 py-2 font-medium">Item Name</th>
            {/* The item's selling rate WITH VAT — the figure the delivery is
                valued at on the Branchwise Delivery Report, so the person
                writing the issue sees what they are sending out. */}
            <th className="px-3 py-2 font-medium text-right w-28">Rate (Incl. VAT)</th>
            <th className="px-3 py-2 font-medium text-right">Available</th>
            <th className="px-3 py-2 font-medium text-right w-32">Issue Qty</th>
            {isFactorySession && (
              <th className="px-3 py-2 font-medium text-center w-32">
                <label className="flex items-center justify-center gap-1.5 cursor-pointer select-none">
                  <input
                    ref={checkAllRef}
                    type="checkbox"
                    checked={allChecked}
                    // Nothing to check until at least one quantity is typed.
                    disabled={productionEligible.length === 0}
                    onChange={toggleAllProduction}
                    className="h-4 w-4 accent-amber-600 disabled:opacity-30"
                    title="Check every item that has an issue quantity"
                  />
                  <span>Is Production</span>
                </label>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((it) => {
            const entry = entryFor(it.id);
            const qty = parseFloat(entry.qty) || 0;
            const available = availableFor(it.id);
            // Only a plain line can over-issue; a production line supplies
            // its own quantity, so it is never flagged red.
            const over = qty > available && !entry.isProduction;
            return (
              <tr
                key={it.id}
                className={`border-t border-sage-200 ${
                  // Production-selected rows are called out; an over-issue
                  // outranks that, since it blocks the save.
                  over ? "bg-red-50" : entry.isProduction && qty > 0 ? "bg-amber-50" : qty > 0 ? "bg-primary-50/40" : ""
                }`}
              >
                <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{it.itmCode}</td>
                <td className="px-3 py-1.5">{it.itmName}</td>
                <td
                  className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap"
                  // The parts behind the figure, for anyone checking it against
                  // the price list.
                  title={`${formatCurrency(it.price ?? 0)} + ${Number(it.vatPercentage ?? 0)}% VAT`}
                >
                  {formatCurrency(vatInclusiveRate(it))}
                </td>
                <td className={`px-3 py-1.5 text-right ${available <= 0 ? "text-gray-400" : ""}`}>{available}</td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.qty}
                    placeholder="0"
                    onChange={(e) => setEntry(it.id, { qty: e.target.value })}
                    className={`w-full border rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 ${
                      over ? "border-red-400 focus:ring-red-400" : "border-sage-400 focus:ring-primary-800"
                    }`}
                  />
                </td>
                {isFactorySession && (
                  <td className="px-3 py-1.5 text-center">
                    {/* Disabled without a quantity: the line would not be
                        sent at all, so do not invite the tick. */}
                    <input
                      type="checkbox"
                      checked={entry.isProduction}
                      disabled={qty <= 0}
                      onChange={(e) => setEntry(it.id, { isProduction: e.target.checked })}
                      className="h-4 w-4 accent-amber-600 disabled:opacity-30"
                    />
                  </td>
                )}
              </tr>
            );
          })}
          {visibleItems.length === 0 && (
            <tr>
              <td colSpan={isFactorySession ? 6 : 5} className="px-3 py-6 text-center text-gray-400">
                {itemsLoading ? "Loading items…" : "No items match that search."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const productionNote = isFactorySession ? (
    <p className="mt-2 text-xs text-gray-500">
      Ticking <span className="font-medium text-amber-700">Is Production</span> also records the line in Production
      Entry, which adds that quantity back to stock - use it for goods this document both manufactured and shipped.
    </p>
  ) : null;

  const actions = (
    <>
      {onCancel ? (
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      ) : (
        // The full page has nothing to close, so the same slot clears the sheet.
        <Button variant="secondary" onClick={resetForm} disabled={!validLines.length && !receiveBranchId}>Clear</Button>
      )}
      <Button variant="secondary" onClick={handlePreview} disabled={!validLines.length}>
        <Eye size={14} /> Preview
      </Button>
      <Button
        onClick={handleSubmit}
        loading={submitting}
        disabled={!validLines.length || !receiveBranchId}
      >
        {editingSerial ? "Update Stock Issue" : "Save Stock Issue"}
      </Button>
    </>
  );

  if (!isPage) {
    return (
      <>
        {headerFields}
        {searchRow}
        {itemGrid}
        {productionNote}
        <div className="flex justify-end gap-3 mt-6">{actions}</div>
      </>
    );
  }

  // Full page: the catalogue fills the height on the left and the document it is
  // being typed into stands beside it — the POS terminal's products-and-cart
  // split, so a long sheet never hides what has already been entered on it.
  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:h-[calc(100vh-10rem)]">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {searchRow}
        {itemGrid}
        {productionNote}
      </div>

      <aside className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4 lg:overflow-y-auto">
        <div className="bg-white rounded-xl border border-sage-300 p-4">
          {headerFields}
        </div>

        <div className="bg-white rounded-xl border border-sage-300 flex flex-col overflow-hidden flex-1 min-h-[12rem]">
          <div className="px-4 py-2.5 border-b border-sage-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-primary-900">Items To Issue</span>
            <span className="text-xs text-gray-500">{validLines.length}</span>
          </div>
          {validLines.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-300 text-sm px-4 text-center">
              Type a quantity against an item to add it here
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-sage-100">
              {validLines.map((l) => (
                <div key={l.itemId} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="flex-1 min-w-0 truncate" title={l.itemName}>{l.itemName}</span>
                  {l.isProduction && (
                    <span className="shrink-0 text-[10px] font-medium text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
                      PROD
                    </span>
                  )}
                  <span className="shrink-0 tabular-nums font-medium">{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => setEntry(l.itemId, { qty: "" })}
                    title="Remove from this issue"
                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors text-base leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-2.5 border-t border-sage-200 flex items-center justify-between text-sm font-semibold text-primary-900">
            <span>Total Qty</span>
            <span className="tabular-nums">{totalQty.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 flex-wrap">{actions}</div>
      </aside>
    </div>
  );
}
