"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCcw,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import MappingTable from "./MappingTable";
import ValidationSummary from "./ValidationSummary";
import { useImportExport, type ImportResult } from "@/hooks/useImportExport";
import { generateSampleFile } from "@/utils/sampleFileGenerator";
import { parseImportFile, type ParsedImportFile } from "@/utils/importExport/fileParser";
import {
  IMPORT_ACCEPT_ATTRIBUTE,
  IMPORT_MODULE_GUIDES,
  MAX_IMPORT_FILE_SIZE_BYTES,
  MAX_IMPORT_FILE_SIZE_LABEL,
} from "@/utils/importExport/contracts";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
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

type LocalRowIssue = {
  rowIndex: number;
  rowNumber: number;
  field: string;
  message: string;
};

type InvalidRowSummary = {
  rowIndex: number;
  rowNumber: number;
  messages: string[];
};

type ReadinessState = {
  importReady: boolean;
  importMessage: string;
  mappingLabel: string;
  mappingReady: boolean | null;
  mappingMessage: string;
};

const PREVIEW_PAGE_SIZE = 5;
const AUTO_ORG_FIELDS = new Set(["organizationId", "organization", "organizationName"]);
const VEHICLE_STATUS = new Set(["active", "inactive", "maintenance", "decommissioned"]);
const VEHICLE_RUNNING_STATUS = new Set(["running", "idle", "stopped", "inactive"]);
const VEHICLE_TYPES = new Set(["car", "bus", "truck", "bike", "other"]);
const USER_STATUS = new Set(["active", "inactive"]);
const USER_ROLES = new Set(["admin", "driver"]);
const ORG_TYPES = new Set(["logistics", "transport", "school", "taxi", "fleet"]);

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeValue(value: string | undefined) {
  return String(value || "").trim().toLowerCase();
}

function formatModuleLabel(moduleName: string) {
  return moduleName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildDefaultMapping(columns: string[], allowedFields: string[]) {
  const normalizedTargets = new Map(allowedFields.map((field) => [normalizeKey(field), field]));
  const next: Record<string, string> = {};
  columns.forEach((column) => {
    next[column] = normalizedTargets.get(normalizeKey(column)) || "";
  });
  return next;
}

function getActiveMappings(mapping: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(mapping).filter(([, target]) => Boolean(target)),
  );
}

