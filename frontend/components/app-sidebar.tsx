"use client";
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  FileSignature,
  Wallet,
  FileEdit,
  Mail,
  Store,
  Settings,
  LogOut,
} from "lucide-react";
import { useNav, type Page } from "@/lib/nav";
import { useAuth } from "@/lib/auth";
import { loadSettings, getCachedSettings } from "@/lib/supabase";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navItems: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { page: "products", label: "Sản phẩm & Kho", icon: Package },
  { page: "customers", label: "Khách hàng", icon: Users },
  { page: "quotes", label: "Báo giá", icon: FileText },
  { page: "contracts", label: "Hợp đồng", icon: FileSignature },
  { page: "payments", label: "Thanh toán", icon: Wallet },
  { page: "templates", label: "Mẫu tài liệu", icon: FileEdit },
  { page: "email", label: "Email", icon: Mail },
  { page: "settings", label: "Cài đặt", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { navigate } = useNav();
  const { signOut } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const getActivePage = (currentPath: string): Page => {
    if (currentPath.startsWith("/products") || currentPath.startsWith("/inventory")) return "products";
    if (currentPath.startsWith("/customers")) return "customers";
    if (currentPath.startsWith("/quotations") || currentPath.startsWith("/quotes")) return "quotes";
    if (currentPath.startsWith("/contracts")) return "contracts";
    if (currentPath.startsWith("/payments")) return "payments";
    if (currentPath.startsWith("/templates")) return "templates";
    if (currentPath.startsWith("/emails") || currentPath.startsWith("/email")) return "email";
    if (currentPath.startsWith("/settings")) return "settings";
    return "dashboard";
  };

  const activePage = getActivePage(pathname);

  useEffect(() => {
    const refreshLogo = () => {
      loadSettings().then((s) => setLogoUrl(s.logo_url || null));
    };
    setLogoUrl(getCachedSettings().logo_url || null);
    refreshLogo();
    window.addEventListener("app-settings-updated", refreshLogo);
    return () => window.removeEventListener("app-settings-updated", refreshLogo);
  }, []);

  const handleNavClick = (targetPage: Page) => {
    navigate(targetPage);
    const targetPath =
      targetPage === "email"
        ? "/emails"
        : targetPage === "quotes"
        ? "/quotations"
        : `/${targetPage}`;
    router.push(targetPath);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3.5 border-b border-sidebar-border group-data-[collapsible=icon]:!p-3.5 group-data-[collapsible=icon]:!justify-center">
        <div className="flex items-center gap-3 px-1 py-1 group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!justify-center">
          <div className="flex aspect-square size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-xs group-data-[collapsible=icon]:!size-10">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain shrink-0" />
            ) : (
              <Store className="size-5 shrink-0" />
            )}
          </div>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-bold tracking-tight text-foreground">SellFlow</span>
            <span className="truncate text-xs text-muted-foreground">Quản lý bán hàng</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-3 group-data-[collapsible=icon]:!px-3.5 group-data-[collapsible=icon]:!py-3.5">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.page} className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                  <SidebarMenuButton
                    isActive={activePage === item.page}
                    onClick={() => handleNavClick(item.page)}
                    tooltip={item.label}
                    className="h-11 px-3.5 py-2.5 text-sm font-medium"
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:!px-3.5 group-data-[collapsible=icon]:!py-3.5">
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton onClick={signOut} tooltip="Đăng xuất" className="h-11 px-3.5 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="size-5 shrink-0" />
              <span>Đăng xuất</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
