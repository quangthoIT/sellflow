"use client";

import React from "react";
import { LoaderCircle } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * 1. Page Loading Component: Circular Spinner centered with optional subtext
 */
export function PageLoading({
  text = "Đang tải dữ liệu...",
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 min-h-[320px] w-full",
        className
      )}
    >
      <LoaderCircle className="size-8 text-primary animate-spin stroke-[2.5]" />
      {text && <p className="mt-3 text-xs text-muted-foreground font-medium">{text}</p>}
    </div>
  );
}

/**
 * 2. Table Skeleton Loading Component: 5 animated skeleton rows keeping the table header intact
 */
export function TableSkeleton({
  rows = 5,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <TableRow key={rIdx} className="hover:bg-transparent">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <TableCell key={cIdx} className="py-4">
              <Skeleton
                className={cn(
                  "h-4 rounded-md bg-slate-200/90 dark:bg-zinc-800 animate-pulse",
                  cIdx === 0
                    ? "w-16"
                    : cIdx === columns - 1
                    ? "w-12 ml-auto"
                    : cIdx % 3 === 0
                    ? "w-2/3"
                    : cIdx % 2 === 0
                    ? "w-4/5"
                    : "w-full"
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
