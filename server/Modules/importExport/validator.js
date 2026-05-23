const path = require("path");
const mongoose = require("mongoose");
const { getEntityConfig, getSupportedEntities } = require("./config");
const {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} = require("./constants");

const CHUNK_SIZE = 500;

const VEHICLE_STATUS = new Set(["active", "inactive", "maintenance", "decommissioned"]);
const VEHICLE_RUNNING_STATUS = new Set(["running", "idle", "stopped", "inactive"]);
const VEHICLE_TYPES = new Set(["car", "bus", "truck", "bike", "other"]);
const GPS_DEVICE_STATUS = new Set(["active", "inactive", "suspended"]);
const DRIVER_STATUS = new Set(["active", "inactive", "blocked"]);
const ORG_TYPES = new Set(["logistics", "transport", "school", "taxi", "fleet"]);
const USER_ROLES = new Set(["admin", "driver"]);
const USER_STATUS = new Set(["active", "inactive"]);

function sanitizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeHeader(value) {
  return sanitizeString(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeLookupValue(value) {
  return sanitizeString(value).toLowerCase();
}

function parseBoolean(value) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) return null;
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
}

function parseNumber(value) {
  const raw = sanitizeString(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const raw = sanitizeString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function detectFileType(file) {
  const ext = path.extname(file?.originalname || "").toLowerCase();
  if (ext === ".xlsx") return "xlsx";
  if (ext === ".xls") return "xls";
  return "csv";
}

function validateUploadedFile(file) {
  if (!file) {
    throw { status: 400, message: "File is required" };
  }

  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw { status: 400, message: "Invalid file format. Allowed: .csv, .xlsx, .xls" };
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw { status: 400, message: "Invalid file type. Allowed: CSV and Excel files" };
  }
}

function validateEntity(entity) {
  if (!getEntityConfig(entity)) {
    throw {
      status: 400,
      message: `Unsupported entity. Allowed: ${getSupportedEntities().join(", ")}`,
    };
  }
}

function buildColumnMapping(entity, rawHeaders, providedMapping = {}) {
  const config = getEntityConfig(entity);
  const allowedFields = new Set(config.importFields);
  const mapping = {};

  rawHeaders.forEach((header) => {
    if (Object.prototype.hasOwnProperty.call(providedMapping, header)) {
      const manualValue = sanitizeString(providedMapping[header]);
      mapping[header] = manualValue && allowedFields.has(manualValue) ? manualValue : "";
      return;
    }

    const manualValue = sanitizeString(providedMapping[header]);
    if (manualValue && allowedFields.has(manualValue)) {
      mapping[header] = manualValue;
      return;
    }

    const normalized = normalizeHeader(header);
    const autoValue = config.headerAliases[normalized];
    if (autoValue && allowedFields.has(autoValue)) {
      mapping[header] = autoValue;
      return;
    }

    mapping[header] = "";
  });

  return mapping;
}

function getMissingRequiredMappings(entity, columnMapping, options = {}) {
  const config = getEntityConfig(entity);
  const mappedFields = new Set(Object.values(columnMapping).filter(Boolean));
  const missing = config.requiredFields.filter((field) => !mappedFields.has(field));

  const missingGroups = [];
  for (const group of config.requiredFieldGroups || []) {
    if (group === "organization" && !options.selectedOrganizationId) {
      const hasOrganizationField =
        mappedFields.has("organizationId") || mappedFields.has("organizationName");
      if (!hasOrganizationField) {
        missingGroups.push("organizationId or organizationName");
      }
    }
  }

  return [...missing, ...missingGroups];
}

function resolveScopedOrganizationId(candidateId, req, context) {
  if (!candidateId || !mongoose.isValidObjectId(candidateId)) {
    return null;
  }

  if (req.orgScope !== "ALL" && !req.orgScope.includes(String(candidateId))) {
    return null;
  }

  return context.organizationsById.get(String(candidateId)) || null;
}

function resolveOrganizationByName(name, req, context) {
  const normalized = normalizeLookupValue(name);
  if (!normalized) return null;
  const matches = context.organizationsByNormalizedName.get(normalized) || [];
  const scopedMatches =
    req.orgScope === "ALL"
      ? matches
      : matches.filter((org) => req.orgScope.includes(String(org._id)));

  if (scopedMatches.length !== 1) return null;
  return scopedMatches[0];
}

function resolveOrganizationReference(rawRow, req, context, selectedOrganizationId) {
  if (selectedOrganizationId) {
    const selected = resolveScopedOrganizationId(selectedOrganizationId, req, context);
    if (!selected) {
      return { error: "Selected organization is outside the allowed scope" };
    }
    return { organization: selected };
  }

  if (rawRow.organizationId) {
    const resolved = resolveScopedOrganizationId(rawRow.organizationId, req, context);
    if (!resolved) {
      return { error: "organizationId is invalid or outside the allowed scope" };
    }
    return { organization: resolved };
  }

  if (rawRow.organizationName) {
    const resolved = resolveOrganizationByName(rawRow.organizationName, req, context);
    if (!resolved) {
      return { error: "organizationName did not match exactly one accessible organization" };
    }
    return { organization: resolved };
  }

  if (req.user.role === "superadmin") {
    return { error: "organizationId or organizationName is required" };
  }

  const ownOrganization = resolveScopedOrganizationId(req.orgId, req, context);
  if (!ownOrganization) {
    return { error: "User organization context is invalid" };
  }
  return { organization: ownOrganization };
}

function validateEmail(value) {
  const raw = sanitizeString(value).toLowerCase();
  if (!raw) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

function validatePhone(value) {
  const raw = sanitizeString(value);
  if (!raw) return false;
  return /^\+?[1-9]\d{7,14}$/.test(raw);
}

function normalizeImportedRow(entity, rawRow, req, context, options = {}) {
  const errors = [];
  const selectedOrganizationId = options.selectedOrganizationId || "";
  const normalized = {};

  if (entity !== "organizations") {
    const orgResolution = resolveOrganizationReference(rawRow, req, context, selectedOrganizationId);
    if (orgResolution.error) {
      errors.push({ field: "organizationId", message: orgResolution.error });
    } else {
      normalized.organizationId = String(orgResolution.organization._id);
      normalized.organizationName = orgResolution.organization.name;
    }
  }

  if (entity === "organizations") {
    normalized.name = sanitizeString(rawRow.name);
    normalized.organizationType = normalizeLookupValue(rawRow.organizationType);
    normalized.email = sanitizeString(rawRow.email).toLowerCase();
    normalized.phone = sanitizeString(rawRow.phone);
    normalized.addressLine = sanitizeString(rawRow.addressLine);
    normalized.city = sanitizeString(rawRow.city);
    normalized.state = sanitizeString(rawRow.state);
    normalized.country = sanitizeString(rawRow.country);
    normalized.pincode = sanitizeString(rawRow.pincode);
    normalized.status = normalizeLookupValue(rawRow.status) || "active";
    normalized.parentOrganizationId = sanitizeString(rawRow.parentOrganizationId);
    normalized.parentOrganizationName = sanitizeString(rawRow.parentOrganizationName);

    if (!normalized.name) errors.push({ field: "name", message: "name is required" });
    if (!ORG_TYPES.has(normalized.organizationType)) {
      errors.push({
        field: "organizationType",
        message: "organizationType must be one of logistics, transport, school, taxi, fleet",
      });
    }
    if (!validateEmail(normalized.email)) {
      errors.push({ field: "email", message: "email must be valid" });
    }
    if (!validatePhone(normalized.phone)) {
      errors.push({ field: "phone", message: "phone must be a valid international number" });
    }
    if (normalized.status && !USER_STATUS.has(normalized.status)) {
      errors.push({ field: "status", message: "status must be one of active, inactive" });
    }
    if (normalized.parentOrganizationId && !mongoose.isValidObjectId(normalized.parentOrganizationId)) {
      errors.push({ field: "parentOrganizationId", message: "parentOrganizationId must be a valid ObjectId" });
    }
    return { normalized, errors };
  }

  if (entity === "users") {
    normalized.firstName = sanitizeString(rawRow.firstName);
    normalized.lastName = sanitizeString(rawRow.lastName);
    normalized.email = sanitizeString(rawRow.email).toLowerCase();
    normalized.mobile = sanitizeString(rawRow.mobile);
    normalized.role = normalizeLookupValue(rawRow.role);
    normalized.status = normalizeLookupValue(rawRow.status) || "active";
    normalized.password = sanitizeString(rawRow.password);

    if (!normalized.firstName) errors.push({ field: "firstName", message: "firstName is required" });
    if (!validateEmail(normalized.email)) errors.push({ field: "email", message: "email must be valid" });
    if (!validatePhone(normalized.mobile)) errors.push({ field: "mobile", message: "mobile must be a valid international number" });
    if (!USER_ROLES.has(normalized.role)) {
      errors.push({ field: "role", message: "role must be one of admin, driver" });
    }
    if (!USER_STATUS.has(normalized.status)) {
      errors.push({ field: "status", message: "status must be one of active, inactive" });
    }
    if (!normalized.password || normalized.password.length < 6) {
      errors.push({ field: "password", message: "password is required and must be at least 6 characters" });
    }
    return { normalized, errors };
  }

  if (entity === "vehicles") {
    normalized.vehicleType = normalizeLookupValue(rawRow.vehicleType);
    normalized.vehicleNumber = sanitizeString(rawRow.vehicleNumber).toUpperCase();
    normalized.ais140CertificateNumber = sanitizeString(rawRow.ais140CertificateNumber);
    normalized.make = sanitizeString(rawRow.make);
    normalized.model = sanitizeString(rawRow.model);
    normalized.color = sanitizeString(rawRow.color);
    normalized.status = normalizeLookupValue(rawRow.status) || "active";
    normalized.runningStatus = normalizeLookupValue(rawRow.runningStatus) || "inactive";
    normalized.deviceImei = sanitizeString(rawRow.deviceImei);

    const aisValue = parseBoolean(rawRow.ais140Compliant);
    if (aisValue !== null) normalized.ais140Compliant = aisValue;

    const yearValue = parseNumber(rawRow.year);
    if (yearValue !== null) normalized.year = yearValue;

    const lastUpdated = parseDate(rawRow.lastUpdated);
    if (lastUpdated) normalized.lastUpdated = lastUpdated;

    if (!VEHICLE_TYPES.has(normalized.vehicleType)) {
      errors.push({ field: "vehicleType", message: "vehicleType must be one of car, bus, truck, bike, other" });
    }
    if (!normalized.vehicleNumber) errors.push({ field: "vehicleNumber", message: "vehicleNumber is required" });
    if (!VEHICLE_STATUS.has(normalized.status)) {
      errors.push({ field: "status", message: "status must be one of active, inactive, maintenance, decommissioned" });
    }
    if (!VEHICLE_RUNNING_STATUS.has(normalized.runningStatus)) {
      errors.push({ field: "runningStatus", message: "runningStatus must be one of running, idle, stopped, inactive" });
    }
    if (normalized.year !== undefined) {
      const maxYear = new Date().getFullYear() + 1;
      if (!Number.isFinite(normalized.year) || normalized.year < 1900 || normalized.year > maxYear) {
        errors.push({ field: "year", message: `year must be between 1900 and ${maxYear}` });
      }
    }
    return { normalized, errors };
  }

  if (entity === "devices") {
    normalized.imei = sanitizeString(rawRow.imei);
    normalized.softwareVersion = sanitizeString(rawRow.softwareVersion);
    normalized.vendorId = sanitizeString(rawRow.vendorId) || "ROADRPA";
    normalized.deviceModel = sanitizeString(rawRow.deviceModel);
    normalized.manufacturer = sanitizeString(rawRow.manufacturer);
    normalized.simNumber = sanitizeString(rawRow.simNumber);
    normalized.serialNumber = sanitizeString(rawRow.serialNumber);
    normalized.firmwareVersion = sanitizeString(rawRow.firmwareVersion);
    normalized.hardwareVersion = sanitizeString(rawRow.hardwareVersion);
    normalized.vehicleRegistrationNumber = sanitizeString(rawRow.vehicleRegistrationNumber).toUpperCase();
    normalized.status = normalizeLookupValue(rawRow.status) || "active";

    const warrantyExpiry = parseDate(rawRow.warrantyExpiry);
    if (warrantyExpiry) normalized.warrantyExpiry = warrantyExpiry;

    if (!/^\d{15}$/.test(normalized.imei)) {
      errors.push({ field: "imei", message: "IMEI must be exactly 15 digits" });
    }
    if (!normalized.softwareVersion) {
      errors.push({ field: "softwareVersion", message: "softwareVersion is required" });
    }
    if (!GPS_DEVICE_STATUS.has(normalized.status)) {
      errors.push({ field: "status", message: "status must be one of active, inactive, suspended" });
    }
    return { normalized, errors };
  }

  if (entity === "drivers") {
    normalized.firstName = sanitizeString(rawRow.firstName);
    normalized.lastName = sanitizeString(rawRow.lastName);
    normalized.email = sanitizeString(rawRow.email).toLowerCase();
    normalized.phone = sanitizeString(rawRow.phone);
    normalized.licenseNumber = sanitizeString(rawRow.licenseNumber).toUpperCase();
    normalized.status = normalizeLookupValue(rawRow.status) || "active";
    normalized.password = sanitizeString(rawRow.password);

    const licenseExpiry = parseDate(rawRow.licenseExpiry);
    if (licenseExpiry) normalized.licenseExpiry = licenseExpiry;

    if (!normalized.firstName) errors.push({ field: "firstName", message: "firstName is required" });
    if (!normalized.lastName) errors.push({ field: "lastName", message: "lastName is required" });
    if (!validateEmail(normalized.email)) errors.push({ field: "email", message: "email must be valid" });
    if (!validatePhone(normalized.phone)) errors.push({ field: "phone", message: "phone must be a valid international number" });
    if (!normalized.licenseNumber) errors.push({ field: "licenseNumber", message: "licenseNumber is required" });
    if (!DRIVER_STATUS.has(normalized.status)) {
      errors.push({ field: "status", message: "status must be one of active, inactive, blocked" });
    }
    if (!normalized.password || normalized.password.length < 6) {
      errors.push({ field: "password", message: "password is required and must be at least 6 characters" });
    }
    return { normalized, errors };
  }

  if (entity === "devicemapping") {
    normalized.vehicleNumber = sanitizeString(rawRow.vehicleNumber).toUpperCase();
    normalized.imei = sanitizeString(rawRow.imei);

    if (!normalized.vehicleNumber) {
      errors.push({ field: "vehicleNumber", message: "vehicleNumber is required" });
    }
    if (!normalized.imei) {
      errors.push({ field: "imei", message: "imei is required" });
    } else if (!/^\d{15}$/.test(normalized.imei)) {
      errors.push({ field: "imei", message: "IMEI must be exactly 15 digits" });
    }

    return { normalized, errors };
  }

  if (entity === "drivermapping") {
    normalized.vehicleNumber = sanitizeString(rawRow.vehicleNumber).toUpperCase();
    normalized.driverEmail = sanitizeString(rawRow.driverEmail).toLowerCase();

    if (!normalized.vehicleNumber) {
      errors.push({ field: "vehicleNumber", message: "vehicleNumber is required" });
    }
    if (!validateEmail(normalized.driverEmail)) {
      errors.push({ field: "driverEmail", message: "driverEmail must be valid" });
    }

    return { normalized, errors };
  }

  return { normalized: rawRow, errors };
}

module.exports = {
  CHUNK_SIZE,
  sanitizeString,
  normalizeHeader,
  normalizeLookupValue,
  parseBoolean,
  parseNumber,
  parseDate,
  parseJsonField,
  detectFileType,
  validateUploadedFile,
  validateEntity,
  buildColumnMapping,
  getMissingRequiredMappings,
  normalizeImportedRow,
};
