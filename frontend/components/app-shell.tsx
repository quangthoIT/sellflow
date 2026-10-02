"use client";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LoginPage } from "@/views/login";

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="size-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="text-xs font-medium text-slate-500">Đang khởi động ứng dụng...</span>
        </div>
      </div>
    );
  }

  const isLoginPage = pathname === "/login";

  if (isLoginPage || !session) {
    return <LoginPage />;
  }

  return (
    <SidebarProvider className="h-svh min-h-0 w-full max-w-full overflow-x-hidden">
      <AppSidebar />
      <SidebarInset className="h-svh min-h-0 min-w-0 flex flex-col w-full max-w-full overflow-x-hidden">
        <AppHeader />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppContent>{children}</AppContent>
    </AuthProvider>
  );
}
