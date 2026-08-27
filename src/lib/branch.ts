/**
 * Factory-branch detection, shared by the sidebar, the route guard and any
 * factory-only page.
 *
 * There is no `isFactory` column on Branch, so the factory is identified by
 * convention on its code/name — the same convention the Demand Order screen
 * uses and the mirror of `isFactoryBranch` in the backend's branch.helper.ts,
 * which has the final say. Live data has code 'FAC' / name 'Factory';
 * prisma/seed.ts creates code 'Factory' / name 'Factory'.
 *
 * `branchCode` was added to the login payload after this feature; sessions
 * created before that only carry `branchName`, which is why either field
 * qualifies.
 */
export function isFactoryBranch(branch?: { branchCode?: string | null; branchName?: string | null } | null): boolean {
  if (!branch) return false;
  const code = (branch.branchCode ?? "").trim();
  const name = (branch.branchName ?? "").trim();
  return /^fac(tory)?$/i.test(code) || /factory/i.test(name);
}

/** The order branches are read in on the printed factory forms:
 *  Gulshan-1, Gulshan-2, Banani, Uttara, Kolabagan, Khilgaon.
 *
 *  Mirror of BRANCH_DISPLAY_ORDER in the backend's branch.helper.ts, which
 *  orders the report columns themselves; this copy is only for the pickers that
 *  sit above a report, so the filter reads in the same sequence as the sheet
 *  below it. Keep the two in step.
 *
 *  Matched on normalised CODE first ('GMS-2' and 'GMS2' are the same branch),
 *  then on NAME. The name fallback is what keeps this working when a code is
 *  edited from the Branches page — these have already changed once. A branch
 *  matching neither sorts last, so the Factory and any newly opened branch
 *  appear at the end rather than vanishing from the picker. */
export const BRANCH_DISPLAY_ORDER: { codes: string[]; name: RegExp }[] = [
  { codes: ["GMS1"], name: /gulshan[^\d]*1/i },
  { codes: ["GMS2"], name: /gulshan[^\d]*2/i },
  { codes: ["BMS"], name: /banani/i },
  { codes: ["UMS"], name: /uttara/i },
  { codes: ["KMS"], name: /kolabagan|kalabagan/i },
  { codes: ["KHMS", "KHILMS"], name: /khilgaon/i },
];

/** Position of a branch in {@link BRANCH_DISPLAY_ORDER}; unlisted branches rank last. */
export function branchDisplayRank(branch: { branchCode?: string | null; branchName?: string | null }): number {
  const code = (branch.branchCode ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const name = (branch.branchName ?? "").trim();
  const byCode = code ? BRANCH_DISPLAY_ORDER.findIndex((e) => e.codes.includes(code)) : -1;
  if (byCode !== -1) return byCode;
  const byName = name ? BRANCH_DISPLAY_ORDER.findIndex((e) => e.name.test(name)) : -1;
  return byName !== -1 ? byName : BRANCH_DISPLAY_ORDER.length;
}

/** Comparator putting branches in {@link BRANCH_DISPLAY_ORDER}; pass to `sort`. */
export function compareBranchesForDisplay(
  a: { branchCode?: string | null; branchName?: string | null },
  b: { branchCode?: string | null; branchName?: string | null },
): number {
  const byRank = branchDisplayRank(a) - branchDisplayRank(b);
  return byRank !== 0 ? byRank : (a.branchCode ?? "").localeCompare(b.branchCode ?? "");
}
