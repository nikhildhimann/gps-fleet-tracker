"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="max-w-md text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200">
            <AlertCircle size={28} />
          </div>
        </div>
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{description}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-[0.24em] text-white transition-colors hover:bg-slate-800"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
