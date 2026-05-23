"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

type AdminPageShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export default function AdminPageShell({
  children,
  className,
  contentClassName,
}: AdminPageShellProps) {
  return (
    <div
      className={clsx(
        "relative flex min-h-[calc(100vh-7rem)] flex-col overflow-x-hidden overflow-y-visible rounded-[22px] border border-slate-200/80 bg-white/85 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[28px]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-slate-100 via-white to-blue-50" />
      <div className={clsx("relative flex-1 space-y-5 p-3 sm:space-y-6 sm:p-5 xl:p-8", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
