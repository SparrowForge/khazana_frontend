import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Branch {
  /** Branch PK is a uuid (Int -> uuid migration), not a number. */
  id: string;
  branchCode: string;
  branchName: string;
  address?: string;
  vatNo?: string;
  mobileNo?: string;
  /** Display position on the reports that show one column per branch. Lowest
   *  first; a branch without one sorts last. */
  sortingNo?: number | null;
}

export interface BranchPayload {
  branchCode: string;
  branchName: string;
  address?: string;
  vatNo?: string;
  mobileNo?: string;
  sortingNo?: number;
}

export const fetchBranches = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Branch>> =>
  api.get(`/admin/branches?page=${page}&limit=${limit}`).then(unwrapPaginated<Branch>);

/** Only the branches the signed-in user is mapped to, in display order.
 *  Every branch PICKER should use this — `fetchBranches` lists the whole
 *  company and belongs to the Branches maintenance screen. The report data
 *  itself is scoped server-side too, so a picker built from this can't ask for
 *  something the API would refuse. */
export const fetchMyBranches = (): Promise<Branch[]> =>
  api.get<{ branches: Branch[] }>("/auth/my-branches").then((r) => r.data?.branches ?? []);

export const createBranch = (data: BranchPayload) =>
  api.post<Branch>("/admin/branches", data).then((r) => r.data);

export const updateBranch = (id: string, data: Partial<BranchPayload>) =>
  api.patch<Branch>(`/admin/branches/${id}`, data).then((r) => r.data);
