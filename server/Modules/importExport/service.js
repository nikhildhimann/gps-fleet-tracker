const fs = require("fs");
const XLSX = require("xlsx");
const Organization = require("../organizations/model");
const { getEntityConfig } = require("./config");
const {
  CHUNK_SIZE,
  parseJsonField,
  sanitizeString,
  detectFileType,
  validateUploadedFile,
  validateEntity,
  buildColumnMapping,
  getMissingRequiredMappings,
} = require("./validator");
const { processChunk } = require("./processor");

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildContainsRegex(value) {
  const sanitized = sanitizeString(value);
  if (!sanitized) return null;
  return new RegExp(escapeRegex(sanitized), "i");
}

function buildDateRange(from, to) {
  const range = {};
  const fromDate = sanitizeString(from) ? new Date(from) : null;
  const toDate = sanitizeString(to) ? new Date(to) : null;

  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    range.$gte = fromDate;
  }
  if (toDate && !Number.isNaN(toDate.getTime())) {
    range.$lte = toDate;
  }

  return Object.keys(range).length > 0 ? range : null;
}

function buildSingleDayRange(value) {
  const raw = sanitizeString(value);
  if (!raw) return null;
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);
  return { $gte: start, $lte: end };
}

function parseWorkbook(filePath, fileType) {
  const workbook = XLSX.readFile(filePath, {
    type: "file",
    raw: false,
    dense: true,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw { status: 400, message: "The uploaded file does not contain any sheets" };
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });

  const firstNonEmptyRowIndex = rows.findIndex((row) =>
    Array.isArray(row) && row.some((cell) => sanitizeString(cell) !== ""),
  );

  if (firstNonEmptyRowIndex === -1) {
    throw { status: 400, message: "Empty file or missing header row" };
  }

  const rawHeaders = (rows[firstNonEmptyRowIndex] || []).map((header) => sanitizeString(header));
  if (!rawHeaders.some(Boolean)) {
    throw { status: 400, message: "Empty file or missing header row" };
  }

  const dataRows = rows
    .slice(firstNonEmptyRowIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((cell) => sanitizeString(cell) !== ""))
    .map((row, index) => {
      const record = {};
      rawHeaders.forEach((header, headerIndex) => {
        record[header] = row[headerIndex] ?? "";
      });
      return {
        rowNumber: firstNonEmptyRowIndex + 2 + index,
        data: record,
      };
    });

  return {
    fileType,
    rawHeaders,
    rows: dataRows,
    sheetName,
  };
}

async function buildImportContext(req) {
  const organizationQuery =
    req.orgScope === "ALL"
      ? {}
      : { _id: { $in: req.orgScope } };
  const organizations = await Organization.find(organizationQuery)
    .select("_id name path parentOrganizationId")
    .lean();

  const organizationsById = new Map();
  const organizationsByNormalizedName = new Map();
  for (const organization of organizations) {
    organizationsById.set(String(organization._id), organization);
    const key = sanitizeString(organization.name).toLowerCase();
    if (!organizationsByNormalizedName.has(key)) {
      organizationsByNormalizedName.set(key, []);
    }
    organizationsByNormalizedName.get(key).push(organization);
  }

  return {
    organizations,
    organizationsById,
    organizationsByNormalizedName,
  };
}

function finalizeResult(entity, fileType, totalRows, processedRows, result) {
  const failedRows = result.errorRowSet.size;
  const duplicateRows = result.duplicateRowSet.size;

  return {
    success: result.successfulRows > 0 && failedRows === 0 && duplicateRows === 0,
    status: result.successfulRows > 0,
    entity,
    fileType,
    totalRows,
    processedRows,
    successfulRows: result.successfulRows,
    failedRows,
    duplicateRows,
    errors: result.errors,
    summary: {
      inserted: result.summary.inserted,
      updated: result.summary.updated,
      skipped: failedRows + duplicateRows,
    },
    message:
      result.successfulRows > 0
        ? failedRows || duplicateRows
          ? "Import completed with partial success"
          : "Import completed successfully"
        : "No rows were imported",
  };
}

