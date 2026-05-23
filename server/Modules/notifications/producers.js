const Notification = require("./model");
const Alert = require("../alerts/model");
const { createNotification } = require("./service");

const DEFAULT_CONTEXT = {
  user: null,
  orgScope: "ALL",
};

const ENTITY_LABELS = {
  organizations: "Organization",
  users: "User",
  devices: "GPS Device",
  drivers: "Driver",
  vehicles: "Vehicle",
  devicemapping: "Device Mapping",
  drivermapping: "Driver Mapping",
};

const ADMIN_ROUTE_HINTS = {
  organizations: "/admin/organizations",
  users: "/admin/users",
  devices: "/admin/gps-devices",
  drivers: "/admin/drivers",
  vehicles: "/admin/vehicles",
  devicemapping: "/admin/device-mapping",
  drivermapping: "/admin/driver-mapping",
};

const buildContextFromReq = (req) => ({
  user: req?.user || null,
  orgScope: req?.orgScope ?? (req?.user?.role === "superadmin" ? "ALL" : []),
});

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === "string" || typeof value === "number") {
    const stringValue = String(value).trim();
    return stringValue || null;
  }
  if (typeof value === "object" && value._id) {
    return normalizeId(value._id);
  }
  return null;
};

const trimText = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const personName = (person) => {
  const firstName = trimText(person?.firstName);
  const lastName = trimText(person?.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || trimText(person?.email) || trimText(person?.phone) || "Driver";
};

const vehicleLabel = (vehicle, fallbackVehicleNumber) => {
  const vehicleNumber =
    trimText(vehicle?.vehicleNumber) ||
    trimText(vehicle?.vehicleRegistrationNumber) ||
    trimText(fallbackVehicleNumber);

  return vehicleNumber ? `Vehicle ${vehicleNumber}` : "Vehicle";
};

const deviceLabel = (device, fallbackImei) => {
  const imei = trimText(device?.imei) || trimText(fallbackImei);
  return imei ? `GPS device ${imei}` : "GPS device";
};

const formatImportMessage = (result, entity) => {
  const processedRows = Number(result?.processedRows ?? 0);
  const successfulRows = Number(result?.successfulRows ?? 0);
  const failedRows = Number(result?.failedRows ?? 0);
  const duplicateRows = Number(result?.duplicateRows ?? 0);

  const baseMessage = `Processed ${processedRows} row(s): ${successfulRows} imported, ${failedRows} failed, ${duplicateRows} duplicates.`;

  if (entity === "organizations" && successfulRows > 0) {
    return `${baseMessage} Organization admin login users must still be created separately.`;
  }

  return baseMessage;
};

const sanitizeErrorMessage = (error) => {
  const message = trimText(error?.message);
  if (!message) {
    return "The operation failed before completion.";
  }

  return message.length > 300 ? `${message.slice(0, 297)}...` : message;
};

const mergeMetadata = (metadata, sourceKey, cooldownKey) => {
  const merged = {
    ...(metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}),
  };

  if (sourceKey) merged.sourceKey = sourceKey;
  if (cooldownKey) merged.cooldownKey = cooldownKey;

  return merged;
};

const emitNotification = async (payload, options = {}) => {
  const context = {
    ...DEFAULT_CONTEXT,
    ...(options.context || {}),
  };

  const sourceKey = trimText(options.sourceKey);
  const cooldownKey = trimText(options.cooldownKey);
  const cooldownMs = Number(options.cooldownMs || 0);

  if (sourceKey) {
    const existingBySource = await Notification.findOne({
      "metadata.sourceKey": sourceKey,
    })
      .select("_id")
      .lean();

    if (existingBySource) {
      return {
        status: "skipped",
        reason: "duplicate_source",
        notificationId: existingBySource._id,
      };
    }
  }

  if (cooldownKey && cooldownMs > 0) {
    const since = new Date(Date.now() - cooldownMs);
    const existingByCooldown = await Notification.findOne({
      "metadata.cooldownKey": cooldownKey,
      occurredAt: { $gte: since },
    })
      .sort({ occurredAt: -1 })
      .select("_id occurredAt")
      .lean();

    if (existingByCooldown) {
      return {
        status: "skipped",
        reason: "cooldown",
        notificationId: existingByCooldown._id,
      };
    }
  }

  const notification = await createNotification(
    {
      ...payload,
      metadata: mergeMetadata(payload.metadata, sourceKey, cooldownKey),
    },
    context,
  );

  return {
    status: "created",
    notification,
  };
};

