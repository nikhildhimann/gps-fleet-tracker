const mongoose = require("mongoose");
const GpsDevice = require("./model");
const DeviceInventoryHistory = require("../deviceInventoryHistory/model");

const INVENTORY_STATUSES = [
  "in_stock",
  "assigned",
  "installed",
  "faulty",
  "repair",
  "retired",
];

const AUTO_SYNCABLE_STATUSES = ["in_stock", "assigned", "installed"];

const INVENTORY_DEFAULTS = Object.freeze({
  status: "in_stock",
  purchaseDate: null,
  purchasePrice: null,
  supplierName: "",
  invoiceNumber: "",
  stockLocation: "",
  rackNumber: "",
  faultReason: "",
  repairStatus: "",
  lastAuditAt: null,
  updatedAt: null,
  updatedBy: null,
});

const INVENTORY_PATCHABLE_FIELDS = [
  "status",
  "purchaseDate",
  "purchasePrice",
  "supplierName",
  "invoiceNumber",
  "stockLocation",
  "rackNumber",
  "faultReason",
  "repairStatus",
  "lastAuditAt",
];

const INVENTORY_PROTECTED_FIELDS = [
  "imei",
  "vehicleId",
  "organizationId",
  "connectionStatus",
  "isOnline",
  "configuration",
];

const INVENTORY_CREATE_FIELDS = [
  ...INVENTORY_PATCHABLE_FIELDS,
];

const asPlainObject = (value) =>
  value && typeof value.toObject === "function" ? value.toObject() : value || {};

const buildOrgScopeFilter = (orgScope) =>
  orgScope === "ALL" ? {} : { organizationId: { $in: orgScope } };

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeStringField = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null) return "";
  if (typeof value !== "string") {
    throw {
      status: 400,
      message: `${field} must be a string`,
    };
  }
  return value.trim();
};

const normalizeDateField = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw {
      status: 400,
      message: `${field} must be a valid date`,
    };
  }
  return parsed;
};

const normalizeNumberField = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw {
      status: 400,
      message: `${field} must be a valid non-negative number`,
    };
  }
  return parsed;
};

const resolveInventoryStatus = (device = {}) => {
  const explicitStatus = device?.inventory?.status;
  if (explicitStatus && INVENTORY_STATUSES.includes(explicitStatus)) {
    return explicitStatus;
  }

  if (device?.isOnline || device?.connectionStatus === "online") return "installed";
  if (device?.vehicleId) return "assigned";
  return "in_stock";
};

const canAutoSyncInventoryStatus = (currentStatus) =>
  !currentStatus || AUTO_SYNCABLE_STATUSES.includes(currentStatus);

const attachInventorySnapshot = (device) => {
  if (!device) return device;

  const source = asPlainObject(device);
  source.inventory = {
    ...INVENTORY_DEFAULTS,
    ...asPlainObject(source.inventory),
    status: resolveInventoryStatus(source),
  };

  return source;
};

const buildInventoryStatusClause = (status) => {
  if (!INVENTORY_STATUSES.includes(status)) {
    throw {
      status: 400,
      message: `inventory.status must be one of: ${INVENTORY_STATUSES.join(", ")}`,
    };
  }

  if (status === "installed") {
    return {
      $or: [
        { "inventory.status": "installed" },
        {
          "inventory.status": { $exists: false },
          $or: [{ isOnline: true }, { connectionStatus: "online" }],
        },
      ],
    };
  }

  if (status === "assigned") {
    return {
      $or: [
        { "inventory.status": "assigned" },
        {
          "inventory.status": { $exists: false },
          vehicleId: { $ne: null },
          isOnline: { $ne: true },
          connectionStatus: { $ne: "online" },
        },
      ],
    };
  }

  if (status === "in_stock") {
    return {
      $or: [
        { "inventory.status": "in_stock" },
        {
          "inventory.status": { $exists: false },
          $or: [{ vehicleId: null }, { vehicleId: { $exists: false } }],
          isOnline: { $ne: true },
          connectionStatus: { $ne: "online" },
        },
      ],
    };
  }

  return { "inventory.status": status };
};

