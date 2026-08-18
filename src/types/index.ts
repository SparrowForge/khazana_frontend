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
  /** Unique short cashier code used to namespace offline invoice numbers */
  userPrefix?: string | null;
  /** The branch selected at login time for the current session */
  branchId: string;
  branchName?: string | null;
  /** Branch code of the session branch; absent on sessions created before it
   *  was added to the login payload. See lib/branch.ts#isFactoryBranch. */
  branchCode?: string | null;
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
  itemId: string;
  itemCode: string;
  itemName?: string;
  quantity: number;
  rate: number;
  discount: number;
  /** VAT rate for the line, carried so qty/discount edits can re-derive `vat`.
   *  Display-only — the sale server actions map lines explicitly and drop it. */
  vatPercentage?: number;
  /** VAT amount, charged on the discounted (taxable) line value. */
  vat: number;
  /** Net line value excl. VAT — rate x qty - discount. */
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