const emitNotificationSafely = async (payload, options = {}) => {
  try {
    return await emitNotification(payload, options);
  } catch (error) {
    console.error("Notification producer error:", {
      title: payload?.title,
      sourceKey: options?.sourceKey || null,
      message: error.message,
    });

    return {
      status: "error",
      error,
    };
  }
};

const ALERT_RULES = {
  "Emergency On": {
    type: "alert",
    severity: "critical",
    title: "Emergency alert triggered",
    cooldownMs: 60 * 1000,
  },
  "Emergency Off": {
    type: "alert",
    severity: "success",
    title: "Emergency alert cleared",
    cooldownMs: 60 * 1000,
  },
  Overspeed: {
    type: "alert",
    severity: "warning",
    title: "Overspeed detected",
    cooldownMs: 5 * 60 * 1000,
  },
  "Ignition On": {
    type: "alert",
    severity: "info",
    title: "Ignition turned on",
    cooldownMs: 2 * 60 * 1000,
  },
  "Ignition Off": {
    type: "alert",
    severity: "info",
    title: "Ignition turned off",
    cooldownMs: 2 * 60 * 1000,
  },
  "Low Battery": {
    type: "device_health",
    severity: "warning",
    title: "Low battery detected",
    cooldownMs: 15 * 60 * 1000,
  },
  "Low Battery Removed": {
    type: "device_health",
    severity: "success",
    title: "Battery level recovered",
    cooldownMs: 15 * 60 * 1000,
  },
  "Main Power Disconnected": {
    type: "device_health",
    severity: "warning",
    title: "Main power disconnected",
    cooldownMs: 10 * 60 * 1000,
  },
  "Main Power Connected": {
    type: "device_health",
    severity: "success",
    title: "Main power restored",
    cooldownMs: 10 * 60 * 1000,
  },
  "Tamper Alert": {
    type: "device_health",
    severity: "critical",
    title: "Tamper alert detected",
    cooldownMs: 10 * 60 * 1000,
  },
  "Wire Disconnect": {
    type: "device_health",
    severity: "critical",
    title: "Wire disconnect detected",
    cooldownMs: 10 * 60 * 1000,
  },
  "Tilt Alert": {
    type: "device_health",
    severity: "critical",
    title: "Tilt alert detected",
    cooldownMs: 10 * 60 * 1000,
  },
  "Harsh Braking": {
    type: "alert",
    severity: "warning",
    title: "Harsh braking detected",
    cooldownMs: 2 * 60 * 1000,
  },
  "Harsh Acceleration": {
    type: "alert",
    severity: "warning",
    title: "Harsh acceleration detected",
    cooldownMs: 2 * 60 * 1000,
  },
  "Rash Turning": {
    type: "alert",
    severity: "warning",
    title: "Rash turning detected",
    cooldownMs: 2 * 60 * 1000,
  },
  "OTA Alert": {
    type: "device_health",
    severity: "info",
    title: "Device OTA alert received",
    cooldownMs: 5 * 60 * 1000,
  },
};

const buildAlertMessage = (alert) => {
  const alertName = trimText(alert?.alertName) || "Alert";
  const primaryVehicleLabel = vehicleLabel(alert?.vehicleId, alert?.vehicleRegistrationNumber);
  const primaryDeviceLabel = deviceLabel(alert?.deviceId || alert?.gpsDeviceId, alert?.imei);

  if (alertName === "Overspeed") {
    const speedText = typeof alert?.speed === "number" ? ` at ${alert.speed} km/h` : "";
    return `${primaryVehicleLabel} exceeded the configured speed threshold${speedText}.`;
  }

  if (alertName === "Emergency On") {
    return `${primaryVehicleLabel} triggered an emergency/SOS alert.`;
  }

  if (alertName === "Emergency Off") {
    return `${primaryVehicleLabel} emergency state was cleared.`;
  }

  if (alertName === "Ignition On") {
    return `${primaryVehicleLabel} ignition turned on.`;
  }

  if (alertName === "Ignition Off") {
    return `${primaryVehicleLabel} ignition turned off.`;
  }

  if (alertName === "Low Battery") {
    return `${primaryDeviceLabel} reported a low battery condition.`;
  }

  if (alertName === "Low Battery Removed") {
    return `${primaryDeviceLabel} battery level returned to normal.`;
  }

  if (alertName === "Main Power Disconnected") {
    return `${primaryDeviceLabel} lost main power.`;
  }

  if (alertName === "Main Power Connected") {
    return `${primaryDeviceLabel} main power was restored.`;
  }

  if (alertName === "Tamper Alert" || alertName === "Wire Disconnect" || alertName === "Tilt Alert") {
    return `${primaryDeviceLabel} reported ${alertName.toLowerCase()}.`;
  }

  if (
    alertName === "Harsh Braking" ||
    alertName === "Harsh Acceleration" ||
    alertName === "Rash Turning"
  ) {
    return `${primaryVehicleLabel} reported ${alertName.toLowerCase()}.`;
  }

  return `${primaryVehicleLabel} generated a ${alertName.toLowerCase()} notification.`;
};

