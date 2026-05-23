"use client";

import { Building2, Mail, ShieldCheck, User2, WalletCards } from "lucide-react";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";
import AdminStatusBadge from "@/components/admin/UI/AdminStatusBadge";

type SummaryItem = {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
};

type ProfileSummaryStripProps = {
  name: string;
  roleLabel: string;
  organizationName: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "danger" | "info" | "neutral";
  email?: string | null;
  lastUpdated?: string | null;
  lastLogin?: string | null;
};

export default function ProfileSummaryStrip({
  name,
  roleLabel,
  organizationName,
  statusLabel,
  statusTone,
  email,
  lastUpdated,
  lastLogin,
}: ProfileSummaryStripProps) {
  const items: SummaryItem[] = [
    { label: "Admin", value: name || "—", icon: User2 },
    { label: "Role", value: roleLabel || "—", icon: ShieldCheck },
    { label: "Organization", value: organizationName || "—", icon: Building2 },
    ...(email ? [{ label: "Email", value: email, icon: Mail }] : []),
    ...(lastUpdated ? [{ label: "Last updated", value: lastUpdated, icon: WalletCards }] : []),
    ...(lastLogin ? [{ label: "Last login", value: lastLogin, icon: WalletCards }] : []),
  ];

  return (
    <AdminSectionCard
      title="Profile Overview"
      description="A live summary of your account identity, access level, and workspace context."
      bodyClassName="space-y-5 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <AdminStatusBadge tone={statusTone}>{statusLabel}</AdminStatusBadge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
          >
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
              <Icon className="h-4 w-4 text-slate-500" />
              <span>{label}</span>
            </div>
            <p className="mt-3 break-words text-sm font-bold text-slate-900 sm:text-[15px]">
              {value}
            </p>
          </div>
        ))}
      </div>
    </AdminSectionCard>
  );
}

