"use client";

import { useState } from "react";
import { Download, UploadCloud } from "lucide-react";
import ImportModal from "./ImportModal";
import { useOrgContext } from "@/hooks/useOrgContext";

type ImportExportButtonProps = {
  moduleName: string;
  importUrl: string;
  exportUrl: string;
  allowedFields: string[];
  requiredFields: string[];
  allowImport?: boolean;
  allowExport?: boolean;
  filters?: Record<string, string | number | boolean | null | undefined>;
  onCompleted?: () => void;
  organizationSelectionMode?: "standard" | "disabled";
  organizationSelectionNote?: string;
};

export default function ImportExportButton(props: ImportExportButtonProps) {
  const { role } = useOrgContext();
  const [open, setOpen] = useState(false);
  const allowImport = props.allowImport ?? true;
  const allowExport = props.allowExport ?? true;

  if (role !== "admin" && role !== "superadmin") {
    return null;
  }

  if (!allowImport && !allowExport) {
    return null;
  }

  const buttonLabel = allowImport && allowExport ? "Import / Export" : allowExport ? "Export" : "Import";
  const ButtonIcon = allowImport && allowExport ? UploadCloud : allowExport ? Download : UploadCloud;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
      >
        <ButtonIcon size={14} />
        {buttonLabel}
      </button>

      <ImportModal
        isOpen={open}
        onClose={() => setOpen(false)}
        moduleName={props.moduleName}
        importUrl={props.importUrl}
        exportUrl={props.exportUrl}
        allowedFields={props.allowedFields}
        requiredFields={props.requiredFields}
        allowImport={allowImport}
        allowExport={allowExport}
        filters={props.filters}
        onCompleted={props.onCompleted}
        organizationSelectionMode={props.organizationSelectionMode}
        organizationSelectionNote={props.organizationSelectionNote}
      />
    </>
  );
}