const createNotificationFromAlert = async (alert, contextInput = {}) => {
  const alertId = normalizeId(alert?._id);
  const alertName = trimText(alert?.alertName);

  if (!alertId || !alertName || alertName === "Location Update") {
    return {
      status: "skipped",
      reason: "non_actionable_alert",
    };
  }

  const rule = ALERT_RULES[alertName] || {
    type: "alert",
    severity:
      trimText(alert?.severity) && ["critical", "warning", "info", "success"].includes(alert.severity)
        ? alert.severity
        : "info",
    title: alertName,
    cooldownMs: 0,
  };

  const organizationId = normalizeId(alert.organizationId);
  const vehicleId = normalizeId(alert.vehicleId);
  const deviceId = normalizeId(alert.deviceId || alert.gpsDeviceId);
  const cooldownTarget = vehicleId || deviceId || trimText(alert.imei) || organizationId || "global";
  const sourceKey = `alert:${alertId}`;
  const cooldownKey = `alert:${organizationId || "global"}:${alertName}:${cooldownTarget}`;

  const result = await emitNotificationSafely(
    {
      title: rule.title,
      message: buildAlertMessage(alert),
      type: rule.type,
      severity: rule.severity,
      organizationId,
      vehicleId,
      deviceId,
      alertId,
      entityType: "alert",
      entityId: alertId,
      actionUrl: "/admin/history",
      occurredAt: alert.gpsTimestamp || alert.createdAt || new Date(),
      metadata: {
        alertName,
        alertCode: alert.alertId || null,
        imei: trimText(alert.imei) || null,
        speed: typeof alert.speed === "number" ? alert.speed : null,
      },
    },
    {
      context: {
        ...DEFAULT_CONTEXT,
        ...contextInput,
      },
      sourceKey,
      cooldownKey,
      cooldownMs: rule.cooldownMs,
    },
  );

  if (result.status === "created") {
    await Alert.updateOne(
      { _id: alertId },
      {
        $set: {
          notificationSent: true,
          notificationSentAt: new Date(),
        },
      },
    ).catch((error) => {
      console.error("Failed to update alert notification flags:", error.message);
    });
  }

  return result;
};

const createDeviceMappingNotification = async (
  { action, mappingId, organizationId, vehicle, device },
  contextInput = {},
) => {
  const normalizedAction = action === "unassigned" ? "unassigned" : "assigned";
  const sourceKey = `mapping:device:${normalizedAction}:${normalizeId(mappingId)}`;

  return emitNotificationSafely(
    {
      title:
        normalizedAction === "assigned"
          ? "GPS device mapped to vehicle"
          : "GPS device unmapped from vehicle",
      message:
        normalizedAction === "assigned"
          ? `${deviceLabel(device)} was mapped to ${vehicleLabel(vehicle)}.`
          : `${deviceLabel(device)} was removed from ${vehicleLabel(vehicle)}.`,
      type: "mapping",
      severity: normalizedAction === "assigned" ? "success" : "info",
      organizationId: normalizeId(organizationId) || normalizeId(vehicle?.organizationId) || normalizeId(device?.organizationId),
      vehicleId: normalizeId(vehicle?._id) || normalizeId(vehicle),
      deviceId: normalizeId(device?._id) || normalizeId(device),
      entityType: "device_mapping",
      entityId: normalizeId(mappingId),
      mappingId: normalizeId(mappingId),
      actionUrl: "/admin/device-mapping",
      metadata: {
        action: normalizedAction,
        mappingKind: "device",
        vehicleNumber: trimText(vehicle?.vehicleNumber) || null,
        imei: trimText(device?.imei) || null,
      },
    },
    {
      context: {
        ...DEFAULT_CONTEXT,
        ...contextInput,
      },
      sourceKey,
    },
  );
};

