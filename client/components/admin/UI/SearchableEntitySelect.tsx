"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableEntityOption = {
  value: string;
  label: string;
  description?: string;
  meta?: string;
  keywords?: string[];
  badge?: string;
  disabled?: boolean;
};

type SearchableEntitySelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableEntityOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  clearLabel?: string;
  variant?: "light" | "dark";
};

type PanelPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const DEFAULT_POSITION: PanelPosition = {
  top: 0,
  left: 0,
  width: 0,
  maxHeight: 320,
};

const normalizeText = (value: string) => value.trim().toLowerCase();

export default function SearchableEntitySelect({
  value,
  onChange,
  options,
  placeholder = "Select option",
  searchPlaceholder = "Search options",
  emptyMessage = "No matching results found.",
  disabled = false,
  invalid = false,
  clearable = false,
  clearLabel = "Clear selection",
  variant = "light",
}: SearchableEntitySelectProps) {
  const isDark = variant === "dark";
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelPosition, setPanelPosition] =
    useState<PanelPosition>(DEFAULT_POSITION);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      [
        option.label,
        option.description,
        option.meta,
        ...(option.keywords || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [options, query]);

  const updatePanelPosition = () => {
    if (!triggerRef.current || typeof window === "undefined") {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const preferredHeight = 320;
    const shouldOpenUpward =
      spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      180,
      Math.min(preferredHeight, shouldOpenUpward ? spaceAbove : spaceBelow),
    );
    const width = Math.min(Math.max(rect.width, Math.min(280, viewportWidth - 24)), viewportWidth - 24);
    const left = Math.min(Math.max(12, rect.left), viewportWidth - width - 12);
    const top = shouldOpenUpward
      ? Math.max(12, rect.top - maxHeight - 8)
      : rect.bottom + 8;

    setPanelPosition({
      top,
      left,
      width,
      maxHeight,
    });
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePanelPosition();
    searchInputRef.current?.focus();

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleReposition = () => updatePanelPosition();

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen]);

  const triggerBaseClass = isDark
    ? "border-slate-800 bg-slate-950/60 text-slate-100 hover:border-slate-700"
    : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white";

  const panel = isOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={panelRef}
          className={cn(
            "fixed z-[180] overflow-hidden rounded-2xl border shadow-[0_22px_50px_rgba(15,23,42,0.18)]",
            isDark
              ? "border-slate-800 bg-slate-900 text-slate-100"
              : "border-slate-200 bg-white text-slate-900",
          )}
          style={{
            top: panelPosition.top,
            left: panelPosition.left,
            width: panelPosition.width,
          }}
        >
          <div
            className={cn(
              "border-b p-2.5",
              isDark ? "border-slate-800" : "border-slate-100",
            )}
          >
            <div className="relative">
              <Search
                size={14}
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2",
                  isDark ? "text-slate-500" : "text-slate-400",
                )}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  "w-full rounded-xl border py-2 pl-9 pr-3 text-xs font-semibold outline-none transition-all",
                  isDark
                    ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-slate-500"
                    : "border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white",
                )}
              />
            </div>

            {clearable && value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setQuery("");
                  setIsOpen(false);
                }}
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
                  isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                <X size={12} />
                {clearLabel}
              </button>
            )}
          </div>

          <div style={{ maxHeight: panelPosition.maxHeight }} className="overflow-y-auto p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className={cn(
                      "mb-1 flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition last:mb-0",
                      option.disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer",
                      isSelected
                        ? isDark
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-blue-200 bg-blue-50"
                        : isDark
                          ? "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/70"
                          : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold">
                          {option.label}
                        </p>
                        {option.badge ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]",
                              isDark
                                ? "bg-slate-800 text-slate-300"
                                : "bg-slate-100 text-slate-500",
                            )}
                          >
                            {option.badge}
                          </span>
                        ) : null}
                      </div>
                      {option.description ? (
                        <p
                          className={cn(
                            "mt-0.5 text-xs font-semibold",
                            isDark ? "text-slate-300" : "text-slate-600",
                          )}
                        >
                          {option.description}
                        </p>
                      ) : null}
                      {option.meta ? (
                        <p
                          className={cn(
                            "mt-1 text-[10px] font-medium",
                            isDark ? "text-slate-400" : "text-slate-500",
                          )}
                        >
                          {option.meta}
                        </p>
                      ) : null}
                    </div>

                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-full p-1",
                        isSelected
                          ? isDark
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-blue-100 text-blue-700"
                          : "opacity-0",
                      )}
                    >
                      <Check size={14} />
                    </span>
                  </button>
                );
              })
            ) : (
              <div
                className={cn(
                  "rounded-xl border border-dashed px-3 py-6 text-center text-xs font-semibold",
                  isDark
                    ? "border-slate-800 text-slate-400"
                    : "border-slate-200 text-slate-500",
                )}
              >
                {emptyMessage}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((current) => !current);
          setQuery("");
        }}
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left outline-none transition-all",
          triggerBaseClass,
          invalid &&
            (isDark
              ? "border-rose-500/60 focus:border-rose-500"
              : "border-rose-300 focus:border-rose-500"),
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <div className="min-w-0 flex-1">
          {selectedOption ? (
            <>
              <p className="truncate text-xs font-bold">{selectedOption.label}</p>
              {(selectedOption.description || selectedOption.meta) && (
                <p
                  className={cn(
                    "mt-0.5 truncate text-[10px] font-medium",
                    isDark ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  {selectedOption.description || selectedOption.meta}
                </p>
              )}
            </>
          ) : (
            <p
              className={cn(
                "truncate text-xs font-semibold",
                isDark ? "text-slate-500" : "text-slate-400",
              )}
            >
              {placeholder}
            </p>
          )}
        </div>

        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 transition-transform",
            isOpen && "rotate-180",
            isDark ? "text-slate-500" : "text-slate-400",
          )}
        />
      </button>
      {panel}
    </>
  );
}
