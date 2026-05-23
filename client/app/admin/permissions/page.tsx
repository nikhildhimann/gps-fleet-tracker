import React from "react";
import { ShieldAlert } from "lucide-react";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";

const PermissionsPage = () => {
  return (
    <AdminPageShell className="max-w-4xl" contentClassName="space-y-6">
      <AdminPageHeader
        eyebrow="Security"
        title="Permissions"
        description="System permissions are managed at the SuperAdmin level."
      />
      <AdminSectionCard className="min-h-[420px]" bodyClassName="flex min-h-[360px] flex-col items-center justify-center p-6 text-center">
        <div className="mb-6 rounded-full bg-slate-50 p-6">
          <ShieldAlert size={48} className="text-slate-400" />
        </div>
        <h1 className="mb-2 text-2xl font-black uppercase tracking-tight text-slate-900">Access Restricted</h1>
        <p className="mx-auto max-w-sm font-medium text-slate-500">
          As an Admin, you do not have permission to modify system roles or access rights.
        </p>

        <div className="mt-8 flex gap-4">
          <div className="rounded-xl bg-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Role: ADMIN
          </div>
          <div className="rounded-xl bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-500">
            Status: FORBIDDEN
          </div>
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
};

export default PermissionsPage;
