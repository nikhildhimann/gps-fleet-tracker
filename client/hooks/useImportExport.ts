"use client";

import { useCallback, useMemo, useState } from "react";
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper";

type ImportExportState = {
  loading: boolean;
  progress: number;
  error: string | null;
  success: string | null;
};

export type ImportErrorItem = {
  row: number;
  field: string;
  message: string;
  raw?: Record<string, string> | null;
  type?: "duplicate";
};

export type ImportResult = {
  success: boolean;
  status: boolean;
  message: string;
  entity?: string;
  fileType?: string;
  totalRows?: number;
  processedRows?: number;
  successfulRows?: number;
  failedRows?: number;
  duplicateRows?: number;
  errors?: ImportErrorItem[];
  summary?: {
    inserted: number;
    updated: number;
    skipped: number;
  };
  data?: unknown;
};

const API_BASE = "http://localhost:5000/api";

export function useImportExport() {
  const [state, setState] = useState<ImportExportState>({
    loading: false,
    progress: 0,
    error: null,
    success: null,
  });

  const token = useMemo(() => {
    const value = getSecureItem("token");
    return typeof value === "string" ? value : "";
  }, []);

  const reset = useCallback(() => {
    setState({
      loading: false,
      progress: 0,
      error: null,
      success: null,
    });
  }, []);

  const uploadFile = useCallback(
    async ({
      importUrl,
      file,
      organizationId,
      mapping,
      excludedRows,
      onProgress,
    }: {
      importUrl: string;
      file: File;
      organizationId?: string;
      mapping: Record<string, string>;
      excludedRows: number[];
      onProgress?: (progress: number) => void;
    }): Promise<ImportResult> => {
      setState({ loading: true, progress: 0, error: null, success: null });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      formData.append("excludedRows", JSON.stringify(excludedRows));
      if (organizationId) {
        formData.append("organizationId", organizationId);
      }

      const result = await new Promise<ImportResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}${importUrl}`);
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const progress = Math.round((event.loaded / event.total) * 100);
          setState((previous) => ({ ...previous, progress }));
          onProgress?.(progress);
        };

        xhr.onload = () => {
          let parsed: ImportResult = {
            success: false,
            status: false,
            message: "Unknown response",
          };

          try {
            parsed = JSON.parse(xhr.responseText || "{}") as ImportResult;
          } catch (_) {
            // Ignore malformed JSON and fall back to the default message.
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(parsed);
            return;
          }

          const message = parsed.message || `Request failed: ${xhr.status}`;
          setState({ loading: false, progress: 0, error: message, success: null });
          reject(new Error(message));
        };

        xhr.onerror = () => {
          const message = "Network error while uploading file";
          setState({ loading: false, progress: 0, error: message, success: null });
          reject(new Error(message));
        };

        xhr.send(formData);
      });

      setState({
        loading: false,
        progress: 100,
        error: null,
        success: result.message || "Import completed",
      });

      return result;
    },
    [token],
  );

  const exportFile = useCallback(
    async ({
      exportUrl,
      fileName,
      filters,
      format = "csv",
    }: {
      exportUrl: string;
      fileName?: string;
      filters?: Record<string, string | number | boolean | null | undefined>;
      format?: "csv" | "excel";
    }) => {
      setState({ loading: true, progress: 0, error: null, success: null });

      const query = new URLSearchParams();
      Object.entries(filters || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        query.set(key, String(value));
      });
      query.set("format", format);

      const url = `${API_BASE}${exportUrl}?${query.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        let message = `Export failed: ${response.status}`;
        try {
          const json = await response.json();
          message = json?.message || message;
        } catch (_) {
          // Ignore non-JSON responses.
        }
        setState({ loading: false, progress: 0, error: message, success: null });
        throw new Error(message);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition") || "";
      const matchedName = contentDisposition.match(/filename="?([^"]+)"?/i)?.[1];
      const downloadName = fileName || matchedName || `export.${format === "excel" ? "xlsx" : "csv"}`;

      const link = document.createElement("a");
      const blobUrl = URL.createObjectURL(blob);
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      setState({
        loading: false,
        progress: 100,
        error: null,
        success: "Export completed",
      });
    },
    [token],
  );

  return {
    ...state,
    uploadFile,
    exportFile,
    reset,
  };
}
