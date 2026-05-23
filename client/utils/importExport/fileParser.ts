import * as XLSX from "xlsx";

export type ParsedImportFile = {
  fileType: "csv" | "xlsx" | "xls";
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
};

function detectFileType(name: string): "csv" | "xlsx" | "xls" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".xls")) return "xls";
  return "csv";
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, {
    type: "array",
    raw: false,
    dense: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The selected file does not contain any sheets");
  }

  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  }) as Array<Array<string | number | boolean | Date | null | undefined>>;

  const headerRowIndex = matrix.findIndex((row) =>
    row.some((cell) => String(cell ?? "").trim() !== ""),
  );

  if (headerRowIndex === -1) {
    throw new Error("The selected file is empty or missing a header row");
  }

  const columns = (matrix[headerRowIndex] || []).map((cell) => String(cell ?? "").trim());
  if (!columns.some(Boolean)) {
    throw new Error("The selected file is empty or missing a header row");
  }

  const rows = matrix
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => {
      const record: Record<string, string> = {};
      columns.forEach((column, index) => {
        record[column] = String(row[index] ?? "").trim();
      });
      return record;
    });

  return {
    fileType: detectFileType(file.name),
    columns,
    rows,
    totalRows: rows.length,
  };
}