const buildWarrantyClause = (value) => {
  const normalized = String(value).trim().toLowerCase();

  if (!normalized) return null;
  if (normalized === "expired") {
    return { warrantyExpiry: { $lt: new Date() } };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw {
      status: 400,
      message: "warrantyExpiry must be a valid date or 'expired'",
    };
  }

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return {
    warrantyExpiry: {
      $gte: start,
      $lte: end,
    },
  };
};

const buildInventoryFilter = (query = {}, orgScope) => {
  const clauses = [];
  const orgFilter = buildOrgScopeFilter(orgScope);

  if (Object.keys(orgFilter).length) {
    clauses.push(orgFilter);
  }

  const status = query["inventory.status"] || query.inventoryStatus || query.status;
  if (status) {
    clauses.push(buildInventoryStatusClause(String(status).trim()));
  }

  if (query.warrantyExpiry) {
    clauses.push(buildWarrantyClause(query.warrantyExpiry));
  }

  if (typeof query.manufacturer === "string" && query.manufacturer.trim()) {
    clauses.push({
      manufacturer: { $regex: escapeRegExp(query.manufacturer.trim()), $options: "i" },
    });
  }

  if (typeof query.supplierName === "string" && query.supplierName.trim()) {
    clauses.push({
      "inventory.supplierName": {
        $regex: escapeRegExp(query.supplierName.trim()),
        $options: "i",
      },
    });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
};

const sanitizeInventoryPayload = (payload = {}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw {
      status: 400,
      message: "Inventory payload must be an object",
    };
  }

  const updates = {};

  Object.keys(payload).forEach((field) => {
    if (!INVENTORY_PATCHABLE_FIELDS.includes(field)) {
      throw {
        status: 400,
        message: `Invalid inventory field: ${field}`,
      };
    }
  });

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    if (!INVENTORY_STATUSES.includes(payload.status)) {
      throw {
        status: 400,
        message: `inventory.status must be one of: ${INVENTORY_STATUSES.join(", ")}`,
      };
    }
    updates.status = payload.status;
  }

  const purchaseDate = normalizeDateField(payload.purchaseDate, "purchaseDate");
  if (purchaseDate !== undefined) updates.purchaseDate = purchaseDate;

  const purchasePrice = normalizeNumberField(payload.purchasePrice, "purchasePrice");
  if (purchasePrice !== undefined) updates.purchasePrice = purchasePrice;

  ["supplierName", "invoiceNumber", "stockLocation", "rackNumber", "faultReason", "repairStatus"].forEach(
    (field) => {
      const normalized = normalizeStringField(payload[field], field);
      if (normalized !== undefined) {
        updates[field] = normalized;
      }
    },
  );

  const lastAuditAt = normalizeDateField(payload.lastAuditAt, "lastAuditAt");
  if (lastAuditAt !== undefined) updates.lastAuditAt = lastAuditAt;

  return updates;
};

const sanitizeInventoryCreatePayload = (payload = {}, userId = null) => {
  if (payload === undefined || payload === null) {
    return {
      status: "in_stock",
    };
  }

  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw {
      status: 400,
      message: "inventory must be an object",
    };
  }

  Object.keys(payload).forEach((field) => {
    if (!INVENTORY_CREATE_FIELDS.includes(field)) {
      throw {
        status: 400,
        message: `Invalid inventory field: ${field}`,
      };
    }
  });

  const updates = sanitizeInventoryPayload(payload);

  return {
    ...updates,
    status: updates.status || "in_stock",
    updatedAt: new Date(),
    updatedBy: userId || null,
  };
};

const toInventorySetOperations = (inventoryUpdates = {}) =>
  Object.entries(inventoryUpdates).reduce((acc, [key, value]) => {
    acc[`inventory.${key}`] = value;
    return acc;
  }, {});

