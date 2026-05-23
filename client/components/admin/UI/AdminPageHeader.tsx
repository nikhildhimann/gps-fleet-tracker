"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-4 rounded-[20px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:rounded-[24px] sm:p-5 lg:flex-row lg:items-start lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-black uppercase tracking-[0.34em] text-slate-400">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl lg:text-[30px]">
            {title}
          </h1>
          {description ? (
            <div className="max-w-3xl text-sm font-medium leading-6 text-slate-600">
              {description}
            </div>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex w-full flex-wrap items-stretch gap-3 lg:w-auto lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