async function importData({ entity, file, req }) {
  validateEntity(entity);
  validateUploadedFile(file);

  try {
    const fileType = detectFileType(file);
    const parsedWorkbook = parseWorkbook(file.path, fileType);
    const selectedOrganizationId = sanitizeString(req.body.organizationId);
    const providedMapping = parseJsonField(req.body.mapping, {});
    const excludedRows = new Set(parseJsonField(req.body.excludedRows, []).map((value) => Number(value)));
    const columnMapping = buildColumnMapping(entity, parsedWorkbook.rawHeaders, providedMapping);
    const missingRequiredMappings = getMissingRequiredMappings(entity, columnMapping, {
      selectedOrganizationId,
    });

    if (missingRequiredMappings.length > 0) {
      throw {
        status: 400,
        message: `Missing required mapping: ${missingRequiredMappings.join(", ")}`,
        data: {
          entity,
          fileType,
          missingRequiredMappings,
          columnMapping,
        },
      };
    }

    const mappedRows = parsedWorkbook.rows
      .filter((row, index) => !excludedRows.has(index))
      .map((row) => {
        const mapped = {};
        for (const [sourceColumn, destinationField] of Object.entries(columnMapping)) {
          if (!destinationField) continue;
          mapped[destinationField] = row.data[sourceColumn];
        }
        return {
          rowNumber: row.rowNumber,
          data: mapped,
        };
      })
      .filter((row) => Object.keys(row.data).length > 0);

    if (mappedRows.length === 0) {
      throw { status: 400, message: "No data rows available after mapping and exclusions" };
    }

    const context = await buildImportContext(req);
    const result = {
      successfulRows: 0,
      errors: [],
      errorRowSet: new Set(),
      duplicateRowSet: new Set(),
      summary: {
        inserted: 0,
        updated: 0,
      },
    };
    const state = {
      seenVehicleKeys: new Set(),
      seenDeviceImeis: new Set(),
      seenDriverKeys: new Set(),
      seenOrganizationEmails: new Set(),
      seenOrganizationPhones: new Set(),
      seenOrganizationPaths: new Set(),
      seenDeviceMappingVehicleKeys: new Set(),
      seenDeviceMappingDeviceKeys: new Set(),
      seenDriverMappingVehicleKeys: new Set(),
      seenDriverMappingDriverKeys: new Set(),
    };

    for (let start = 0; start < mappedRows.length; start += CHUNK_SIZE) {
      const chunk = mappedRows.slice(start, start + CHUNK_SIZE);
      await processChunk(entity, chunk, req, context, result, state, {
        selectedOrganizationId,
      });
    }

    return finalizeResult(entity, fileType, parsedWorkbook.rows.length, mappedRows.length, result);
  } finally {
    try {
      await fs.promises.unlink(file.path);
    } catch (_) {
      // Ignore cleanup errors.
    }
  }
}

