"use client";

import { Loader2 } from "lucide-react";

type AdminLoadingStateProps = {
  title?: string;
  description?: string;
  fullHeight?: boolean;
};

export default function AdminLoadingState({
  title = "Loading admin workspace",
  description = "Preparing data and interface sections.",
  fullHeight = false,
}: AdminLoadingStateProps) {
  return (
    <div
      className={`flex items-center justify-center ${fullHeight ? "min-h-[60vh]" : "min-h-[280px]"}`}
    >
      <div className="rounded-[24px] border border-slate-200 bg-white px-8 py-10 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <p className="mt-2 text-sm font-medium text-slate-500">{description}</p>
      </div>
    </div>
  );
}
