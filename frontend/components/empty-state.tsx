"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileSearch } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ElementType;
  };
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: CustomIcon,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  const IconComponent = CustomIcon || FileSearch;
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center min-h-[280px] w-full",
        className
      )}
    >
      <IconComponent className="size-12 text-muted-foreground/60 stroke-[1.5]" />

      <h3 className="mt-3 text-base font-semibold text-foreground tracking-tight">
        {title}
      </h3>

      {description && (
        <p className="mt-1.5 text-xs text-muted-foreground max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {(action || children) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button onClick={action.onClick} className="gap-2">
              {ActionIcon && <ActionIcon className="size-4" />}
              {action.label}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
