"use client";

import { useMemo, useState } from "react";

type MappingTableProps = {
  csvColumns: string[];
  allowedFields: string[];
  requiredFields: string[];
  mapping: Record<string, string>;
  onChange: (csvCol: string, value: string) => void;
};

const MAPPING_PAGE_SIZE = 5;

export default function MappingTable({
  csvColumns,
  allowedFields,
  requiredFields,
  mapping,
  onChange,
}: MappingTableProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(csvColumns.length / MAPPING_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedColumns = useMemo(() => {
    const start = (safePage - 1) * MAPPING_PAGE_SIZE;
    return csvColumns.slice(start, start + MAPPING_PAGE_SIZE);
  }, [csvColumns, safePage]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        Column Mapping
      </div>
      <div className="max-h-56 overflow-auto p-3 space-y-2">
        {paginatedColumns.map((col) => (
          <div
            key={col}
            className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
          >
            <div
              className="break-words rounded-lg bg-slate-100 px-2 py-2 font-semibold leading-5 text-slate-700"
              title={col}
            >
              {col}
            </div>
            <select
              className="admin-select rounded-lg border border-slate-200 px-2 py-2 pr-10 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
              value={mapping[col] || ""}
              onChange={(e) => onChange(col, e.target.value)}
            >
              <option value="">Ignore</option>
              {allowedFields.map((field) => (
                <option key={field} value={field}>
                  {field} {requiredFields.includes(field) ? "(Required)" : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600">
          <span>
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

