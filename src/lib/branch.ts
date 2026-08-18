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
