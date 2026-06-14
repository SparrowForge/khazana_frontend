import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface Item {
  id: number;
  itmCode: string;
  itmName?: string;
  itmCategory?: string;
  itmType?: string;
  itmUOM?: string;
  isActive?: string;
  price?: number;
}

export interface ItemPayload {
  itmCode: string;
  itmName?: string;
  itmCategory?: string;
  itmType?: string;
  itmUOM?: string;
  isActive?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
}

export interface CategoryPayload {
  name: string;
  description?: string;
}


export const itemsService = {
  list: (limit = 500) =>
    api.get<{ data: Item[] } | Item[]>(`/items?limit=${limit}`).then(unwrapList<Item>),

  create: (data: ItemPayload) =>
    api.post<Item>("/items", data).then((r) => r.data),

  update: (id: number, data: Partial<ItemPayload>) =>
    api.patch<Item>(`/items/${id}`, data).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/items/${id}`).then((r) => r.data),

  listCategories: () =>
    api.get<{ data: Category[] } | Category[]>("/categories").then(unwrapList<Category>),

  createCategory: (data: CategoryPayload) =>
    api.post<Category>("/categories", data).then((r) => r.data),

  updateCategory: (id: number, data: Partial<CategoryPayload>) =>
    api.patch<Category>(`/categories/${id}`, data).then((r) => r.data),

  removeCategory: (id: number) =>
    api.delete(`/categories/${id}`).then((r) => r.data),
};