function buildExportFilter(entity, req) {
  const filter = {};

  if (entity === "organizations") {
    if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
      filter._id = { $in: req.orgScope };
    }
    if (req.query.organizationId) {
      if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
        if (req.orgScope.includes(String(req.query.organizationId))) {
          filter._id = req.query.organizationId;
        }
      } else {
        filter._id = req.query.organizationId;
      }
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.organizationType) filter.organizationType = req.query.organizationType;
    const nameRegex = buildContainsRegex(req.query.name);
    if (nameRegex) {
      filter.name = nameRegex;
    }
    return filter;
  }

  if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
    if (req.query.organizationId && req.orgScope.includes(req.query.organizationId)) {
      filter.organizationId = req.query.organizationId;
    } else {
      filter.organizationId = { $in: req.orgScope };
    }
  } else if (req.query.organizationId) {
    filter.organizationId = req.query.organizationId;
  }

  if (entity === "users") {
    const nameRegex = buildContainsRegex(req.query.name);
    const emailRegex = buildContainsRegex(req.query.email);
    const mobileRegex = buildContainsRegex(req.query.mobile);

    if (nameRegex) {
      filter.$or = [
        { firstName: nameRegex },
        { lastName: nameRegex },
      ];
    }
    if (emailRegex) filter.email = emailRegex;
    if (mobileRegex) filter.mobile = mobileRegex;
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;
    const dateRange = buildDateRange(req.query.from, req.query.to);
    if (dateRange) {
      filter.createdAt = dateRange;
    }
  }

  if (entity === "drivers") {
    const nameRegex = buildContainsRegex(req.query.name);
    const phoneRegex = buildContainsRegex(req.query.phone);
    const licenseRegex = buildContainsRegex(req.query.licenseNumber);

    if (nameRegex) {
      filter.$or = [
        { firstName: nameRegex },
        { lastName: nameRegex },
      ];
    }
    if (phoneRegex) filter.phone = phoneRegex;
    if (licenseRegex) filter.licenseNumber = licenseRegex;
    if (req.query.status) filter.status = req.query.status;
    const dateRange = buildDateRange(req.query.from, req.query.to);
    if (dateRange) {
      filter.createdAt = dateRange;
    }
  }

  if (entity === "vehicles") {
    const vehicleNumberRegex = buildContainsRegex(req.query.vehicleNumber);
    if (vehicleNumberRegex) filter.vehicleNumber = vehicleNumberRegex;
    if (req.query.vehicleType) filter.vehicleType = req.query.vehicleType;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.runningStatus) filter.runningStatus = req.query.runningStatus;
    if (req.query.driverId) filter.driverId = req.query.driverId;
  }

  if (entity === "devices") {
    if (req.query.status) filter.status = req.query.status;
    const imeiRegex = buildContainsRegex(req.query.imei);
    if (imeiRegex) filter.imei = imeiRegex;
    if (req.query.connectionStatus) filter.connectionStatus = req.query.connectionStatus;
  }

  if (entity === "devicemapping") {
    filter.unassignedAt = null;
    const assignedDateRange = buildSingleDayRange(req.query.assignedDate) || buildDateRange(req.query.from, req.query.to);
    if (assignedDateRange) {
      filter.assignedAt = assignedDateRange;
    }
  }

  if (entity === "drivermapping") {
    filter.unassignedAt = null;
    filter.status = "assigned";
    const assignedDateRange = buildSingleDayRange(req.query.assignedDate) || buildDateRange(req.query.from, req.query.to);
    if (assignedDateRange) {
      filter.assignedAt = assignedDateRange;
    }
  }

  return filter;
}

function filterExportRows(entity, rows, req) {
  if (entity === "devicemapping") {
    const vehicleNumberRegex = buildContainsRegex(req.query.vehicleNumber);
    const imeiRegex = buildContainsRegex(req.query.imei);

    return rows.filter((row) => {
      if (vehicleNumberRegex && !vehicleNumberRegex.test(row.vehicleNumber || "")) return false;
      if (imeiRegex && !imeiRegex.test(row.imei || "")) return false;
      return true;
    });
  }

  if (entity === "drivermapping") {
    const vehicleNumberRegex = buildContainsRegex(req.query.vehicleNumber);
    const driverNameRegex = buildContainsRegex(req.query.driverName);
    const driverPhoneRegex = buildContainsRegex(req.query.driverPhone);
    const driverEmailRegex = buildContainsRegex(req.query.driverEmail);

    return rows.filter((row) => {
      if (vehicleNumberRegex && !vehicleNumberRegex.test(row.vehicleNumber || "")) return false;
      if (driverNameRegex && !driverNameRegex.test(row.driverName || "")) return false;
      if (driverPhoneRegex && !driverPhoneRegex.test(row.driverPhone || "")) return false;
      if (driverEmailRegex && !driverEmailRegex.test(row.driverEmail || "")) return false;
      return true;
    });
  }

  return rows;
}

async function exportData({ entity, req, res }) {
  validateEntity(entity);
  const config = getEntityConfig(entity);
  const exportConfig = config.export;
  const format = sanitizeString(req.query.format).toLowerCase() === "excel" ? "excel" : "csv";
  const filter = {
    ...(exportConfig.baseFilter || {}),
    ...buildExportFilter(entity, req),
  };

  const query = exportConfig.model.find(filter).lean();
  (exportConfig.populate || []).forEach((populateConfig) => {
    query.populate(populateConfig);
  });

  const docs = await query;
  const rows = filterExportRows(
    entity,
    docs.map((doc) => exportConfig.mapDocument(doc)),
    req,
  );

  if (format === "excel") {
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: exportConfig.headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, entity);
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${exportConfig.filename}.xlsx"`);
    res.send(buffer);
    return;
  }

  const csv = [
    exportConfig.headers.join(","),
    ...rows.map((row) => exportConfig.headers.map((header) => escapeCsv(row[header])).join(",")),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${exportConfig.filename}.csv"`);
  res.send(csv);
}

module.exports = {
  importData,
  exportData,
};
