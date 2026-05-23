"use client";

import { cn } from "@/lib/utils";

type PhoneInputFieldProps = {
  value: string;
  onChange: (value: string) => void;
  variant?: "light" | "dark";
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
};

export default function PhoneInputField({
  value,
  onChange,
  variant = "light",
  disabled = false,
  placeholder = "Enter phone number",
  required = false,
}: PhoneInputFieldProps) {
  const isDark = variant === "dark";

  // 💡 NORMALIZE: If value is 10 digits without +, prefix with +91 for India
  const normalizedValue = value && !value.startsWith("+") && /^\d{10}$/.test(value)
    ? `+91${value}`
    : value;

  return (
    <input
      type="tel"
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      value={normalizedValue}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all border",
        isDark
          ? "bg-slate-950/60 border-slate-800 text-slate-100 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
          : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
      )}
    />
  );
}
