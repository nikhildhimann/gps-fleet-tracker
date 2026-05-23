"use client";

import { Building2, Camera, Loader2 } from "lucide-react";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";
import AdminStatusBadge from "@/components/admin/UI/AdminStatusBadge";

type OrganizationBrandingCardProps = {
  organizationName: string;
  logoUrl?: string | null;
  workspaceDescriptor: string;
  canEditLogo: boolean;
  isUpdatingLogo: boolean;
  onLogoChange: (file: File) => void;
};

export default function OrganizationBrandingCard({
  organizationName,
  logoUrl,
  workspaceDescriptor,
  canEditLogo,
  isUpdatingLogo,
  onLogoChange,
}: OrganizationBrandingCardProps) {
  return (
    <AdminSectionCard
      title="Organization Branding"
      description="Your organization identity, logo presence, and workspace branding state."
      bodyClassName="space-y-5 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${organizationName} logo`}
              className="h-full w-full object-contain p-3"
            />
          ) : (
            <Building2 className="h-10 w-10 text-slate-300" />
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
            Workspace Identity
          </p>
          <h3 className="break-words text-xl font-black tracking-tight text-slate-950">
            {organizationName || "Organization"}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone="info">{workspaceDescriptor}</AdminStatusBadge>
            <AdminStatusBadge tone={logoUrl ? "success" : "neutral"}>
              {logoUrl ? "Logo configured" : "No logo uploaded"}
            </AdminStatusBadge>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-600">
        {canEditLogo
          ? "Branding updates are enabled for this workspace. Uploading a new logo updates only the organization branding asset."
          : "Branding is visible here in read-only mode for your current workspace scope."}
      </div>

      {canEditLogo ? (
        <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50 sm:w-auto">
          {isUpdatingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {isUpdatingLogo ? "Updating Logo" : "Change Logo"}
          <input
            type="file"
            className="hidden"
            accept="image/*"
            disabled={isUpdatingLogo}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onLogoChange(file);
              event.target.value = "";
            }}
          />
        </label>
      ) : null}
    </AdminSectionCard>
  );
}

