"use client";

import React from "react";

interface ActionTooltipProps {
  label: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

export function ActionTooltip({ label, children }: ActionTooltipProps) {
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      "aria-label": label,
      title: label,
    });
  }
  return (
    <span aria-label={label} title={label}>
      {children}
    </span>
  );
}