const extractInventoryPatchPayload = (body = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw {
      status: 400,
      message: "Inventory payload must be an object",
    };
  }

  const topLevelKeys = Object.keys(body);
  const forbiddenTopLevel = topLevelKeys.filter((key) => INVENTORY_PROTECTED_FIELDS.includes(key));

  if (forbiddenTopLevel.length) {
    throw {
      status: 400,
      message: `Inventory endpoint cannot modify technical fields: ${forbiddenTopLevel.join(", ")}`,
    };
  }

  if (Object.prototype.hasOwnProperty.call(body, "inventory")) {
    const extraKeys = topLevelKeys.filter((key) => key !== "inventory");
    if (extraKeys.length) {
      throw {
        status: 400,
        message: `Inventory endpoint accepts only the inventory object when provided. Invalid fields: ${extraKeys.join(", ")}`,
      };
    }

    if (!body.inventory || typeof body.inventory !== "object" || Array.isArray(body.inventory)) {
      throw {
        status: 400,
        message: "inventory must be an object",
      };
    }

    return body.inventory;
  }

  return body;
};

const resolveInventoryHistoryReason = (inventoryUpdates = {}, explicitReason = "") => {
  const normalizedExplicitReason = normalizeStringField(explicitReason, "reason");
  if (normalizedExplicitReason) {
    return normalizedExplicitReason;
  }

  if (inventoryUpdates.faultReason) {
    return inventoryUpdates.faultReason;
  }

  if (inventoryUpdates.repairStatus) {
    return inventoryUpdates.repairStatus;
  }

  return "";
};

const createInventoryHistoryEntry = async ({
  deviceId,
  organizationId,
  previousStatus,
  newStatus,
  reason = "",
  changedBy = null,
  changedAt = new Date(),
  session,
}) => {
  if (!deviceId || !organizationId || !previousStatus || !newStatus) return null;

  const queryOptions = session ? { session } : {};

  const [entry] = await DeviceInventoryHistory.create(
    [
      {
        deviceId,
        organizationId,
        previousStatus,
        newStatus,
        reason,
        changedBy,
        changedAt,
      },
    ],
    queryOptions,
  );

  return entry;
};

const getInventoryHistoryForDevice = async (deviceId, options = {}) => {
  if (!deviceId || !mongoose.isValidObjectId(deviceId)) return [];

  const query = DeviceInventoryHistory.find({ deviceId })
    .sort({ changedAt: 1 })
    .populate("changedBy", "firstName lastName email");

  if (options.session) {
    query.session(options.session);
  }

  return query.lean();
};

const syncInventoryStatus = async (deviceOrId, nextStatus, options = {}) => {
  const { session, preserveManual = true } = options;
  const deviceId =
    deviceOrId && typeof deviceOrId === "object" && deviceOrId._id ? deviceOrId._id : deviceOrId;

  if (!deviceId || !mongoose.isValidObjectId(deviceId)) return;
  if (!INVENTORY_STATUSES.includes(nextStatus)) return;

  const filter = { _id: deviceId };

  if (preserveManual) {
    filter.$or = [
      { inventory: { $exists: false } },
      { "inventory.status": { $exists: false } },
      { "inventory.status": { $in: AUTO_SYNCABLE_STATUSES } },
    ];
  }

  const queryOptions = session ? { session } : {};

  await GpsDevice.updateOne(
    filter,
    {
      $set: {
        "inventory.status": nextStatus,
      },
    },
    queryOptions,
  );
};

module.exports = {
  INVENTORY_DEFAULTS,
  INVENTORY_STATUSES,
  attachInventorySnapshot,
  buildInventoryFilter,
  buildOrgScopeFilter,
  canAutoSyncInventoryStatus,
  createInventoryHistoryEntry,
  extractInventoryPatchPayload,
  getInventoryHistoryForDevice,
  INVENTORY_PROTECTED_FIELDS,
  resolveInventoryStatus,
  resolveInventoryHistoryReason,
  sanitizeInventoryCreatePayload,
  sanitizeInventoryPayload,
  syncInventoryStatus,
  toInventorySetOperations,
};