function validatePreviewRows(
  moduleName: string,
  rows: Array<{ __index: number } & Record<string, any>>,
  mapping: Record<string, string>,
) {
  const issues: LocalRowIssue[] = [];
  const getMappedValue = (row: Record<string, string>, field: string) => {
    const sourceColumn = Object.entries(mapping).find(([, target]) => target === field)?.[0];
    return sourceColumn ? String(row[sourceColumn] || "").trim() : "";
  };

  rows.forEach((row) => {
    const addIssue = (field: string, message: string) => {
      issues.push({ rowIndex: row.__index, rowNumber: row.__index + 2, field, message });
    };

    if (moduleName === "devices") {
      const imei = getMappedValue(row, "imei");
      const softwareVersion = getMappedValue(row, "softwareVersion");
      const status = normalizeValue(getMappedValue(row, "status") || "active");
      if (!/^\d{15}$/.test(imei)) addIssue("imei", "IMEI must be exactly 15 digits");
      if (!softwareVersion) addIssue("softwareVersion", "softwareVersion is required");
      if (!["active", "inactive", "suspended"].includes(status)) addIssue("status", "status must be one of active, inactive, suspended");
    }

    if (moduleName === "drivers") {
      const firstName = getMappedValue(row, "firstName");
      const lastName = getMappedValue(row, "lastName");
      const email = getMappedValue(row, "email");
      const phone = getMappedValue(row, "phone");
      const licenseNumber = getMappedValue(row, "licenseNumber");
      const status = normalizeValue(getMappedValue(row, "status") || "active");
      const password = getMappedValue(row, "password");
      if (!firstName) addIssue("firstName", "firstName is required");
      if (!lastName) addIssue("lastName", "lastName is required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) addIssue("email", "email must be valid");
      if (!/^\+?[1-9]\d{7,14}$/.test(phone)) addIssue("phone", "phone must be a valid international number");
      if (!licenseNumber) addIssue("licenseNumber", "licenseNumber is required");
      if (!["active", "inactive", "blocked"].includes(status)) addIssue("status", "status must be one of active, inactive, blocked");
      if (!password || password.length < 6) addIssue("password", "password must be at least 6 characters");
    }

    if (moduleName === "vehicles") {
      const vehicleType = normalizeValue(getMappedValue(row, "vehicleType"));
      const vehicleNumber = getMappedValue(row, "vehicleNumber");
      const status = normalizeValue(getMappedValue(row, "status") || "active");
      const runningStatus = normalizeValue(getMappedValue(row, "runningStatus") || "inactive");
      const yearValue = getMappedValue(row, "year");
      const parsedYear = yearValue ? Number(yearValue) : null;
      const maxYear = new Date().getFullYear() + 1;

      if (!VEHICLE_TYPES.has(vehicleType)) addIssue("vehicleType", "vehicleType must be one of car, bus, truck, bike, other");
      if (!vehicleNumber) addIssue("vehicleNumber", "vehicleNumber is required");
      if (!VEHICLE_STATUS.has(status)) addIssue("status", "status must be one of active, inactive, maintenance, decommissioned");
      if (!VEHICLE_RUNNING_STATUS.has(runningStatus)) addIssue("runningStatus", "runningStatus must be one of running, idle, stopped, inactive");
      if (yearValue && parsedYear !== null && (!Number.isFinite(parsedYear) || parsedYear < 1900 || parsedYear > maxYear)) {
        addIssue("year", `year must be between 1900 and ${maxYear}`);
      }
    }

    if (moduleName === "users") {
      const firstName = getMappedValue(row, "firstName");
      const email = getMappedValue(row, "email");
      const mobile = getMappedValue(row, "mobile");
      const role = normalizeValue(getMappedValue(row, "role"));
      const status = normalizeValue(getMappedValue(row, "status") || "active");
      const password = getMappedValue(row, "password");

      if (!firstName) addIssue("firstName", "firstName is required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) addIssue("email", "email must be valid");
      if (!/^\+?[1-9]\d{7,14}$/.test(mobile)) addIssue("mobile", "mobile must be a valid international number");
      if (!USER_ROLES.has(role)) addIssue("role", "role must be one of admin, driver");
      if (!USER_STATUS.has(status)) addIssue("status", "status must be one of active, inactive");
      if (!password || password.length < 6) addIssue("password", "password must be at least 6 characters");
    }

    if (moduleName === "organizations") {
      const name = getMappedValue(row, "name");
      const organizationType = normalizeValue(getMappedValue(row, "organizationType"));
      const email = getMappedValue(row, "email");
      const phone = getMappedValue(row, "phone");
      const status = normalizeValue(getMappedValue(row, "status") || "active");

      if (!name) addIssue("name", "name is required");
      if (!ORG_TYPES.has(organizationType)) addIssue("organizationType", "organizationType must be one of logistics, transport, school, taxi, fleet");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) addIssue("email", "email must be valid");
      if (!/^\+?[1-9]\d{7,14}$/.test(phone)) addIssue("phone", "phone must be a valid international number");
      if (!USER_STATUS.has(status)) addIssue("status", "status must be one of active, inactive");
    }

    if (moduleName === "deviceMapping") {
      const vehicleNumber = getMappedValue(row, "vehicleNumber");
      const imei = getMappedValue(row, "imei");

      if (!vehicleNumber) addIssue("vehicleNumber", "vehicleNumber is required");
      if (!imei) {
        addIssue("imei", "imei is required");
      } else if (!/^\d{15}$/.test(imei)) {
        addIssue("imei", "IMEI must be exactly 15 digits");
      }
    }

    if (moduleName === "driverMapping") {
      const vehicleNumber = getMappedValue(row, "vehicleNumber");
      const driverEmail = getMappedValue(row, "driverEmail");

      if (!vehicleNumber) addIssue("vehicleNumber", "vehicleNumber is required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(driverEmail)) {
        addIssue("driverEmail", "driverEmail must be valid");
      }
    }
  });

  return issues;
}

function downloadErrorReport(entity: string, result: ImportResult) {
  const headers = ["row", "field", "message"];
  const body = (result.errors || []).map((error) => `${error.row},${error.field},${error.message}`);
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${entity}-import-errors.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadInvalidRowsReport(
  entity: string,
  format: "csv" | "excel",
  summaries: InvalidRowSummary[],
  rows: Array<{ __index: number } & Record<string, any>>,
) {
  const exportRows = summaries.map((summary) => {
    const sourceRow = rows.find((row) => row.__index === summary.rowIndex);
    return {
      row: summary.rowNumber,
      issues: summary.messages.join(" | "),
      ...(sourceRow
        ? Object.fromEntries(
          Object.entries(sourceRow).filter(([key]) => key !== "__index"),
        )
        : {}),
    };
  });

  if (format === "csv") {
    const headers = Array.from(
      exportRows.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
      }, new Set<string>()),
    );
    const escapeValue = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [
      headers.join(","),
      ...exportRows.map((row) => headers.map((header) => escapeValue(row[header as keyof typeof row])).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${entity}-invalid-rows.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invalid Rows");
  XLSX.writeFile(workbook, `${entity}-invalid-rows.xlsx`);
}

export default function ImportModal({
  isOpen,
  onClose,
  moduleName,
  importUrl,
  exportUrl,
  allowedFields,
  requiredFields,
  allowImport = true,
  allowExport = true,
  filters,
  onCompleted,
  organizationSelectionMode = "standard",
  organizationSelectionNote,
}: ImportModalProps) {
  const { orgId, orgName, role, user, isSuperAdmin } = useOrgContext();
  const { uploadFile, exportFile, loading, progress, error, reset } = useImportExport();
  const isMainAdmin = role === "admin" && !user?.parentOrganizationId;
  const canChooseOrganization = organizationSelectionMode === "standard" && (isSuperAdmin || isMainAdmin);
  const shouldSendSelectedOrganization = organizationSelectionMode === "standard";
  const { data: organizationResponse } = useGetOrganizationsQuery(
    { page: 0, limit: 1000 },
    { skip: !canChooseOrganization },
  );

  const [tab, setTab] = useState<"import" | "export">(allowImport ? "import" : "export");
  const [selectedOrgId, setSelectedOrgId] = useState<string>(orgId || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedImportFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "excel">("csv");
  const [exportScope, setExportScope] = useState<"all" | "customDate">("all");
  const [exportFromDate, setExportFromDate] = useState("");
  const [exportToDate, setExportToDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);

  const organizations = useMemo(() => organizationResponse?.data || [], [organizationResponse]);
  const moduleLabel = useMemo(() => formatModuleLabel(moduleName), [moduleName]);
  const moduleGuide = useMemo(() => IMPORT_MODULE_GUIDES[moduleName], [moduleName]);
  // TODO: Full organization import onboarding requires backend support for creating
  // admin credentials safely during import. Password handling must be designed as a
  // secure backend workflow, not as plaintext spreadsheet-driven logic in the UI.
  const organizationImportNotice = useMemo(
    () =>
      allowImport && moduleName === "organizations"
        ? "Organization import creates organization records only. Login admin accounts are not created automatically and must be created separately after import."
        : null,
    [allowImport, moduleName],
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedOrgId(orgId || "");
  }, [isOpen, orgId]);

  const rawPreviewRows = useMemo(() => {
    if (!parsedFile) return [];
    return parsedFile.rows.map((row, index) => ({ __index: index, ...row })) as Array<{ __index: number } & Record<string, any>>;
  }, [parsedFile]);
  const activeMappings = useMemo(() => getActiveMappings(mapping), [mapping]);
  const visiblePreviewColumns = useMemo(
    () => parsedFile?.columns.filter((column) => Boolean(activeMappings[column])) || [],
    [activeMappings, parsedFile],
  );
  const previewRows = useMemo(
    () =>
      rawPreviewRows.map((row) => ({
        __index: row.__index,
        ...Object.fromEntries(
          visiblePreviewColumns.map((column) => [column, row[column] ?? ""]),
        ),
      })),
    [rawPreviewRows, visiblePreviewColumns],
  );

  const effectiveRequiredFields = useMemo(() => {
    if (!selectedOrgId) return requiredFields;
    return requiredFields.filter((field) => !AUTO_ORG_FIELDS.has(field));
  }, [requiredFields, selectedOrgId]);

  const mappedFields = useMemo(() => new Set(Object.values(activeMappings)), [activeMappings]);
  const hasOrganizationMapping = useMemo(
    () => mappedFields.has("organizationId") || mappedFields.has("organizationName"),
    [mappedFields],
  );
  const missingRequiredFields = useMemo(() => {
    if (!parsedFile) return [];
    return effectiveRequiredFields.filter((field) => {
      if (AUTO_ORG_FIELDS.has(field)) {
        return !hasOrganizationMapping;
      }
      return !mappedFields.has(field);
    });
  }, [effectiveRequiredFields, hasOrganizationMapping, mappedFields, parsedFile]);
  const mappedRequiredFields = useMemo(
    () => effectiveRequiredFields.filter((field) => (AUTO_ORG_FIELDS.has(field) ? hasOrganizationMapping : mappedFields.has(field))),
    [effectiveRequiredFields, hasOrganizationMapping, mappedFields],
  );
  const ignoredColumns = useMemo(() => {
    if (!parsedFile) return [];
    return parsedFile.columns.filter((column) => !activeMappings[column]);
  }, [activeMappings, parsedFile]);

  const localIssues = useMemo(
    () => (parsedFile ? validatePreviewRows(moduleName, previewRows, mapping) : []),
    [mapping, moduleName, parsedFile, previewRows],
  );

  const invalidRowIds = useMemo(() => new Set(localIssues.map((issue) => issue.rowIndex)), [localIssues]);
  const invalidRowSummaries = useMemo<InvalidRowSummary[]>(() => {
    const grouped = new Map<number, InvalidRowSummary>();
    localIssues.forEach((issue) => {
      const existing = grouped.get(issue.rowIndex) || {
        rowIndex: issue.rowIndex,
        rowNumber: issue.rowNumber,
        messages: [],
      };
      existing.messages.push(`${issue.field}: ${issue.message}`);
      grouped.set(issue.rowIndex, existing);
    });
    return Array.from(grouped.values()).sort((left, right) => left.rowNumber - right.rowNumber);
  }, [localIssues]);
  const allInvalidExcluded = useMemo(
    () => invalidRowSummaries.length > 0 && invalidRowSummaries.every((item) => excludedRows.has(item.rowIndex)),
    [excludedRows, invalidRowSummaries],
  );
  const invalidRemainingCount = useMemo(
    () => invalidRowSummaries.filter((item) => !excludedRows.has(item.rowIndex)).length,
    [excludedRows, invalidRowSummaries],
  );
  const previewValidRows = useMemo(() => {
    if (!parsedFile) return 0;
    if (missingRequiredFields.length > 0) return 0;
    return Math.max(parsedFile.totalRows - invalidRowIds.size - excludedRows.size, 0);
  }, [excludedRows.size, invalidRowIds.size, missingRequiredFields.length, parsedFile]);

  const filteredPreviewRows = useMemo(() => {
    if (!previewSearch) return previewRows;
    const query = previewSearch.toLowerCase();
    return previewRows.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [previewRows, previewSearch]);

  const totalPreviewPages = Math.max(1, Math.ceil(filteredPreviewRows.length / PREVIEW_PAGE_SIZE));
  const previewSlice = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return filteredPreviewRows.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [filteredPreviewRows, previewPage]);

  useEffect(() => {
    setPreviewPage(1);
  }, [previewSearch, parsedFile]);

  const readinessState = useMemo<ReadinessState | null>(() => {
    if (!parsedFile) return null;

    const importReady = missingRequiredFields.length === 0;
    const matchedRequiredFields = mappedRequiredFields.join(", ") || "all required fields";
    const missingRequiredMessage = missingRequiredFields.join(", ");

    if (moduleName === "vehicles") {
      const mappingReady = importReady && mappedFields.has("deviceImei");
      return {
        importReady,
        importMessage: importReady
          ? `Vehicle import ready. Required fields matched: ${matchedRequiredFields}.`
          : `Vehicle import not ready. Required fields still missing: ${missingRequiredMessage}.`,
        mappingLabel: "GPS Device Mapping Ready",
        mappingReady,
        mappingMessage: !importReady
          ? "GPS device mapping readiness depends on import readiness first."
          : mappingReady
            ? "Vehicle import and GPS device mapping are both ready."
            : "Vehicle import ready, but GPS device mapping is not ready. Map the deviceImei field to prepare device linkage.",
      };
    }

    if (moduleName === "devices") {
      const mappingReady = importReady && mappedFields.has("vehicleRegistrationNumber");
      return {
        importReady,
        importMessage: importReady
          ? `GPS device import ready. Required fields matched: ${matchedRequiredFields}.`
          : `GPS device import not ready. Required fields still missing: ${missingRequiredMessage}.`,
        mappingLabel: "Vehicle Mapping Ready",
        mappingReady,
        mappingMessage: !importReady
          ? "Vehicle mapping readiness depends on import readiness first."
          : mappingReady
            ? "GPS device import and vehicle mapping are both ready."
            : "GPS device import ready, but vehicle mapping is not ready. Map the vehicleRegistrationNumber field to prepare linkage.",
      };
    }

    if (moduleName === "drivers") {
      return {
        importReady,
        importMessage: importReady
          ? `Driver import ready. Required driver and login fields matched: ${matchedRequiredFields}.`
          : `Driver import not ready. Required fields still missing: ${missingRequiredMessage}.`,
        mappingLabel: "Mapping Ready",
        mappingReady: null,
        mappingMessage: "No separate mapping step is required beyond the driver and linked user-account fields.",
      };
    }

    if (moduleName === "deviceMapping") {
      return {
        importReady,
        importMessage: importReady
          ? `Device mapping import ready. Required fields matched: ${matchedRequiredFields}.`
          : `Device mapping import not ready. Required fields still missing: ${missingRequiredMessage}.`,
        mappingLabel: "Entity Resolution Ready",
        mappingReady: null,
        mappingMessage: "Each row will resolve vehicleNumber to a vehicle and imei to a GPS device inside the selected organization scope.",
      };
    }

    if (moduleName === "driverMapping") {
      return {
        importReady,
        importMessage: importReady
          ? `Driver mapping import ready. Required fields matched: ${matchedRequiredFields}.`
          : `Driver mapping import not ready. Required fields still missing: ${missingRequiredMessage}.`,
        mappingLabel: "Entity Resolution Ready",
        mappingReady: null,
        mappingMessage: "Each row will resolve vehicleNumber to a vehicle and driverEmail to a driver inside the selected organization scope.",
      };
    }

    return {
      importReady,
      importMessage: importReady
        ? `Import ready. Required fields matched: ${matchedRequiredFields}.`
        : `Import not ready. Required fields still missing: ${missingRequiredMessage}.`,
      mappingLabel: "Mapping Ready",
      mappingReady: null,
      mappingMessage: "No separate relational mapping readiness is tracked for this import flow.",
    };
  }, [mappedFields, mappedRequiredFields, missingRequiredFields, moduleName, parsedFile]);

  const resetState = () => {
    setTab(allowImport ? "import" : "export");
    setSelectedFile(null);
    setParsedFile(null);
    setMapping({});
    setExcludedRows(new Set());
    setResult(null);
    setPreviewSearch("");
    setPreviewPage(1);
    setShowPreview(false);
    setExportFormat("csv");
    setExportScope("all");
    setExportFromDate("");
    setExportToDate("");
    setSelectedOrgId(orgId || "");
    if (fileInputRef.current) fileInputRef.current.value = "";
    reset();
  };

  const closeModal = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  const handleFileSelection = async (file: File | null) => {
    setResult(null);
    setSelectedFile(file);
    setParsedFile(null);
    setExcludedRows(new Set());
    setMapping({});
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      toast.error(`File too large. Maximum allowed size is ${MAX_IMPORT_FILE_SIZE_LABEL}`);
      return;
    }
    try {
      const parsed = await parseImportFile(file);
      setParsedFile(parsed);
      setMapping(buildDefaultMapping(parsed.columns, allowedFields));
    } catch (parseError) {
      toast.error(parseError instanceof Error ? parseError.message : "Failed to parse file");
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !parsedFile) return;
    if (missingRequiredFields.length > 0) {
      toast.error("Please map all required fields before importing");
      return;
    }
    if (invalidRemainingCount > 0) {
      toast.error("Exclude invalid rows before importing");
      return;
    }

    try {
      const response = await uploadFile({
        importUrl,
        file: selectedFile,
        organizationId: shouldSendSelectedOrganization ? selectedOrgId || undefined : undefined,
        mapping,
        excludedRows: [...excludedRows],
      });
      setResult(response);
      if (response.status) {
        toast.success(response.message || "Import completed successfully");
        onCompleted?.();
        closeModal();
      }
    } catch (uploadError) {
      setResult({
        success: false,
        status: false,
        message: uploadError instanceof Error ? uploadError.message : "Import failed",
        totalRows: parsedFile.totalRows,
        processedRows: 0,
        successfulRows: 0,
        failedRows: parsedFile.totalRows,
        duplicateRows: 0,
        errors: [],
        summary: { inserted: 0, updated: 0, skipped: parsedFile.totalRows },
      });
    }
  };

  const handleExport = async () => {
    if (exportScope === "customDate") {
      if (!exportFromDate || !exportToDate) {
        toast.error("Please select both from and to dates");
        return;
      }

      if (new Date(exportToDate) < new Date(exportFromDate)) {
        toast.error("To date must be after from date");
        return;
      }
    }

    await exportFile({
      exportUrl,
      filters: {
        ...filters,
        organizationId: shouldSendSelectedOrganization ? selectedOrgId || undefined : undefined,
        from: exportScope === "customDate" ? exportFromDate : undefined,
        to: exportScope === "customDate" ? exportToDate : undefined,
      },
      format: exportFormat,
      fileName: `${moduleName}-export.${exportFormat === "excel" ? "xlsx" : "csv"}`,
    });
    closeModal();
  };

  const scrollPreviewTable = (direction: "left" | "right") => {
    if (!previewScrollRef.current) return;
    previewScrollRef.current.scrollBy({ left: direction === "left" ? -240 : 240, behavior: "smooth" });
  };

  const excludeInvalidRows = () => {
    setExcludedRows((current) => new Set([...current, ...invalidRowSummaries.map((item) => item.rowIndex)]));
  };

  if (typeof document === "undefined") return null;

  const modalTitle = allowImport && allowExport
    ? `Import / Export ${moduleLabel}`
    : allowExport
      ? `Export ${moduleLabel}`
      : `Import ${moduleLabel}`;

  const modalDescription = allowImport && allowExport
    ? "Upload CSV or Excel files, map columns, and import data safely."
    : allowExport
      ? "Download filtered records in CSV or Excel format."
      : "Upload CSV or Excel files, map columns, and import data safely.";

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
      <div className={`relative flex w-full max-w-[46rem] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ${tab === "export" ? "max-h-[72vh]" : "h-[78vh]"}`}>
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">{modalTitle}</h3>
              <p className="mt-1 text-xs text-slate-500">{modalDescription}</p>
            </div>
            <button type="button" onClick={closeModal} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100">
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {allowImport && allowExport ? (
              <div className="inline-flex rounded-2xl bg-slate-100 p-1 text-xs font-black uppercase tracking-wide">
                <button type="button" onClick={() => setTab("import")} className={`rounded-xl px-4 py-2 ${tab === "import" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Import</button>
                <button type="button" onClick={() => setTab("export")} className={`rounded-xl px-4 py-2 ${tab === "export" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Export</button>
              </div>
            ) : (
              <div className="inline-flex rounded-2xl bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-700">
                {allowExport ? "Export" : "Import"}
              </div>
            )}
            <div className="min-w-[240px] flex-1 max-w-[340px]">
              {canChooseOrganization ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <label className="whitespace-nowrap text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Organization Context</label>
                    <div className="relative min-w-0 flex-1">
                      <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900" value={selectedOrgId} onChange={(event) => setSelectedOrgId(event.target.value)}>
                        {isSuperAdmin && !orgId && (
                          <option value="">Select organization</option>
                        )}
                        {organizations.map((organization: any) => (
                          <option key={organization._id} value={organization._id}>
                            {organization.name} {organization.parentOrganizationId ? "(Sub Org)" : "(Main Org)"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Organization Context</span>
                  <span className="ml-2 text-slate-900">
                    {organizationSelectionMode === "disabled"
                      ? organizationSelectionNote || "This import does not use the modal organization selector."
                      : orgName}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`flex-1 px-5 py-4 ${tab === "export" ? "overflow-y-auto" : "overflow-y-auto"}`}>
          {tab === "import" ? (
            result ? (
              <div className="space-y-4">
                <ValidationSummary
                  totalRows={result.totalRows || 0}
                  validRows={result.successfulRows || 0}
                  invalidRows={result.failedRows || 0}
                  duplicateCount={result.duplicateRows || 0}
                  missingRequiredFields={[]}
                />
                {(result.errors || []).length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-sm font-black text-slate-900">Error Details</div>
                    <div className="max-h-64 overflow-auto space-y-2 text-sm">
                      {(result.errors || []).map((item, index) => (
                        <div key={`${item.row}-${item.field}-${index}`} className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
                          Row {item.row} | {item.field}: {item.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {organizationImportNotice ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
                      Organization Import Note
                    </p>
                    <p className="mt-1 font-medium leading-6">
                      {organizationImportNotice}
                    </p>
                  </div>
                ) : null}
                <div className="grid gap-4 xl:grid-cols-[1.6fr,0.9fr]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-black text-slate-900">Upload File</p>
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <p>Supported: .csv, .xlsx, .xls</p>
                        <p className="mt-1">Max size: {MAX_IMPORT_FILE_SIZE_LABEL}</p>
                      </div>
                      <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center hover:border-blue-400 hover:bg-blue-50/40">
                        <input ref={fileInputRef} type="file" accept={IMPORT_ACCEPT_ATTRIBUTE} className="hidden" onChange={(event) => void handleFileSelection(event.target.files?.[0] || null)} />
                        <Upload className="mb-2 text-slate-400" size={24} />
                        <span className="text-sm font-black text-slate-900">Browse File</span>
                      </label>
                      {selectedFile && parsedFile && (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Selected File</p>
                              <p className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedFile.name}</p>
                              <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB • {parsedFile.fileType.toUpperCase()} • {parsedFile.totalRows} rows</p>
                            </div>
                            <button type="button" onClick={() => void handleFileSelection(selectedFile)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-2 text-[11px] font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100">
                              <RefreshCcw size={12} />
                              Re-parse
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Validation Summary</p>
                      <ValidationSummary totalRows={parsedFile?.totalRows ?? 0} validRows={previewValidRows} invalidRows={invalidRowIds.size} duplicateCount={0} missingRequiredFields={missingRequiredFields} />
                      {parsedFile && readinessState && (
                        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <div className="space-y-2">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className={`rounded-xl border px-3 py-2 ${readinessState.importReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                                <div className="text-[10px] font-black uppercase tracking-wide">Import Ready</div>
                                <div className="mt-1 text-[11px] font-semibold">
                                  {readinessState.importReady ? "Yes" : "No"}
                                </div>
                              </div>
                              <div className={`rounded-xl border px-3 py-2 ${
                                readinessState.mappingReady === null
                                  ? "border-slate-200 bg-white text-slate-700"
                                  : readinessState.mappingReady
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                    : "border-amber-200 bg-amber-50 text-amber-800"
                              }`}>
                                <div className="text-[10px] font-black uppercase tracking-wide">{readinessState.mappingLabel}</div>
                                <div className="mt-1 text-[11px] font-semibold">
                                  {readinessState.mappingReady === null
                                    ? "Not separate"
                                    : readinessState.mappingReady
                                      ? "Yes"
                                      : "No"}
                                </div>
                              </div>
                            </div>
                            <p>{readinessState.importMessage}</p>
                            <p>{readinessState.mappingMessage}</p>
                            {missingRequiredFields.length > 0 && (
                              <p>Add matching columns in the file or map them manually before import.</p>
                            )}
                            {ignoredColumns.length > 0 && (
                              <p>Ignored columns: {ignoredColumns.join(", ")}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3">
                        <p className="text-sm font-black text-slate-900">Templates & Instructions</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void generateSampleFile({ moduleName, allowedFields, requiredFields, format: "csv" })} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-emerald-800">CSV Template</button>
                          <button type="button" onClick={() => void generateSampleFile({ moduleName, allowedFields, requiredFields, format: "excel" })} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-sky-800">Excel Template</button>
                        </div>
                        {(moduleGuide?.enumFields || moduleGuide?.notes?.length) && (
                          <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                            {moduleGuide?.enumFields && Object.keys(moduleGuide.enumFields).length > 0 && (
                              <div className="space-y-1">
                                <p className="font-black uppercase tracking-wide text-slate-500">Allowed values</p>
                                {Object.entries(moduleGuide.enumFields).map(([field, values]) => (
                                  <p key={field}>
                                    <span className="font-semibold text-slate-700">{field}:</span> {values.join(", ")}
                                  </p>
                                ))}
                              </div>
                            )}
                            {moduleGuide?.notes?.length ? (
                              <div className={moduleGuide?.enumFields && Object.keys(moduleGuide.enumFields).length > 0 ? "mt-3 space-y-1" : "space-y-1"}>
                                <p className="font-black uppercase tracking-wide text-slate-500">Notes</p>
                                {moduleGuide.notes.map((note) => (
                                  <p key={note}>{note}</p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {loading && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <div className="mb-2 flex items-center gap-2 font-semibold">
                          <Loader2 size={16} className="animate-spin" />
                          Processing import
                        </div>
                        <div className="h-2 rounded-full bg-slate-200">
                          <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
                  </div>
                </div>

                {parsedFile && (
                  <>
                    {(missingRequiredFields.length > 0 || invalidRowSummaries.length > 0) && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-black text-amber-900">Import Checks</p>
                              {missingRequiredFields.length > 0 && (
                                <p className="mt-1 text-xs text-amber-800">
                                  Missing required mapping: {missingRequiredFields.join(", ")}
                                </p>
                              )}
                              {invalidRowSummaries.length > 0 && (
                                <p className="mt-1 text-xs text-amber-800">
                                  Invalid rows: {invalidRowSummaries.map((item) => item.rowNumber).join(", ")}
                                </p>
                              )}
                            </div>
                            {invalidRowSummaries.length > 0 && (
                              <div className="max-h-28 overflow-auto space-y-1 text-xs text-amber-900">
                                {invalidRowSummaries.map((item) => (
                                  <div key={item.rowIndex} className="rounded-xl bg-white/70 px-3 py-2">
                                    Row {item.rowNumber}: {item.messages.join(" | ")}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {invalidRowSummaries.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={excludeInvalidRows}
                                  className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-900"
                                >
                                  <CheckSquare size={14} />
                                  {allInvalidExcluded ? "Removed" : "All Remove"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadInvalidRowsReport(moduleName, "csv", invalidRowSummaries, previewRows)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700"
                                >
                                  CSV Report
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadInvalidRowsReport(moduleName, "excel", invalidRowSummaries, previewRows)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700"
                                >
                                  Excel Report
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-black text-slate-900">Column Mapping</p>
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                        <div className="max-w-full overflow-x-auto">
                          <div className="min-w-[560px] sm:min-w-[600px]">
                            <MappingTable csvColumns={parsedFile.columns} allowedFields={allowedFields} requiredFields={effectiveRequiredFields} mapping={mapping} onChange={(column, value) => setMapping((current) => ({ ...current, [column]: value }))} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-900">Preview Rows</p>
                          <p className="mt-1 text-xs text-slate-500">Showing {Math.min(previewSlice.length, PREVIEW_PAGE_SIZE)} of {filteredPreviewRows.length} matching rows.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-600">
                            <input type="checkbox" checked={showPreview} onChange={(event) => setShowPreview(event.target.checked)} />
                            Show Preview
                          </label>
                          <input value={previewSearch} onChange={(event) => setPreviewSearch(event.target.value)} placeholder="Search preview" className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900" />
                          <button type="button" onClick={() => scrollPreviewTable("left")} className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"><ChevronLeft size={14} /></button>
                          <button type="button" onClick={() => scrollPreviewTable("right")} className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"><ChevronRight size={14} /></button>
                        </div>
                      </div>
                      {!showPreview ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs font-semibold text-slate-500">
                          Preview is hidden. Turn on <span className="font-black text-slate-700">Show Preview</span> to inspect rows.
                        </div>
                      ) : (
                        <div className="mt-4 w-full overflow-hidden rounded-2xl border border-slate-200">
                          <div ref={previewScrollRef} className="max-w-full overflow-x-auto overflow-y-hidden">
                            <table className="w-max min-w-full border-collapse text-left text-xs">
                              <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                  <th className="border-b border-slate-200 px-3 py-3 font-black uppercase tracking-wide">Skip</th>
                                  {visiblePreviewColumns.map((column) => (
                                    <th key={column} className="border-b border-slate-200 px-3 py-3 font-black uppercase tracking-wide">{column}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {previewSlice.map((row) => {
                                  const rowId = row.__index as number;
                                  const isExcluded = excludedRows.has(rowId);
                                  const previewRow = row as Record<string, unknown>;
                                  return (
                                    <tr key={String(row.__index)} className={isExcluded ? "bg-slate-100 text-slate-400" : invalidRowIds.has(rowId) ? "bg-amber-50 text-slate-700" : "bg-white text-slate-700"}>
                                      <td className="border-b border-slate-100 px-3 py-3 align-top">
                                        <input type="checkbox" checked={isExcluded} onChange={() => setExcludedRows((current) => {
                                          const next = new Set(current);
                                          if (next.has(rowId)) next.delete(rowId);
                                          else next.add(rowId);
                                          return next;
                                        })} />
                                      </td>
                                      {visiblePreviewColumns.map((column) => (
                                        <td key={column} className="border-b border-slate-100 px-3 py-3 whitespace-nowrap">{String(previewRow[column] ?? "")}</td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {showPreview && filteredPreviewRows.length > PREVIEW_PAGE_SIZE && (
                        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-600">
                          <span>Page {previewPage} of {totalPreviewPages}</span>
                          <div className="flex items-center gap-2">
                            <button type="button" disabled={previewPage === 1} onClick={() => setPreviewPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-black uppercase tracking-wide text-slate-700 disabled:opacity-40">Previous</button>
                            <button type="button" disabled={previewPage === totalPreviewPages} onClick={() => setPreviewPage((current) => Math.min(totalPreviewPages, current + 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-black uppercase tracking-wide text-slate-700 disabled:opacity-40">Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          ) : (
            <div className="grid gap-2.5 grid-cols-1">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-black text-slate-900">Format</p>
                  <div className="mt-2.5 space-y-2">
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"><input type="radio" checked={exportFormat === "csv"} onChange={() => setExportFormat("csv")} /><FileText size={15} />CSV</label>
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"><input type="radio" checked={exportFormat === "excel"} onChange={() => setExportFormat("excel")} /><FileSpreadsheet size={15} />Excel</label>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-black text-slate-900">Scope</p>
                  <div className="mt-2.5 space-y-2">
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"><input type="radio" checked={exportScope === "all"} onChange={() => setExportScope("all")} />All data</label>
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"><input type="radio" checked={exportScope === "customDate"} onChange={() => setExportScope("customDate")} />Custom date</label>
                  </div>
                  {exportScope === "customDate" && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">From</span>
                        <input
                          type="date"
                          value={exportFromDate}
                          onChange={(event) => setExportFromDate(event.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">To</span>
                        <input
                          type="date"
                          value={exportToDate}
                          onChange={(event) => setExportToDate(event.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
                        />
                      </label>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-900">Export Summary</p>
                  <div className="mt-2.5 space-y-2 text-xs text-slate-600">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="font-black uppercase tracking-wide text-slate-500">Format</span>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{exportFormat === "excel" ? "Excel" : "CSV"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="font-black uppercase tracking-wide text-slate-500">Scope</span>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{exportScope === "all" ? "All data" : "Custom date"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="font-black uppercase tracking-wide text-slate-500">Date Range</span>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {exportScope === "customDate" && exportFromDate && exportToDate ? `${exportFromDate} to ${exportToDate}` : "All rows"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {exportScope === "all" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
                  {exportScope === "all" ? "All available records will be exported." : "Only records within the selected date range will be exported."}
                </div>
              )}
              {exportScope === "customDate" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
                  Only records within the selected date range will be exported.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {tab === "import" ? (loading ? "Validating rows and importing data..." : "Ready to continue.") : "The exported file will download in your selected format."}
            </p>
            <div className="flex items-center gap-3">
              {result ? (
                <>
                  {(result.errors || []).length > 0 && (
                    <button type="button" onClick={() => downloadErrorReport(moduleName, result)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100">
                      <Download size={14} />
                      Download Error Report
                    </button>
                  )}
                  <button type="button" onClick={() => setResult(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 hover:bg-slate-100">Import Another File</button>
                  <button type="button" onClick={closeModal} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wide text-white">Close</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={closeModal} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 hover:bg-slate-100">Cancel</button>
                  {tab === "import" ? (
                    <button type="button" onClick={() => void handleImport()} disabled={loading || !selectedFile || !parsedFile || missingRequiredFields.length > 0 || invalidRemainingCount > 0} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50">
                      <Upload size={14} />
                      Start Import
                    </button>
                  ) : (
                    <button type="button" onClick={() => void handleExport()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50">
                      <Download size={14} />
                      Export File
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
