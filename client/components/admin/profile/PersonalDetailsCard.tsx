"use client";

import { Loader2, Mail, Phone, Save, Shield, User2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";
import PhoneInputField from "@/components/common/PhoneInputField";

type PersonalDetailsFormData = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
};

type PersonalDetailsCardProps = {
  formData: PersonalDetailsFormData;
  errors: Record<string, string>;
  roleLabel: string;
  organizationName: string;
  isSubmitting: boolean;
  onBlur: (name: keyof PersonalDetailsFormData, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  setFormData: Dispatch<SetStateAction<PersonalDetailsFormData>>;
};

export default function PersonalDetailsCard({
  formData,
  errors,
  roleLabel,
  organizationName,
  isSubmitting,
  onBlur,
  onSubmit,
  setFormData,
}: PersonalDetailsCardProps) {
  return (
    <AdminSectionCard
      title="Personal Details"
      description="Update the personal information used across your admin workspace."
      bodyClassName="p-0"
    >
      <form onSubmit={onSubmit} className="space-y-6 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="First Name"
            value={formData.firstName}
            error={errors.firstName}
            onChange={(value) => setFormData((prev) => ({ ...prev, firstName: value }))}
            onBlur={(value) => onBlur("firstName", value)}
          />
          <Field
            label="Last Name"
            value={formData.lastName}
            error={errors.lastName}
            onChange={(value) => setFormData((prev) => ({ ...prev, lastName: value }))}
            onBlur={(value) => onBlur("lastName", value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ReadOnlyField
            label="Email Address"
            value={formData.email || "—"}
            icon={Mail}
            helper="Email is controlled by the current account authentication record."
          />
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
              <Phone className="h-3.5 w-3.5 text-slate-500" />
              Mobile Number
            </label>
            <PhoneInputField
              value={formData.mobile}
              onChange={(value) => setFormData((prev) => ({ ...prev, mobile: value }))}
              placeholder="Enter phone number"
              required
            />
            <FieldError error={errors.mobile} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ReadOnlyField
            label="Access Role"
            value={roleLabel || "—"}
            icon={Shield}
            helper="Role assignment is managed by your organization access model."
          />
          <ReadOnlyField
            label="Organization"
            value={organizationName || "—"}
            icon={User2}
            helper="Workspace identity is shared with your current organization."
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-500">
            Save changes here updates only your editable personal details.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </form>
    </AdminSectionCard>
  );
}

function Field({
  label,
  value,
  error,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur?.(event.target.value)}
        className={`w-full rounded-xl border px-4 py-3 text-sm font-bold text-slate-900 outline-none transition ${
          error
            ? "border-rose-400 bg-rose-50 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10"
            : "border-slate-200 bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
        }`}
      />
      <FieldError error={error} />
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  icon: Icon,
  helper,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  helper?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        {label}
      </label>
      <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-500">
        {value}
      </div>
      {helper ? <p className="text-xs font-medium leading-5 text-slate-500">{helper}</p> : null}
    </div>
  );
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;

  return <p className="text-xs font-bold text-rose-600">{error}</p>;
}

