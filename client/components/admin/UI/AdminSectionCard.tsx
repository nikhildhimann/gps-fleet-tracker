"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

type AdminSectionCardProps = {
  children: ReactNode;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export default function AdminSectionCard({
  children,
  title,
  description,
  action,
  className,
  bodyClassName,
}: AdminSectionCardProps) {
  return (
    <section
      className={clsx(
        "rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      {(title || description || action) && (
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-base font-black text-slate-900">{title}</h2> : null}
            {description ? (
              <div className="text-sm font-medium leading-6 text-slate-500">{description}</div>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      )}
      <div className={clsx("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
