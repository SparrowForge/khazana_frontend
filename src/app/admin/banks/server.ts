import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Bank {
  id: string;
  name?: string;
  createBy?: string;
  createDate?: string;
}

export const fetchBanks = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Bank>> =>
  api.get(`/admin/banks?page=${page}&limit=${limit}`).then(unwrapPaginated<Bank>);

export const createBank = (name: string) =>
  api.post<Bank>("/admin/banks", { name }).then((r) => r.data);

export const updateBank = (id: string, name: string) =>
  api.patch<Bank>(`/admin/banks/${id}`, { name }).then((r) => r.data);

export const deleteBank = (id: string) =>
  api.delete(`/admin/banks/${id}`).then((r) => r.data);
