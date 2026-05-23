import ExcelJS from "exceljs";
import { IMPORT_MODULE_GUIDES } from "@/utils/importExport/contracts";

export interface SampleGeneratorOptions {
  moduleName: string;
  allowedFields: string[];
  requiredFields: string[];
  format: "csv" | "excel";
}

function downloadBlob(blob: Blob, fileName: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildTemplateData(moduleName: string) {
  const guide = IMPORT_MODULE_GUIDES[moduleName];
  if (!guide) {
    throw new Error(`Template guide not found for ${moduleName}`);
  }

  return {
    columns: guide.dataColumns,
    required: guide.required,
    optional: guide.optional,
    mappingFields: guide.mappingFields || [],
    enumFields: guide.enumFields || {},
    notes: guide.notes || [],
    exampleRow: guide.exampleRow,
  };
}

function buildInstructionLines(moduleName: string) {
  const template = buildTemplateData(moduleName);
  const lines = [
    `# Required fields: ${template.required.join(", ")}`,
    `# Optional fields: ${template.optional.length ? template.optional.join(", ") : "none"}`,
    `# Mapping fields: ${template.mappingFields.length ? template.mappingFields.join(", ") : "none"}`,
  ];

  const enumEntries = Object.entries(template.enumFields);
  if (enumEntries.length) {
    lines.push(
      `# Allowed values: ${enumEntries
        .map(([field, values]) => `${field} = ${values.join(", ")}`)
        .join(" | ")}`,
    );
  }

  template.notes.forEach((note) => {
    lines.push(`# Note: ${note}`);
  });

  return lines;
}

function buildExampleRow(moduleName: string) {
  const template = buildTemplateData(moduleName);
  return template.columns.map((field) => template.exampleRow[field] || "");
}

async function generateCsvSample(options: SampleGeneratorOptions) {
  const template = buildTemplateData(options.moduleName);
  const instructionLines = buildInstructionLines(options.moduleName);
  const headerLine = template.columns.join(",");
  const exampleLine = buildExampleRow(options.moduleName)
    .map((value) => escapeCsvValue(value))
    .join(",");

  const blob = new Blob([[...instructionLines, headerLine, exampleLine].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  downloadBlob(blob, `${options.moduleName}-template.csv`);
}

async function generateExcelSample(options: SampleGeneratorOptions) {
  const template = buildTemplateData(options.moduleName);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`${options.moduleName} Template`);

  const instructionRows = [
    ["Template Instructions"],
    ["Required fields", template.required.join(", ")],
    ["Optional fields", template.optional.length ? template.optional.join(", ") : "none"],
    ["Mapping fields", template.mappingFields.length ? template.mappingFields.join(", ") : "none"],
    ...Object.entries(template.enumFields).map(([field, values]) => [`Allowed values: ${field}`, values.join(", ")]),
    ...template.notes.map((note) => ["Note", note]),
    [],
    template.columns,
    buildExampleRow(options.moduleName),
  ];

  instructionRows.forEach((row) => worksheet.addRow(row));

  worksheet.columns = template.columns.map((field, index) => ({
    key: field,
    width: index === 0 ? 22 : Math.max(field.length + 4, 18),
  }));

  const headerRowIndex = instructionRows.length - 1;
  worksheet.mergeCells(1, 1, 1, 2);
  worksheet.getRow(1).font = { bold: true, size: 13 };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  for (let rowIndex = 2; rowIndex < headerRowIndex; rowIndex += 1) {
    worksheet.getRow(rowIndex).getCell(1).font = { bold: true };
    worksheet.getRow(rowIndex).getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAFC" },
    };
  }

  worksheet.getRow(headerRowIndex).font = { bold: true };
  worksheet.getRow(headerRowIndex).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `${options.moduleName}-template.xlsx`);
}

export async function generateSampleFile(options: SampleGeneratorOptions) {
  if (options.format === "csv") {
    await generateCsvSample(options);
    return;
  }

  await generateExcelSample(options);
}
