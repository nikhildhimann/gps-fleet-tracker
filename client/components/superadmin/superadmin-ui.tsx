"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Info } from "lucide-react";
import { formatStatus } from "./superadmin-data";

export function StatusBadge({
  value,
  activeValue = "active",
}: {
  value?: string | null;
  activeValue?: string;
}) {
  const normalized = (value || "").toLowerCase();
  const isActive = normalized === activeValue.toLowerCase();

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
        isActive
          ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200"
          : "border-rose-500/30 bg-rose-500/20 text-rose-200"
      }`}
    >
      {formatStatus(value)}
    </span>
  );
}

export function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-800/80 bg-slate-900/65 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)]">
      <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-50">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number | string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-50">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-400">{helper}</p>
    </div>
  );
}

export function StateBlock({
  title,
  description,
  tone = "default",
}: {
  title: string;
  description: string;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={`rounded-[24px] border p-6 ${
        tone === "danger"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
          : "border-slate-800/80 bg-slate-900/65 text-slate-300"
      }`}
    >
      <p className="text-base font-black">{title}</p>
      <p className="mt-2 text-sm leading-6 opacity-90">{description}</p>
    </div>
  );
}

export function DisabledFeaturePill({
  label,
  helper,
}: {
  label: string;
  helper: string;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-left text-xs font-semibold text-amber-100">
      <Info size={14} className="shrink-0" />
      <span>
        <span className="font-black uppercase tracking-[0.18em]">{label}</span>
        <span className="ml-2 text-amber-100/80 normal-case tracking-normal">{helper}</span>
      </span>
    </div>
  );
}

export function ActionLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-200 transition hover:text-emerald-100"
    >
      {label}
      <ArrowRight size={14} />
    </Link>
  );
}
