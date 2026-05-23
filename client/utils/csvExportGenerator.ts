export interface CSVExportOptions {
  data: any[];
  allowedFields: string[];
  fileName?: string;
}

/**
 * Generate CSV export from API data
 */
export function generateCSVExport(options: CSVExportOptions): void {
  const { data, allowedFields, fileName = "export.csv" } = options;
  
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }
  
  // Generate headers
  const headers = allowedFields;
  
  // Generate data rows
  const csvRows = [headers];
  
  data.forEach(row => {
    const values = allowedFields.map(field => {
      const value = row[field] || "";
      // Handle values that contain commas, quotes, or newlines
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values);
  });
  
  // Create CSV content
  const csvContent = csvRows.join("\n");
  
  // Create and download file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
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
