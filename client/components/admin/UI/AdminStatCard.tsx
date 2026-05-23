"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

type AdminStatCardProps = {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: "blue" | "green" | "amber" | "violet" | "slate";
  meta?: ReactNode;
  className?: string;
  href?: string;
};

const tones = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default function AdminStatCard({
  label,
  value,
  icon,
  tone = "blue",
  meta,
  className,
  href,
}: AdminStatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
            {label}
          </p>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</div>
          {meta ? <div className="mt-2 text-sm font-medium text-slate-500">{meta}</div> : null}
        </div>
        <div className={clsx("flex h-12 w-12 items-center justify-center rounded-2xl ring-1", tones[tone])}>
          {icon}
        </div>
      </div>
    </>
  );

  const sharedClassName = clsx(
    "rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]",
    href && "group block cursor-pointer transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10",
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={sharedClassName}
        aria-label={`Open ${label}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={clsx(
        sharedClassName,
      )}
    >
      {content}
    </div>
  );
}
