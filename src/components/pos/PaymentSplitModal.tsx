"use client";
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Trash2 } from "lucide-react";
import { POS_PAY_MODES, type PosBank } from "@/lib/services/pos.service";

/** One tender the cashier is keying. Amounts are strings while being typed —
 *  an empty box must stay empty rather than snapping to 0. */
export interface SplitRow {
  method: string;
  amount: string;
  bankId: string;
  cardNo: string;
  transactionRef: string;
}

/** What the sale actually posts: the same shape the API takes. */
export interface SplitPayment {
  method: string;
  amount: number;
  bankId?: string;
  cardNo?: string;
  transactionRef?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** The bill being settled. The rows must add up to exactly this. */
  payable: number;
  banks: PosBank[];
  /** Rows to open with — the split already on the sale, when re-opening. */
  initial?: SplitRow[];
  onConfirm: (payments: SplitPayment[]) => void;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toFixed(2);
const blankRow = (method = "Cash"): SplitRow => ({ method, amount: "", bankId: "", cardNo: "", transactionRef: "" });

/**
 * Splits one bill across several tenders — 2000 paid as 1500 cash + 500 card.
 *
 * The running "Remaining" is the whole point of the screen: the cashier keys
 * what they took in each form and watches it fall to zero. Confirm stays
 * disabled until it is exactly zero, because a split that does not add up puts
 * the difference nowhere — the server refuses it for the same reason.
 */
export default function PaymentSplitModal({ open, onClose, payable, banks, initial, onConfirm }: Props) {
  const [rows, setRows] = useState<SplitRow[]>([blankRow()]);

  useEffect(() => {
    if (!open) return;
    // Reopening shows the split already on the bill; a fresh one starts with a
    // single Cash row pre-filled with the whole amount, which is one keystroke
    // away from the common "most of it in cash" case.
    setRows(initial?.length ? initial.map((r) => ({ ...r })) : [{ ...blankRow(), amount: fmt(payable) }]);
  }, [open, initial, payable]);

  const entered = useMemo(
    () => r2(rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)),
    [rows],
  );
  const remaining = r2(payable - entered);
  const balanced = Math.abs(remaining) < 0.005;
  const overpaid = remaining < -0.005;

  const setRow = (i: number, patch: Partial<SplitRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  /** A new row is pre-filled with what is still owed, so the common two-tender
   *  case needs no arithmetic from the cashier. */
  const addRow = () => {
    const left = r2(payable - entered);
    setRows((rs) => [...rs, { ...blankRow(rs.some((r) => r.method === "Cash") ? "Card" : "Cash"), amount: left > 0 ? fmt(left) : "" }]);
  };

  const removeRow = (i: number) => setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i)));

  const handleConfirm = () => {
    const payments: SplitPayment[] = rows
      .map((r) => ({
        method: r.method,
        amount: r2(parseFloat(r.amount) || 0),
        bankId: r.method === "Card" && r.bankId ? r.bankId : undefined,
        cardNo: r.method === "Card" && r.cardNo.trim() ? r.cardNo.trim() : undefined,
        transactionRef: r.transactionRef.trim() || undefined,
      }))
      .filter((p) => p.amount > 0);
    onConfirm(payments);
  };

  const cardNoInvalid = rows.some((r) => r.method === "Card" && r.cardNo.trim() && r.cardNo.trim().length !== 4);

  return (
    <Modal open={open} onClose={onClose} title="Split Payment">
      <div className="mb-4 flex items-center justify-between rounded-md border border-sage-300 bg-white px-3 py-2">
        <span className="text-sm text-gray-600">Bill total</span>
        <span className="text-lg font-semibold text-primary-900">৳ {fmt(payable)}</span>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-md border border-sage-300 bg-white p-3">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <Select
                  label={i === 0 ? "Payment Type" : undefined}
                  value={row.method}
                  onChange={(e) => {
                    const method = e.target.value;
                    // Leaving Card drops its fields, same rule the single-payment
                    // panel follows.
                    setRow(i, method === "Card" ? { method } : { method, bankId: "", cardNo: "" });
                  }}
                  options={POS_PAY_MODES.map((m) => ({ value: m, label: m }))}
                />
              </div>
              <div className="col-span-5">
                <Input
                  label={i === 0 ? "Amount" : undefined}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={row.amount}
                  onChange={(e) => setRow(i, { amount: e.target.value })}
                />
              </div>
              <div className="col-span-2 flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  aria-label={`Remove payment ${i + 1}`}
                  className="mb-1 rounded p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {row.method === "Card" && (
                <>
                  <div className="col-span-6">
                    <Select
                      label="Bank"
                      value={row.bankId}
                      onChange={(e) => setRow(i, { bankId: e.target.value })}
                      options={[{ value: "", label: "Select bank" }, ...banks.map((b) => ({ value: b.id, label: b.name }))]}
                    />
                  </div>
                  <div className="col-span-6">
                    <Input
                      label="Card No (last 4)"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="1234"
                      value={row.cardNo}
                      onChange={(e) => setRow(i, { cardNo: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    />
                  </div>
                </>
              )}

              <div className="col-span-12">
                <Input
                  label="Reference (optional)"
                  placeholder="bKash trxID / approval code"
                  value={row.transactionRef}
                  onChange={(e) => setRow(i, { transactionRef: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-900"
      >
        <Plus size={16} /> Add Payment Split
      </button>

      <div className="mt-4 flex items-center justify-between rounded-md border px-3 py-2 text-sm font-medium"
        style={undefined}
      >
        <span className="text-gray-600">Entered</span>
        <span className="text-gray-900">৳ {fmt(entered)}</span>
      </div>
      <div
        className={`mt-2 flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold ${
          balanced
            ? "bg-green-50 text-green-800"
            : overpaid
              ? "bg-red-50 text-red-700"
              : "bg-amber-50 text-amber-800"
        }`}
      >
        <span>{overpaid ? "Over by" : "Remaining"}</span>
        <span>৳ {fmt(Math.abs(remaining))}</span>
      </div>
      {cardNoInvalid && (
        <p className="mt-2 text-xs text-red-600">Card No must be the last 4 digits.</p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} disabled={!balanced || cardNoInvalid}>
          Confirm Split
        </Button>
      </div>
    </Modal>
  );
}
