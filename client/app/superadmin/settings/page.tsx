"use client";

import Link from "next/link";
import { ArrowRight, Building2, Settings, Shield, Users } from "lucide-react";
import { useGetMeQuery, useGetUsersQuery } from "@/redux/api/usersApi";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";
import { formatDateTime, getCollection, getDisplayName } from "@/components/superadmin/superadmin-data";

export default function SettingsPage() {
  const { data: meData } = useGetMeQuery(undefined);
  const { data: orgData } = useGetOrganizationsQuery({ page: 0, limit: 1000 });
  const { data: usersData } = useGetUsersQuery(
    { page: 0, limit: 1000, role: "admin" }
  );

  const me = meData?.data;
  const organizations = getCollection(orgData, ["data", "docs", "organizations"]);
  const orgAdmins = getCollection(usersData, ["data", "docs", "users"]);

  return (
    <div className="space-y-6 pb-8 sm:space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">
          Environment Oversight
        </p>
        <h1 className="text-3xl font-black tracking-tight text-slate-100">Platform Context</h1>
        <p className="max-w-3xl text-sm font-medium text-slate-400 leading-6">
          Real-time visibility into the platform owner session, environment configuration, 
          and the scoped backend data footprint across all client organizations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[24px] border border-slate-800/80 bg-slate-900/65 p-5 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)]">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Identity & Session</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoCard label="Superadmin Identity" value={getDisplayName(me)} />
            <InfoCard label="System Role" value="Platform Owner" />
            <InfoCard label="Primary Email" value={me?.email || "No email linked"} />
            <InfoCard label="Session Status" value="Secure Admin Link" />
            <InfoCard label="Account Reference" value={me?._id || "No UID"} />
            <InfoCard label="Last Login Trace" value={formatDateTime(me?.updatedAt) || "Recalling..."} />
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-800/80 bg-slate-900/65 p-5 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)]">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Platform Data Footprint</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoCard label="Managed Organizations" value={`${organizations.length}`} />
            <InfoCard label="Provisioned Org Admins" value={`${orgAdmins.length}`} />
            <InfoCard label="Global Fleet Visibility" value="All Assets" />
            <InfoCard label="Data Retention" value="System Defaults" />
          </div>
          <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
             <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70">Integration Status</p>
             <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Backend API</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">Connected</span>
             </div>
             <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Database Cluster</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">Stable</span>
             </div>
          </div>
        </section>
      </div>

      <section className="rounded-[24px] border border-slate-800/80 bg-slate-900/65 p-5 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)]">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Platform Governance</p>
          <h2 className="text-xl font-black text-slate-100">Governance & Control Policies</h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <NoteCard
            icon={Shield}
            text="Global administrative actions are auditable. Every change to organization state is logged in the system notification stream."
          />
          <NoteCard
            icon={Settings}
            text="System-wide configuration is currently environment-driven. Visual overrides for platform settings are pending backend logic."
          />
          <NoteCard
            icon={Users}
            text="User lifecycle management follows strict hierarchical rules: superadmins manage org-admin accounts; org-admins manage their fleet personnel."
          />
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-800/80 bg-slate-900/65 p-5 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)]">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Primary Control Modules</p>
          <h2 className="text-xl font-black text-slate-100">Direct Navigation</h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <SettingsLink
            href="/superadmin"
            icon={Settings}
            title="Dashboard Overview"
            description="Real-time aggregation of platform metrics and recent event logs."
          />
          <SettingsLink
            href="/superadmin/history"
            icon={Shield}
            title="Audit History"
            description="Searchable log of all critical platform and organization-level events."
          />
          <SettingsLink
            href="/superadmin/organizations"
            icon={Building2}
            title="Entity Management"
            description="Onboard and maintain the full lifecycle of client organizations."
          />
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function NoteCard({
  icon: Icon,
  text,
}: {
  icon: typeof Settings;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-200">
        <Icon size={18} />
      </div>
      <p className="mt-3 text-sm font-medium leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function SettingsLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Settings;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-emerald-500/25 hover:bg-slate-950"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-200">
        <Icon size={18} />
      </div>
      <p className="mt-3 text-sm font-black text-slate-100">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">
        Open
        <ArrowRight size={14} />
      </span>
    </Link>
  );
}
