"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

type AdminStatusBadgeProps = {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
};

const toneClasses = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
};

export default function AdminStatusBadge({
  children,
  tone = "neutral",
  className,
}: AdminStatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em]",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
