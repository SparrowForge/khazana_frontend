import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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


export const fetchCategories = () =>
  api.get<{ data: Category[] } | Category[]>("/categories").then(unwrapList<Category>);

export const createCategory = (data: CategoryPayload) =>
  api.post<Category>("/categories", data).then((r) => r.data);

export const updateCategory = (id: number, data: Partial<CategoryPayload>) =>
  api.patch<Category>(`/categories/${id}`, data).then((r) => r.data);

export const deleteCategory = (id: number) =>
  api.delete(`/categories/${id}`).then((r) => r.data);
