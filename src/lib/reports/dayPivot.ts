import { formatCurrency } from "@/lib/utils";

/**
 * Shared helpers for the day-pivot factory sheets — Branchwise Delivery and
 * Monthly Production. Both print one column per day of the range over a bespoke
 * A4 landscape layout, so they share the column labelling, the cell formatting
 * and the default period; only their heading wording differs.
 *
 * Everything here works in UTC. The backend buckets rows by UTC day and returns
 * bare `YYYY-MM-DD` keys, so formatting in local time would drift a cell into
 * the neighbouring column for anyone east or west of UTC.
 */

/** DD-MMM-YYYY, the format used across the app. */
export const formatDate = (dateString: string | Date) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day}-${month}-${date.getUTCFullYear()}`;
};

/** True when the range covers exactly one whole calendar month, which is how
 *  the factory normally runs these sheets. */
export const isWholeMonth = (fromDate: string, toDate: string) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return (
    from.getUTCDate() === 1 &&
    from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth() &&
    to.getUTCDate() === new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)).getUTCDate()
  );
};

/** "August 2026" for the month a whole-month range sits in. */
export const monthName = (fromDate: string) => {
  const from = new Date(fromDate);
  return `${from.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${from.getUTCFullYear()}`;
};

/** The span half of a heading, for a range that is not a whole month. */
export const spanLabel = (fromDate: string, toDate: string) =>
  fromDate === toDate
    ? `On ${formatDate(fromDate)}`
    : `From ${formatDate(fromDate)} To ${formatDate(toDate)}`;

/** Day columns read as bare day numbers on a single-month sheet (1…31, as the
 *  legacy reports print them); a range straddling months needs the month too,
 *  or day 1 would appear twice with nothing to tell the two apart. */
export const dayHeader = (days: string[]) => {
  const months = new Set(days.map((d) => d.slice(0, 7)));
  return (iso: string) => {
    const d = new Date(iso);
    const day = d.getUTCDate();
    return months.size > 1 ? `${day}/${d.getUTCMonth() + 1}` : String(day);
  };
};

// A dash where nothing happened — these sheets are mostly empty cells, and
// zeros everywhere would drown the numbers that matter.
export const q = (n: number | undefined) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : v.toFixed(2);
};

export const amt = (n: number | undefined) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : formatCurrency(v);
};

/** Defaults to the current calendar month — the period these sheets are run
 *  for. Returned as the bare `YYYY-MM-DD` strings the date inputs want. */
export const getDefaultMonth = () => {
  const today = new Date();
  const first = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  const last = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0));
  return { fromDate: first.toISOString().split("T")[0], toDate: last.toISOString().split("T")[0] };
};
