export interface UserPermission {
  userId: string;
  controlName: string;
  isEnable?: string;
  addAccess?: string;
  editAccess?: string;
  deleteAccess?: string;
}

export interface User {
  id: string;
  name: string | null;
  userName: string;
  branchId: string;
  branchName?: string;
  branch?: Branch;
  isActive?: string;
  permissions?: UserPermission[];
}

export interface Branch {
  id: number;
  branchCode: string;
  branchName: string;
  address?: string;
  vatNo?: string;
  mobileNo?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export interface Item {
  id: number;
  itmCode: string;
  itmName?: string;
  itmCategory?: string;
  itmType?: string;
  itmUOM?: string;
  isActive?: string;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  mobile?: string;
  address?: string;
  email?: string;
}

export interface SaleItem {
  itemId: number;
  itemCode: string;
  itemName?: string;
  quantity: number;
  rate: number;
  discount: number;
  vat: number;
  total: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface MenuPermission {
  controlName: string;
  isEnable: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
