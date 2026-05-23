"use client";

import Link from "next/link";
import { ArrowRight, Building2, GitBranch, Shield, Store, UserCog } from "lucide-react";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";

type AccountMetaCardProps = {
  organizationName: string;
  roleLabel: string;
  statusLabel: string;
  workspaceDescriptor: string;
  orgPath?: string | null;
  orgId?: string | null;
  organizationsHref?: string;
};

export default function AccountMetaCard({
  organizationName,
  roleLabel,
  statusLabel,
  workspaceDescriptor,
  orgPath,
  orgId,
  organizationsHref,
}: AccountMetaCardProps) {
  const items = [
    { label: "Organization", value: organizationName || "—", icon: Building2 },
    { label: "Role", value: roleLabel || "—", icon: Shield },
    { label: "Workspace Status", value: statusLabel || "—", icon: Store },
    { label: "Account Type", value: workspaceDescriptor || "—", icon: UserCog },
    ...(orgPath ? [{ label: "Organization Path", value: orgPath, icon: GitBranch }] : []),
    ...(orgId ? [{ label: "Organization ID", value: orgId, icon: Building2 }] : []),
  ];

  return (
    <AdminSectionCard
      title="Organization & Account Context"
      description="Useful operational metadata about your current admin scope."
      bodyClassName="space-y-4 p-5 sm:p-6"
    >
      <div className="space-y-3">
        {items.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
          >
            <div className="rounded-xl bg-white p-2 shadow-sm">
              <Icon className="h-4 w-4 text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                {label}
              </p>
              <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {organizationsHref ? (
        <Link
          href={organizationsHref}
          className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-blue-700 transition hover:text-blue-800"
        >
          View Organization Directory
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </AdminSectionCard>
  );
}
