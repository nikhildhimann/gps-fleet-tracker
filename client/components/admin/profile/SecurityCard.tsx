"use client";

import { KeyRound, LockKeyhole, ShieldAlert } from "lucide-react";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";
import AdminStatusBadge from "@/components/admin/UI/AdminStatusBadge";

type SecurityCardProps = {
  canChangePassword: boolean;
  lastPasswordUpdate?: string | null;
  lastLogin?: string | null;
};

export default function SecurityCard({
  canChangePassword,
  lastPasswordUpdate,
  lastLogin,
}: SecurityCardProps) {
  return (
    <AdminSectionCard
      title="Security"
      description="Password controls and account-access notes for this administrator account."
      bodyClassName="space-y-5 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge tone={canChangePassword ? "info" : "warning"}>
          {canChangePassword ? "Action available" : "Managed outside this page"}
        </AdminStatusBadge>
      </div>

      <div className="space-y-3">
        <SecurityRow
          icon={LockKeyhole}
          label="Password"
          value="••••••••••••"
          helper="Stored securely and never shown in plaintext."
        />
        {lastPasswordUpdate ? (
          <SecurityRow
            icon={KeyRound}
            label="Last password update"
            value={lastPasswordUpdate}
          />
        ) : null}
        {lastLogin ? (
          <SecurityRow
            icon={ShieldAlert}
            label="Last sign-in"
            value={lastLogin}
          />
        ) : null}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Change Password</p>
        <p className="mt-1 text-sm leading-6 text-amber-800">
          {canChangePassword
            ? "Use the existing admin password flow from this page."
            : "A dedicated password-change flow is not currently exposed in the admin frontend, so this page surfaces security context without inventing unsupported actions."}
        </p>
        <button
          type="button"
          disabled={!canChangePassword}
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-amber-300 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-amber-900 transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {canChangePassword ? "Change Password" : "Password Change Unavailable"}
        </button>
      </div>
    </AdminSectionCard>
  );
}

function SecurityRow({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-slate-100 p-2">
          <Icon className="h-4 w-4 text-slate-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
          {helper ? <p className="mt-1 text-xs font-medium text-slate-500">{helper}</p> : null}
        </div>
      </div>
    </div>
  );
}

