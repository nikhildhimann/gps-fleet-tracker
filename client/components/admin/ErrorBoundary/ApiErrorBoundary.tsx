"use client";

import { AlertCircle } from "lucide-react";
import React from "react";

interface ApiErrorBoundaryProps {
  children: React.ReactNode;
  hasError: boolean;
  errorMessage?: string;
}

export default function ApiErrorBoundary({
  children,
  hasError,
  errorMessage = "Unable to load data. Backend API may not be running.",
}: ApiErrorBoundaryProps) {
  if (hasError) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-8 shadow-[0_10px_30px_rgba(245,158,11,0.08)]">
        <div className="max-w-md text-center">
          <div className="mb-5 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              <AlertCircle size={28} />
            </div>
          </div>
          <h3 className="text-lg font-black text-amber-950">API Unavailable</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-amber-800">{errorMessage}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
            Make sure your Node.js backend is running on port 5000
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
