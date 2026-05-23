"use client";

import {
  ensureOption,
  getCityOptions,
  getCountryOptions,
  getStateOptions,
} from "@/lib/locations";
import { cn } from "@/lib/utils";

type LocationSelectsProps = {
  country: string;
  state: string;
  city: string;
  onChange: (next: { country?: string; state?: string; city?: string }) => void;
  variant?: "light" | "dark";
  disabled?: boolean;
  labels?: { country?: string; state?: string; city?: string };
};

export default function LocationSelects({
  country,
  state,
  city,
  onChange,
  variant = "light",
  disabled = false,
  labels,
}: LocationSelectsProps) {
  const isDark = variant === "dark";

  const countryOptions = ensureOption(getCountryOptions(), country);
  const stateOptions = ensureOption(getStateOptions(country), state);
  const cityOptions = ensureOption(getCityOptions(country, state), city);

  const baseClass = cn(
    "w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all",
    isDark
      ? "bg-slate-950/60 border border-slate-800 text-slate-100 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
      : "bg-slate-50 border border-slate-200 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
  );

  return (
    <div className="space-y-4">
      <div>
        <label className={cn("block text-xs font-black uppercase tracking-widest mb-1.5", isDark ? "text-slate-400" : "text-slate-400")}>
          {labels?.country || "Country"} <span className="text-rose-500">*</span>
        </label>
        <select
          className={baseClass}
          value={country}
          disabled={disabled}
          required
          onChange={(e) => onChange({ country: e.target.value, state: "", city: "" })}
        >
          <option value="">Select country</option>
          {countryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={cn("block text-xs font-black uppercase tracking-widest mb-1.5", isDark ? "text-slate-400" : "text-slate-400")}>
          {labels?.state || "State"} <span className="text-rose-500">*</span>
        </label>
        <select
          className={baseClass}
          value={state}
          required
          disabled={disabled || !country}
          onChange={(e) => onChange({ state: e.target.value, city: "" })}
        >
          <option value="">Select state</option>
          {stateOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={cn("block text-xs font-black uppercase tracking-widest mb-1.5", isDark ? "text-slate-400" : "text-slate-400")}>
          {labels?.city || "City"} <span className="text-rose-500">*</span>
        </label>
        <select
          className={baseClass}
          value={city}
          required
          disabled={disabled || !country || !state}
          onChange={(e) => onChange({ city: e.target.value })}
        >
          <option value="">Select city</option>
          {cityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
