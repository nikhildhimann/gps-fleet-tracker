"use client";

import { Mail, Shield, UserCircle2 } from "lucide-react";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";
import AdminStatusBadge from "@/components/admin/UI/AdminStatusBadge";

type ProfileIdentityCardProps = {
  initials: string;
  name: string;
  email?: string | null;
  roleLabel: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "danger" | "info" | "neutral";
  descriptor: string;
};

export default function ProfileIdentityCard({
  initials,
  name,
  email,
  roleLabel,
  statusLabel,
  statusTone,
  descriptor,
}: ProfileIdentityCardProps) {
  return (
    <AdminSectionCard
      title="Profile Identity"
      description="Your signed-in administrator identity and current workspace role."
      bodyClassName="space-y-5 p-5 sm:p-6"
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-blue-600 to-cyan-500 text-2xl font-black text-white shadow-[0_18px_30px_rgba(37,99,235,0.25)]">
          {initials}
        </div>

        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
            {descriptor}
          </p>
          <h2 className="break-words text-xl font-black tracking-tight text-slate-950">
            {name}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={statusTone}>{statusLabel}</AdminStatusBadge>
            <AdminStatusBadge tone="info">{roleLabel}</AdminStatusBadge>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <IdentityRow icon={Mail} label="Email Address" value={email || "—"} />
        <IdentityRow icon={Shield} label="Access Role" value={roleLabel || "—"} />
        <IdentityRow icon={UserCircle2} label="Account Status" value={statusLabel || "—"} />
      </div>
    </AdminSectionCard>
  );
}

function IdentityRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="rounded-xl bg-slate-100 p-2">
        <Icon className="h-4 w-4 text-slate-600" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

