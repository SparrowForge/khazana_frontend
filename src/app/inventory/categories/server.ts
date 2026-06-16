import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Category {
  id: number;
  code: string;
  name?: string;
  remarks?: string;
}

export interface CategoryPayload {
  code: string;
  name?: string;
  remarks?: string;
}

export const fetchCategories = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Category>> =>
  api.get(`/categories?page=${page}&limit=${limit}`).then(unwrapPaginated<Category>);

export const fetchAllCategories = (): Promise<Category[]> =>
  api.get("/categories?limit=500").then(unwrapList<Category>);

export const createCategory = (data: CategoryPayload) =>
  api.post<Category>("/categories", data).then((r) => r.data);

export const updateCategory = (id: number, data: Partial<CategoryPayload>) =>
  api.patch<Category>(`/categories/${id}`, data).then((r) => r.data);

export const deleteCategory = (id: number) =>
  api.delete(`/categories/${id}`).then((r) => r.data);
