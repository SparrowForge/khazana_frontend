import { SaleItem } from "@/types";

/** Catalogue fields the checks below need. Deliberately structural, so both the
 *  create and edit forms' own `AvailableItem` types satisfy it. */
export interface StockLookupItem {
  id: string;
  itmCode: string;
  itmName?: string;
  stock?: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : String(r2(n)));

const nameOf = (line: SaleItem, catalog: StockLookupItem[]) => {
  const meta = catalog.find((a) => a.id === line.itemId);
  return line.itemName || meta?.itmName || line.itemCode || meta?.itmCode || line.itemId;
};

/**
 * Items billed for more than Inventory can supply, summed per item so the same
 * item on two lines is judged against one balance.
 *
 * `heldStock` is the qty the document being edited already took out: on-hand
 * already has that deduction applied, so an amendment is measured against
 * (on hand + what it holds) — the same basis the server checks on.
 *
 * The item grid already refuses to over-commit, but lines can also arrive
 * wholesale (prefilled from a PO), so this is the check at the door.
 */
export function stockShortages(
  lines: SaleItem[],
  catalog: StockLookupItem[],
  heldStock?: Record<string, number>,
) {
  const wanted: Record<string, number> = {};
  for (const l of lines) wanted[l.itemId] = r2((wanted[l.itemId] ?? 0) + l.quantity);
  return Object.entries(wanted)
    .map(([itemId, qty]) => {
      const meta = catalog.find((a) => a.id === itemId);
      const available = r2((meta?.stock ?? 0) + (heldStock?.[itemId] ?? 0));
      return { name: meta?.itmName || meta?.itmCode || itemId, qty, stock: available };
    })
    .filter((r) => r.qty > r.stock);
}

/** Human-readable summary of a shortage list, for the toast. */
export const shortageMessage = (short: ReturnType<typeof stockShortages>) =>
  short.map((s) => `${s.name} (${fmtQty(s.stock)} left, ${fmtQty(s.qty)} billed)`).join(", ");

/**
 * Line-level problems that must never reach the server: a missing item, a
 * non-positive qty, a negative discount, or a discount bigger than the line
 * itself (which would invert the line total).
 */
export function lineProblems(lines: SaleItem[], catalog: StockLookupItem[]): string[] {
  const problems: string[] = [];
  lines.forEach((l, i) => {
    const label = `Line ${i + 1} (${nameOf(l, catalog)})`;
    if (!l.itemId) problems.push(`${label}: no item selected`);
    if (!Number.isFinite(l.quantity) || l.quantity <= 0) problems.push(`${label}: quantity must be greater than zero`);
    if (!Number.isFinite(l.rate) || l.rate <= 0) problems.push(`${label}: no price set for this item`);
    if (!Number.isFinite(l.discount) || l.discount < 0) problems.push(`${label}: discount can't be negative`);
    else if (r2(l.discount) > r2(l.rate * l.quantity)) problems.push(`${label}: discount exceeds the line value`);
  });
  return problems;
}
