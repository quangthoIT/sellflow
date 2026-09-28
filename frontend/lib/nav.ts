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

export const useNav = create<NavState>((set) => ({
  page: "dashboard",
  params: {},
  navigate: (page, params = {}) => {
    set({ page, params });
    if (typeof window !== "undefined") {
      const targetPath = page === "email" ? "/emails" : page === "quotes" ? "/quotations" : `/${page}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, "", targetPath);
      }
    }
  },
}));
