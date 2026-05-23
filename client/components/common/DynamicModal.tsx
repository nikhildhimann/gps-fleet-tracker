"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DynamicModalProps, type FormField } from "@/lib/formTypes";
import { validateWithZod, type FieldErrorMap } from "@/lib/validation";
import {
  ensureOption,
  getCityOptions,
  getCountryOptions,
  getStateOptions,
} from "@/lib/locations";
import PhoneInputField from "@/components/common/PhoneInputField";
import { getApiErrorMessage, getApiValidationMessages } from "@/utils/apiError";
import SearchableEntitySelect from "@/components/admin/UI/SearchableEntitySelect";

export function DynamicModal({
  isOpen,
  onClose,
  title,
  description,
  fields,
  initialData,
  schema,
  onSubmit,
  variant = "light",
  submitLabel = "Submit",
}: DynamicModalProps) {
  const isDark = variant === "dark";
  const [formData, setFormData] = useState<
    Record<string, string | number | boolean | File>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const locationFieldNames = ["country", "state", "city"];
  const headerFieldNames = new Set(["organizationId", "parentOrganizationDisplay"]);
  const wasOpenRef = useRef(false);

  const getEmptyFieldValue = (fieldName: string) => {
    const field = fields.find((item) => item.name === fieldName);
    return field?.type === "checkbox" ? false : "";
  };

  useEffect(() => {
    const isOpening = isOpen && !wasOpenRef.current;

    if (isOpening) {
      if (initialData) {
        setFormData(initialData);
      } else {
        const initial: Record<string, string | number | boolean | File> = {};
        fields.forEach((field) => {
          initial[field.name] = field.type === "checkbox" ? false : "";
        });
        setFormData(initial);
      }

      setFieldErrors({});
      setApiError(null);
    }

    wasOpenRef.current = isOpen;
  }, [fields, initialData, isOpen]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const countryValue = String(formData.country || "");
  const stateValue = String(formData.state || "");
  const cityValue = String(formData.city || "");

  const countryOptions = ensureOption(getCountryOptions(), countryValue);
  const stateOptions = ensureOption(getStateOptions(countryValue), stateValue);
  const cityOptions = ensureOption(getCityOptions(countryValue, stateValue), cityValue);
  const headerFields = fields.filter((field) => headerFieldNames.has(field.name));
  const bodyFields = fields.filter((field) => !headerFieldNames.has(field.name));

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    let val: string | number | boolean | File = value;
    const fieldConfig = fields.find((field) => field.name === name);

    if (type === "checkbox") {
      val = (e.target as HTMLInputElement).checked;
    } else if (type === "file") {
      val = (e.target as HTMLInputElement).files?.[0] as File;
    }

    applyFieldValueChange(name, val, fieldConfig);
  };

  const applyFieldValueChange = (
    name: string,
    val: string | number | boolean | File,
    fieldConfig?: FormField,
  ) => {
    const resetFields = fieldConfig?.resetFields ?? [];

    setApiError(null);
    setFieldErrors((prev) => {
      const next = { ...prev, [name]: "" };
      resetFields.forEach((fieldName) => {
        next[fieldName] = "";
      });
      return next;
    });
    setFormData((prev) => {
      const next = { ...prev, [name]: val };
      resetFields.forEach((fieldName) => {
        next[fieldName] = getEmptyFieldValue(fieldName);
      });
      return next;
    });

    if (fieldConfig?.onChange) {
      fieldConfig.onChange(String(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setApiError(null);
    setFieldErrors({});
    try {
      if (schema) {
        const result = validateWithZod(schema, formData);
        if (!result.success) {
          setFieldErrors(result.errors);
          setIsSaving(false);
          return;
        }
      }
      await onSubmit(formData);
      onClose();
    } catch (err: unknown) {
      const validationMessage = getApiValidationMessages(err).join(" | ");
      setApiError(
        validationMessage ||
        getApiErrorMessage(err, "Something went wrong. Please try again."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLocationChange = (name: string, value: string) => {
    setApiError(null);
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setFormData((prev) => {
      if (name === "country") {
        return { ...prev, country: value, state: "", city: "" };
      }
      if (name === "state") {
        return { ...prev, state: value, city: "" };
      }
      return { ...prev, city: value };
    });
  };

  const renderFieldControl = (
    field: FormField,
    options?: { compact?: boolean },
  ) => {
    const compactControlClass = options?.compact
      ? "px-2.5 py-1.5 pr-8 text-[11px]"
      : "px-3 py-2 pr-9 text-xs";

    if (locationFieldNames.includes(field.name)) {
      return (
        <select
          name={field.name}
          required={field.required}
          value={
            field.name === "country"
              ? countryValue
              : field.name === "state"
                ? stateValue
                : cityValue
          }
          onChange={(e) => handleLocationChange(field.name, e.target.value)}
          disabled={
            field.disabled ||
            (field.name === "state" && !countryValue) ||
            (field.name === "city" && (!countryValue || !stateValue))
          }
          className={cn(
            "admin-select w-full rounded-xl font-semibold outline-none transition-all appearance-none",
            compactControlClass,
            isDark && "admin-select-dark",
            isDark
              ? "bg-slate-950/60 border border-slate-800 text-slate-100 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500"
              : "bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
          )}
        >
          <option value="">
            {field.name === "country"
              ? "Select country"
              : field.name === "state"
                ? "Select state"
                : "Select city"}
          </option>
          {(field.name === "country"
            ? countryOptions
            : field.name === "state"
              ? stateOptions
              : cityOptions
          ).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          name={field.name}
          required={field.required}
          rows={field.rows || 3}
          placeholder={field.placeholder}
          value={(formData[field.name] as string | number) || ""}
          onChange={handleChange}
            className={cn(
              "w-full rounded-lg font-semibold outline-none transition-all resize-none",
              options?.compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
              isDark
                ? "bg-slate-950/60 border border-slate-800 text-slate-100 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 placeholder:text-slate-600"
                : "bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400",
          )}
        />
      );
    }

    if (field.type === "select") {
      return (
        <select
          name={field.name}
          required={field.required}
          value={(formData[field.name] as string | number) || ""}
          onChange={handleChange}
          disabled={field.disabled}
          className={cn(
            "admin-select w-full rounded-xl font-semibold outline-none transition-all appearance-none",
            compactControlClass,
            isDark && "admin-select-dark",
            isDark
              ? "bg-slate-950/60 border border-slate-800 text-slate-100 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500"
              : "bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
          )}
        >
          <option value="">Select option</option>
          {field.groups
            ? field.groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))
            : field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
        </select>
      );
    }

    if (field.type === "searchable-select") {
      return (
        <SearchableEntitySelect
          value={String(formData[field.name] || "")}
          onChange={(value) => applyFieldValueChange(field.name, value, field)}
          options={field.searchableOptions || []}
          placeholder={field.placeholder || "Select option"}
          searchPlaceholder={field.searchPlaceholder}
          emptyMessage={field.emptyMessage}
          disabled={field.disabled}
          invalid={Boolean(fieldErrors[field.name])}
          clearable={field.clearable}
          clearLabel={field.clearLabel}
          variant={isDark ? "dark" : "light"}
        />
      );
    }

    if (field.type === "tel") {
      return (
        <PhoneInputField
          value={String(formData[field.name] || "")}
          onChange={(val) => {
            setApiError(null);
            setFieldErrors((prev) => ({ ...prev, [field.name]: "" }));
            setFormData((prev) => ({ ...prev, [field.name]: val }));
          }}
          variant={variant}
          disabled={field.disabled}
          placeholder={field.placeholder}
          required={field.required}
        />
      );
    }

    if (field.type === "checkbox") {
      return (
        <div className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            name={field.name}
            checked={!!formData[field.name]}
            onChange={handleChange}
              className={cn(
                "w-5 h-5 rounded border transition-all cursor-pointer",
              isDark
                ? "bg-slate-950 border-slate-700 text-emerald-500 focus:ring-emerald-500/20"
                : "border-slate-300 text-slate-900 focus:ring-blue-500/20",
            )}
          />
          <span
            className={cn(
              "text-xs font-semibold",
              isDark ? "text-slate-300" : "text-slate-600",
            )}
          >
            {field.placeholder || "Enable"}
          </span>
        </div>
      );
    }

    if (field.type === "file") {
      return (
        <div className="relative">
          <input
            type="file"
            name={field.name}
            required={field.required}
            onChange={handleChange}
            className={cn(
              "w-full rounded-lg font-semibold outline-none transition-all file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold",
              options?.compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
              isDark
                ? "bg-slate-950/60 border border-slate-800 text-slate-100 file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                : "bg-slate-50 border border-slate-200 text-slate-800 file:bg-white file:border file:border-slate-200 file:text-slate-600 hover:file:bg-slate-100",
            )}
          />
          {formData[field.name] instanceof File && (
            <p className="mt-1 text-[10px] text-emerald-400 font-bold">
              Selected: {(formData[field.name] as File).name}
            </p>
          )}
        </div>
      );
    }

    return (
      <input
        type={field.type}
        name={field.name}
        required={field.required}
        placeholder={field.placeholder}
        value={(formData[field.name] as string | number) || ""}
        onChange={handleChange}
        disabled={field.disabled}
        className={cn(
          "w-full rounded-lg font-semibold outline-none transition-all",
          options?.compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
          isDark
            ? "bg-slate-950/60 border border-slate-800 text-slate-100 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 placeholder:text-slate-600"
            : "bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400",
        )}
      />
    );
  };

  const renderFieldBlock = (
    field: FormField,
    options?: { compact?: boolean },
  ) => (
    <>
      <label
        className={cn(
          "block font-black uppercase tracking-widest mb-1.5 flex items-center gap-2",
          options?.compact ? "text-[8px]" : "text-[9px]",
          isDark ? "text-slate-400" : "text-slate-500",
        )}
      >
        {field.icon}
        {field.label}
        {field.required && <span className="text-rose-500">*</span>}
      </label>
      {renderFieldControl(field, options)}
      {!fieldErrors[field.name] && field.helperText && (
        <p
          className={cn(
            "mt-1 text-[10px] font-semibold",
            options?.compact && "text-[9px]",
            isDark ? "text-slate-400" : "text-slate-500",
          )}
        >
          {field.helperText}
        </p>
      )}
      {fieldErrors[field.name] && (
        <p
          className={cn(
            "mt-1 text-[11px] font-semibold",
            options?.compact && "text-[10px]",
            isDark ? "text-rose-300" : "text-rose-600",
          )}
        >
          {fieldErrors[field.name]}
        </p>
      )}
    </>
  );



  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-2 sm:items-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Content */}
        <div
          className={cn(
            "relative flex max-h-[min(100dvh-1rem,80rem)] w-full max-w-[42rem] flex-col overflow-hidden rounded-[20px] shadow-2xl animate-in fade-in zoom-in duration-200 sm:max-h-[85vh] sm:rounded-xl",
            isDark && "popup-dark-modal",
            isDark
              ? "bg-slate-900 border border-slate-800 text-slate-100"
              : "bg-white border border-slate-200 text-slate-900",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "p-3 sm:p-3.5",
            isDark
              ? "border-b border-slate-800 bg-slate-950/40"
              : "border-b border-slate-100 bg-slate-50/50",
          )}
        >
          <div className="flex items-start gap-2.5">
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "grid gap-2.5",
                  headerFields.length > 0 &&
                    "lg:grid-cols-[minmax(0,1fr)_minmax(170px,200px)] lg:items-start",
                )}
              >
                <div className="min-w-0">
                  <h2 className="text-base font-black">{title}</h2>
                  {description && (
                    <p
                      className={cn(
                        "mt-1 text-[11px] font-medium leading-5",
                        isDark ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      {description}
                    </p>
                  )}
                </div>

                {headerFields.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:justify-items-end">
                    {headerFields.map((field) => (
                      <div key={field.name} className="w-full lg:max-w-[190px]">
                        {renderFieldBlock(field, { compact: true })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
                className={cn(
                "shrink-0 rounded-full p-1.5 transition-colors",
                isDark
                  ? "hover:bg-slate-800 text-slate-400 hover:text-slate-100"
                  : "hover:bg-slate-100 text-slate-400 hover:text-slate-900",
              )}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-3 pb-4 sm:p-3.5 sm:pb-4 space-y-3.5">
          {/* ── Inline API error ── */}
          {apiError && (
            <div className={cn(
              "flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium border animate-in fade-in slide-in-from-top-1 duration-200",
              isDark
                ? "bg-red-900/30 border-red-700/40 text-red-300"
                : "bg-red-50 border-red-200 text-red-700"
            )}>
              <span className="mt-0.5 shrink-0 text-rose-500">⚠</span>
              <span className="flex-1">{apiError}</span>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">

            {bodyFields.map((field, index) => {
              const previousSection = index > 0 ? bodyFields[index - 1]?.section : undefined;
              const showSectionHeading = !!field.section && field.section !== previousSection;

              return (
              <React.Fragment key={field.name}>
              {showSectionHeading && (
                <div className="sm:col-span-2 pt-1">
                  <div className={cn("mb-1.5 border-t pt-2.5", isDark ? "border-slate-800" : "border-slate-200")}>
                    <p
                      className={cn(
                        "text-[10px] font-black uppercase tracking-[0.24em]",
                        isDark ? "text-slate-300" : "text-slate-700",
                      )}
                    >
                      {field.section}
                    </p>
                  </div>
                </div>
              )}
              <div
                className={cn(field.type === "textarea" ? "sm:col-span-2" : "")}
              >
                {renderFieldBlock(field)}
              </div>
              </React.Fragment>
            )})}
          </div>

          {/* Footer */}
          <div
            className={cn(
                "sticky bottom-0 mt-1.5 flex flex-col gap-2 border-t bg-inherit pt-3 sm:flex-row",
                isDark
                  ? "border-t border-slate-800"
                  : "border-t border-slate-100",
            )}
          >
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all",
                isDark
                  ? "bg-slate-950/40 border border-slate-800 text-slate-300 hover:bg-slate-800"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all shadow-lg",
                isDark
                  ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/10"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200/40",
              )}
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
