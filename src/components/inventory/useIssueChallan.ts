"use client";
import { useEffect, useState } from "react";
import { fetchBranches, type BranchOption, type IssueGroup } from "@/app/inventory/issue/server";
import { fetchSettings, type Settings } from "@/app/admin/settings/server";
import { useAuthStore } from "@/store/auth.store";
import type { DeliveryChallanData, DeliveryChallanLine } from "@/lib/export/deliveryChallanDocument";

/**
 * Everything a Stock Issue screen needs to name a branch and assemble the
 * Delivery Challan: the branch list, the company letterhead and the session
 * user who prepared the document.
 *
 * Shared so the entry form's Preview, the list page's report and the full-page
 * Item Issue screen all build the identical document — a challan assembled
 * twice is a challan that drifts.
 */
export function useIssueChallan() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  /** Letterhead only — a failure here still leaves a printable challan, just
   *  with the fallback company name. */
  const [settings, setSettings] = useState<Settings | null>(null);
  const sessionUser = useAuthStore((st) => st.user);

  useEffect(() => {
    fetchBranches().then(setBranches).catch(() => {});
    fetchSettings().then(setSettings).catch(() => {});
  }, []);

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.branchName ?? "-";
  const branchAddress = (id?: string) => branches.find((b) => b.id === id)?.address || undefined;

  /** The Delivery Challan header, from whichever document is on screen. The
   *  challan shows both the issuing branch (From) and receiving outlet (To). */
  const buildChallan = (opts: {
    challanNo: string;
    issueDate: string | Date;
    issueBranchId?: string;
    receiveBranchId?: string;
    items: DeliveryChallanLine[];
  }): DeliveryChallanData => ({
    companyName: settings?.companyName || "Khazana Mithai",
    companyAddress: settings?.companyAddress || undefined,
    fromBranchName: branchName(opts.issueBranchId),
    // The challan is the ISSUING branch's document, so its address heads it.
    letterheadAddress: branchAddress(opts.issueBranchId),
    toBranchName: branchName(opts.receiveBranchId),
    challanNo: opts.challanNo,
    issueDate: opts.issueDate,
    preparedBy: sessionUser?.name || sessionUser?.userName || undefined,
    items: opts.items,
  });

  /** A saved document's challan — same builder, lines straight off the record. */
  const savedChallan = (doc: IssueGroup): DeliveryChallanData =>
    buildChallan({
      challanNo: doc.voucherNo || doc.serialNo,
      issueDate: doc.issueDate ?? "",
      issueBranchId: doc.issueBranchId,
      receiveBranchId: doc.receiveBranchId,
      items: doc.items.map((it) => ({ itemName: it.itemName ?? "-", uom: it.uom, qty: Number(it.qty ?? 0) })),
    });

  return { branches, settings, sessionUser, branchName, branchAddress, buildChallan, savedChallan };
}