const createDriverMappingNotification = async (
  { action, mappingId, organizationId, vehicle, driver },
  contextInput = {},
) => {
  const normalizedAction = action === "unassigned" ? "unassigned" : "assigned";
  const sourceKey = `mapping:driver:${normalizedAction}:${normalizeId(mappingId)}`;

  return emitNotificationSafely(
    {
      title:
        normalizedAction === "assigned"
          ? "Driver assigned to vehicle"
          : "Driver removed from vehicle",
      message:
        normalizedAction === "assigned"
          ? `${personName(driver)} was assigned to ${vehicleLabel(vehicle)}.`
          : `${personName(driver)} was removed from ${vehicleLabel(vehicle)}.`,
      type: "mapping",
      severity: normalizedAction === "assigned" ? "success" : "info",
      organizationId: normalizeId(organizationId) || normalizeId(vehicle?.organizationId) || normalizeId(driver?.organizationId),
      vehicleId: normalizeId(vehicle?._id) || normalizeId(vehicle),
      driverId: normalizeId(driver?._id) || normalizeId(driver),
      entityType: "driver_mapping",
      entityId: normalizeId(mappingId),
      mappingId: normalizeId(mappingId),
      actionUrl: "/admin/driver-mapping",
      metadata: {
        action: normalizedAction,
        mappingKind: "driver",
        vehicleNumber: trimText(vehicle?.vehicleNumber) || null,
        driverName: personName(driver),
      },
    },
    {
      context: {
        ...DEFAULT_CONTEXT,
        ...contextInput,
      },
      sourceKey,
    },
  );
};

const createOrganizationCreatedNotification = async (
  { organization, createdWithAdmin = false, isSubOrganization = false },
  contextInput = {},
) =>
  emitNotificationSafely(
    {
      title: isSubOrganization ? "New sub-organization created" : "New organization created",
      message: `${trimText(organization?.name) || "Organization"} was created${createdWithAdmin ? " with an admin account" : ""}.`,
      type: "admin",
      severity: "success",
      organizationId: normalizeId(organization?._id),
      entityType: "organization",
      entityId: normalizeId(organization?._id),
      actionUrl: "/admin/organizations",
      metadata: {
        action: "created",
        organizationName: trimText(organization?.name) || null,
        organizationType: trimText(organization?.organizationType) || null,
        createdWithAdmin,
        isSubOrganization,
      },
    },
    {
      context: {
        ...DEFAULT_CONTEXT,
        ...contextInput,
      },
      sourceKey: `admin:organization:create:${normalizeId(organization?._id)}`,
    },
  );

const createVehicleCreatedNotification = async ({ vehicle }, contextInput = {}) =>
  emitNotificationSafely(
    {
      title: "New vehicle added",
      message: `${vehicleLabel(vehicle)} was added to the fleet.`,
      type: "admin",
      severity: "success",
      organizationId: normalizeId(vehicle?.organizationId),
      vehicleId: normalizeId(vehicle?._id),
      entityType: "vehicle",
      entityId: normalizeId(vehicle?._id),
      actionUrl: "/admin/vehicles",
      metadata: {
        action: "created",
        vehicleNumber: trimText(vehicle?.vehicleNumber) || null,
        vehicleType: trimText(vehicle?.vehicleType) || null,
      },
    },
    {
      context: {
        ...DEFAULT_CONTEXT,
        ...contextInput,
      },
      sourceKey: `admin:vehicle:create:${normalizeId(vehicle?._id)}`,
    },
  );

