import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface NavMenu {
  id: string;
  menuName: string;
  controlName: string;
  parentMenu: string | null;
  order: number | null;
  module: string | null;
  isActive: boolean | null;
}

/** Full ordered menu list (non-paginated) used to build the navigation tree. */
export const fetchNavMenus = (): Promise<NavMenu[]> =>
  api.get<{ data: NavMenu[] } | NavMenu[]>("/menus/nav").then(unwrapList<NavMenu>);
