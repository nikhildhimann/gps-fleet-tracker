import ExcelJS from "exceljs";

export interface ExcelExportOptions {
  data: any[];
  allowedFields: string[];
  fileName?: string;
  sheetName?: string;
}

/**
 * Generate Excel export from API data
 */
export async function generateExcelExport(options: ExcelExportOptions): Promise<void> {
  const { data, allowedFields, fileName = "export.xlsx", sheetName = "Export" } = options;
  
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }
  
  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  
  // Add columns
  worksheet.columns = allowedFields.map(field => ({
    header: field,
    key: field,
    width: 20
  }));
  
  // Add data rows
  data.forEach(row => {
    worksheet.addRow(row);
  });
  
  // Style headers
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  
  // Add borders to all cells
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });
  
  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    if (column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell) => {
        const columnLength = cell.value ? String(cell.value).length : 0;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
    }
    column.width = maxLength < 10 ? 10 : maxLength + 2;
  });
  
  // Generate and download Excel file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
  });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