const createGpsDeviceCreatedNotification = async ({ device }, contextInput = {}) =>
  emitNotificationSafely(
    {
      title: "New GPS device added",
      message: `${deviceLabel(device)} was added to the inventory.`,
      type: "admin",
      severity: "success",
      organizationId: normalizeId(device?.organizationId),
      deviceId: normalizeId(device?._id),
      entityType: "gps_device",
      entityId: normalizeId(device?._id),
      actionUrl: "/admin/gps-devices",
      metadata: {
        action: "created",
        imei: trimText(device?.imei) || null,
        model: trimText(device?.deviceModel) || null,
      },
    },
    {
      context: {
        ...DEFAULT_CONTEXT,
        ...contextInput,
      },
      sourceKey: `admin:gps-device:create:${normalizeId(device?._id)}`,
    },
  );

const createImportNotification = async (
  { entity, result, req, file },
  contextInput = {},
) => {
  const entityLabel = ENTITY_LABELS[entity] || "Import";
  const hasWarnings = Number(result?.failedRows || 0) > 0 || Number(result?.duplicateRows || 0) > 0;
  const isSuccess = Boolean(result?.success);
  const severity = isSuccess ? "success" : hasWarnings ? "warning" : "info";
  const title = isSuccess
    ? `${entityLabel} import completed`
    : result?.status
      ? `${entityLabel} import completed with warnings`
      : `${entityLabel} import finished with no imported rows`;
  const organizationId =
    normalizeId(req?.body?.organizationId) ||
    normalizeId(req?.user?.organizationId) ||
    null;

  return emitNotificationSafely(
    {
      title,
      message: formatImportMessage(result, entity),
      type: "import",
      severity,
      organizationId,
      entityType: "import",
      entityId: trimText(entity),
      actionUrl: ADMIN_ROUTE_HINTS[entity] || null,
      metadata: {
        action: "import",
        entity,
        fileName: trimText(file?.originalname) || trimText(file?.filename) || null,
        summary: {
          totalRows: Number(result?.totalRows || 0),
          processedRows: Number(result?.processedRows || 0),
          successfulRows: Number(result?.successfulRows || 0),
          failedRows: Number(result?.failedRows || 0),
          duplicateRows: Number(result?.duplicateRows || 0),
          inserted: Number(result?.summary?.inserted || 0),
          updated: Number(result?.summary?.updated || 0),
        },
      },
    },
    {
      context: {
        ...DEFAULT_CONTEXT,
        ...buildContextFromReq(req),
        ...contextInput,
      },
      cooldownKey: `import:${entity}:${organizationId || "global"}:${trimText(file?.filename) || trimText(file?.originalname) || "unknown"}:${Number(result?.processedRows || 0)}:${Number(result?.successfulRows || 0)}:${Number(result?.failedRows || 0)}:${Number(result?.duplicateRows || 0)}`,
      cooldownMs: 60 * 1000,
    },
  );
};

const createImportFailureNotification = async (
  { entity, req, file, error },
  contextInput = {},
) => {
  const entityLabel = ENTITY_LABELS[entity] || "Import";
  const organizationId =
    normalizeId(req?.body?.organizationId) ||
    normalizeId(req?.user?.organizationId) ||
    null;
  const severity = error?.status && error.status >= 500 ? "critical" : "warning";

  return emitNotificationSafely(
    {
      title: `${entityLabel} import failed`,
      message: sanitizeErrorMessage(error),
      type: "import",
      severity,
      organizationId,
      entityType: "import",
      entityId: trimText(entity),
      actionUrl: ADMIN_ROUTE_HINTS[entity] || null,
      metadata: {
        action: "import_failed",
        entity,
        fileName: trimText(file?.originalname) || trimText(file?.filename) || null,
        statusCode: error?.status || null,
      },
    },
    {
      context: {
        ...DEFAULT_CONTEXT,
        ...buildContextFromReq(req),
        ...contextInput,
      },
      cooldownKey: `import-failed:${entity}:${organizationId || "global"}:${trimText(file?.filename) || trimText(file?.originalname) || "unknown"}:${sanitizeErrorMessage(error)}`,
      cooldownMs: 60 * 1000,
    },
  );
};

module.exports = {
  buildContextFromReq,
  emitNotification,
  emitNotificationSafely,
  createNotificationFromAlert,
  createDeviceMappingNotification,
  createDriverMappingNotification,
  createImportNotification,
  createImportFailureNotification,
  createOrganizationCreatedNotification,
  createVehicleCreatedNotification,
  createGpsDeviceCreatedNotification,
};
