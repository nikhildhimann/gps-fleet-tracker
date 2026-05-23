"use client";
import React, { useState } from "react";
import { Building2, Image as ImageIcon, Lock, Mail, MapPin, Phone, X } from "lucide-react";
import LocationSelects from "@/components/common/LocationSelects";
import PhoneInputField from "@/components/common/PhoneInputField";
import { cn } from "@/lib/utils";

type OrganizationCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (payload: {
    name: string;
    organizationType: string;
    email: string;
    phone: string;
    address: {
      addressLine: string;
      city: string;
      state: string;
      country: string;
      pincode?: string;
    };
    firstName: string;
    lastName: string;
    password: string;
    logoUrl?: string;
  }) => void;
  variant?: "light" | "dark";
};

const splitOrgName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "Org";
  const lastName = parts.slice(1).join(" ") || "Admin";
  return { firstName, lastName };
};

export default function OrganizationCreateModal({
  isOpen,
  onClose,
  onCreate,
  variant = "light",
}: OrganizationCreateModalProps) {
  const isDark = variant === "dark";
  const [formData, setFormData] = useState({
    name: "",
    organizationType: "logistics",
    email: "",
    phone: "",
    addressLine: "",
    country: "",
    state: "",
    city: "",
    pincode: "",
    password: "",
    logoUrl: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const { firstName, lastName } = splitOrgName(formData.name);

    try {
      if (onCreate) {
        await onCreate({
          name: formData.name,
          organizationType: formData.organizationType,
          email: formData.email,
          phone: formData.phone,
          address: {
            addressLine: formData.addressLine,
            city: formData.city,
            state: formData.state,
            country: formData.country,
            pincode: formData.pincode || undefined,
          },
          firstName,
          lastName,
          password: formData.password,
          logoUrl: formData.logoUrl || undefined,
        });
      }

      setFormData({
        name: "",
        organizationType: "logistics",
        email: "",
        phone: "",
        addressLine: "",
        country: "",
        state: "",
        city: "",
        pincode: "",
        password: "",
        logoUrl: "",
      });
      onClose();
    } catch (error: unknown) {
      console.error("Creation failed:", error);
      // Parent handle error with toast
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className={cn(
          "w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl animate-in fade-in zoom-in duration-200",
          isDark
            ? "border-slate-800 bg-slate-900 text-slate-100"
            : "border-slate-100 bg-white text-slate-900",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b p-6",
            isDark
              ? "border-slate-800 bg-slate-950/50"
              : "border-slate-100 bg-slate-50/70",
          )}
        >
          <div>
            <h2 className={cn("text-xl font-black", isDark ? "text-slate-100" : "text-slate-900")}>
              Add Sub-Organization
            </h2>
            <p className={cn("text-sm font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
              Add organization details and set admin access.
            </p>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "group rounded-full border p-2 transition-colors",
              isDark
                ? "border-transparent hover:border-slate-700 hover:bg-slate-800"
                : "border-transparent hover:border-slate-200 hover:bg-white",
            )}
            aria-label="Close"
          >
            <X
              size={20}
              className={cn(
                isDark
                  ? "text-slate-400 group-hover:text-slate-100"
                  : "text-slate-400 group-hover:text-slate-600",
              )}
            />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className={cn("mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest", isDark ? "text-slate-400" : "text-slate-400")}>
                  <Building2 size={14} className={isDark ? "text-emerald-400" : "text-blue-500"} />
                  Organization Name
                </label>
                <input
                  required
                  type="text"
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all",
                    isDark
                      ? "border border-slate-800 bg-slate-950/60 text-slate-100 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30"
                      : "border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                  )}
                  placeholder="e.g. Ajiva Logistics"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <MapPin size={14} className={isDark ? "text-emerald-400" : "text-blue-500"} />
                  Organization Type
                </label>
                <select
                  required
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all",
                    isDark
                      ? "border border-slate-800 bg-slate-950/60 text-slate-100 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30"
                      : "border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                  )}
                  value={formData.organizationType}
                  onChange={(e) => setFormData({ ...formData, organizationType: e.target.value })}
                >
                  <option value="logistics">Logistics</option>
                  <option value="transport">Public Transport</option>
                  <option value="taxi">Taxi / Rental</option>
                  <option value="school">School / Campus</option>
                  <option value="fleet">Enterprise Fleet</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <Mail size={14} className={isDark ? "text-emerald-400" : "text-blue-500"} />
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all",
                    isDark
                      ? "border border-slate-800 bg-slate-950/60 text-slate-100 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30"
                      : "border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                  )}
                  placeholder="contact@organization.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <Phone size={14} className={isDark ? "text-emerald-400" : "text-blue-500"} />
                  Phone Number
                </label>
                <PhoneInputField
                  value={formData.phone}
                  onChange={(val) => setFormData({ ...formData, phone: val })}
                  placeholder="Enter phone number"
                  required
                  variant={variant}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <MapPin size={14} className={isDark ? "text-emerald-400" : "text-blue-500"} />
                  Address Line
                </label>
                <input
                  required
                  type="text"
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all",
                    isDark
                      ? "border border-slate-800 bg-slate-950/60 text-slate-100 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30"
                      : "border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                  )}
                  placeholder="123 Business Way"
                  value={formData.addressLine}
                  onChange={(e) =>
                    setFormData({ ...formData, addressLine: e.target.value })
                  }
                />
              </div>

              <LocationSelects
                variant={variant}
                country={formData.country}
                state={formData.state}
                city={formData.city}
                onChange={(next) =>
                  setFormData({
                    ...formData,
                    ...next,
                  })
                }
              />

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <MapPin size={14} className={isDark ? "text-emerald-400" : "text-blue-500"} />
                  Pincode
                </label>
                <input
                  type="text"
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all",
                    isDark
                      ? "border border-slate-800 bg-slate-950/60 text-slate-100 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30"
                      : "border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                  )}
                  placeholder="e.g. 110001"
                  value={formData.pincode}
                  onChange={(e) =>
                    setFormData({ ...formData, pincode: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <Lock size={14} className={isDark ? "text-emerald-400" : "text-blue-500"} />
                  Password
                </label>
                <input
                  required
                  type="password"
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all",
                    isDark
                      ? "border border-slate-800 bg-slate-950/60 text-slate-100 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30"
                      : "border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                  )}
                  placeholder="Set password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <ImageIcon size={14} className={isDark ? "text-emerald-400" : "text-blue-500"} />
                  Logo URL (Optional)
                </label>
                <input
                  type="url"
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all",
                    isDark
                      ? "border border-slate-800 bg-slate-950/60 text-slate-100 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30"
                      : "border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                  )}
                  placeholder="https://logo.company.com/brand.svg"
                  value={formData.logoUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, logoUrl: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className={cn("mt-8 flex gap-4 border-t pt-6", isDark ? "border-slate-800" : "border-slate-100")}>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex-1 rounded-xl px-6 py-3.5 text-sm font-black uppercase tracking-widest transition-all",
                isDark
                  ? "border border-slate-800 bg-slate-950/70 text-slate-300 hover:bg-slate-900"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-50",
                isDark
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/10 hover:bg-emerald-400"
                  : "bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700",
              )}
            >
              {isSaving && (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Add Sub-Organization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
