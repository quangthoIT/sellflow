"use client";
import { useState, type ReactNode } from "react";
import { TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc" | null;

export interface ColumnFilter {
  type: "text" | "select";
  value: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

interface SortableHeadProps {
  label: string;
  sortDir: SortDir;
  onSort: (dir: SortDir) => void;
  filter?: ColumnFilter;
  onFilterChange?: (value: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
}

export function SortableHead({
  label,
  sortDir,
  onSort,
  align = "left",
  className,
}: SortableHeadProps) {
  const toggleSort = () => {
    if (sortDir === null) onSort("asc");
    else if (sortDir === "asc") onSort("desc");
    else onSort(null);
  };

  return (
    <TableHead className={cn(align === "right" && "text-right", align === "center" && "text-center", className)}>
      <div className={cn("flex items-center gap-1", align === "right" && "justify-end", align === "center" && "justify-center")}>
        <button
          type="button"
          onClick={toggleSort}
          className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer select-none"
        >
          {label}
          {sortDir === "asc" && <ArrowUp className="size-3.5 text-primary" />}
          {sortDir === "desc" && <ArrowDown className="size-3.5 text-primary" />}
          {sortDir === null && <ArrowUpDown className="size-3.5 text-muted-foreground/50" />}
        </button>
      </div>
    </TableHead>
  );
}

export function sortData<T>(data: T[], key: keyof T | ((row: T) => string | number), dir: SortDir): T[] {
  if (!dir) return data;
  const accessor = typeof key === "function" ? key : (row: T) => row[key] as unknown as string | number;
  return [...data].sort((a, b) => {
    const va = accessor(a);
    const vb = accessor(b);
    if (va === vb) return 0;
    const cmp = va > vb ? 1 : -1;
    return dir === "asc" ? cmp : -cmp;
  });
}

export function filterData<T>(data: T[], filters: { key: keyof T | ((row: T) => string); value: string }[]): T[] {
  return data.filter((row) =>
    filters.every((f) => {
      if (!f.value) return true;
      const accessor = typeof f.key === "function" ? f.key : (row: T) => String(row[f.key as keyof T]);
      return accessor(row).toLowerCase().includes(f.value.toLowerCase());
    })
  );
}

export type { ReactNode };
