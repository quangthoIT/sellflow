import { create } from "zustand";

export type Page =
  | "dashboard"
  | "products"
  | "customers"
  | "quotes"
  | "contracts"
  | "payments"
  | "templates"
  | "email"
  | "settings";

type NavState = {
  page: Page;
  params: Record<string, string>;
  navigate: (page: Page, params?: Record<string, string>) => void;
};

let globalRouter: any = null;

export const setGlobalRouter = (router: any) => {
  globalRouter = router;
};

export const useNav = create<NavState>((set) => ({
  page: "dashboard",
  params: {},
  navigate: (page, params = {}) => {
    set({ page, params });
    const targetPath =
      page === "email" ? "/emails" : page === "quotes" ? "/quotations" : `/${page}`;
    if (globalRouter) {
      globalRouter.push(targetPath);
    } else if (typeof window !== "undefined") {
      if (window.location.pathname !== targetPath) {
        window.location.href = targetPath;
      }
    }
  },
}));
