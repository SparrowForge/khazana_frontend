// Offline invoice number construction.
//
// Pattern: [UserPrefix]-[UnixTimestampSeconds]-[OfflineSequence]
//   e.g. MZ01-1782560700-001
//
// Uniqueness reasoning: the user prefix is globally unique (DB-enforced), the
// unix timestamp disambiguates across days/sessions, and the per-user sequence
// disambiguates multiple sales within the same second. Together they avoid the
// central-sequence collisions that plague multi-terminal offline checkout.

export function buildOfflineInvoiceNo(prefix: string, sequence: number, at: Date = new Date()): string {
  const ts = Math.floor(at.getTime() / 1000);
  const seq = String(sequence).padStart(3, "0");
  return `${prefix}-${ts}-${seq}`;
}

/** Fallback prefix when a user has no assigned `userPrefix` yet. Derives a short
 *  code from the username so offline sales still get a namespaced invoice. */
export function fallbackPrefix(userName: string): string {
  const cleaned = userName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (cleaned.slice(0, 4) || "POS");
}
