"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useAuth } from "@/lib/auth";
import { UserProfileDialog } from "@/components/user-profile-dialog";

const pageTitles: Record<string, string> = {
  "/dashboard": "Tổng quan",
  "/products": "Sản phẩm & Kho",
  "/inventory": "Sổ nhật ký Tồn kho",
  "/customers": "Khách hàng",
  "/quotations": "Báo giá",
  "/contracts": "Hợp đồng",
  "/payments": "Thanh toán & Công nợ",
  "/templates": "Mẫu tài liệu",
  "/emails": "Email & Lịch sử gửi",
  "/settings": "Cài đặt",
};

export function AppHeader() {
  const pathname = usePathname();
  const { session } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [customName, setCustomName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sellflow_admin_name");
      if (saved) setCustomName(saved);
    }
  }, []);

  const title = pageTitles[pathname] ?? "Tổng quan";
  const userEmail = session?.user?.email ?? "admin@sellflow.vn";
  const displayName = customName || session?.user?.user_metadata?.name || "Quản trị viên";

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-1 h-4" />
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* 1. Chuyển ngữ (EN / VN border button) - Tạm ẩn theo yêu cầu */}
        {/* <LanguageToggle /> */}

        {/* 2. Chuyển màu giao diện (Sun/Moon border button) */}
        <ModeToggle />

        {/* Đường vạch phân cách giữa (Chuyển ngữ - Giao diện) và (Tài khoản) */}
        <div className="h-6 w-[1px] bg-border mx-1 shrink-0" aria-hidden="true" />

        {/* 3. Khung thông tin tài khoản kiểu Pill card */}
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2.5 rounded-xl bg-transparent px-3 py-1 hover:bg-slate-100/90 dark:hover:bg-zinc-800/80 transition-all text-left cursor-pointer border border-transparent hover:border-border focus:outline-none focus:ring-2 focus:ring-ring"
          title="Xem & chỉnh sửa thông tin tài khoản"
        >
          <Avatar className="size-8 border border-background shadow-xs">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden flex-col leading-snug sm:flex">
            <span className="text-xs font-semibold text-foreground truncate max-w-[150px]">
              {displayName}
            </span>
            <span className="text-[11px] text-sky-600 dark:text-sky-400 font-normal truncate max-w-[160px]">
              {userEmail}
            </span>
          </div>
        </button>

        {/* Modal chỉnh sửa thông tin tài khoản */}
        <UserProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          userName={displayName}
          userEmail={userEmail}
          onUpdateName={(newName) => setCustomName(newName)}
        />
      </div>
    </header>
  );
}

