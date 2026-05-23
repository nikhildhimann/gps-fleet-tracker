"use client";

type ValidationSummaryProps = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  missingRequiredFields: string[];
};

export default function ValidationSummary({
  totalRows,
  validRows,
  invalidRows,
  duplicateCount,
  missingRequiredFields,
}: ValidationSummaryProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        Validation Summary
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg bg-white p-2">
          <div className="text-slate-500">Total Rows</div>
          <div className="font-bold text-slate-900">{totalRows}</div>
        </div>
        <div className="rounded-lg bg-white p-2">
          <div className="text-slate-500">Valid Rows</div>
          <div className="font-bold text-green-600">{validRows}</div>
        </div>
        <div className="rounded-lg bg-white p-2">
          <div className="text-slate-500">Invalid Rows</div>
          <div className="font-bold text-red-600">{invalidRows}</div>
        </div>
        <div className="rounded-lg bg-white p-2">
          <div className="text-slate-500">Duplicates</div>
          <div className="font-bold text-amber-600">{duplicateCount}</div>
        </div>
      </div>

      {missingRequiredFields.length > 0 && (
        <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Missing required mapping: {missingRequiredFields.join(", ")}
        </div>
      )}
    </div>
  );
}

