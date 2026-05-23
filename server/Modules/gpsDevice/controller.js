const GpsDevice = require("./model");
const Validator = require("../../helpers/validators");
const mongoose = require("mongoose");
const paginate = require("../../helpers/limitoffset");
const { cleanupForGpsDeviceDeletion } = require("../../common/mappingCleanup");
const {
  attachInventorySnapshot,
  buildInventoryFilter,
  buildOrgScopeFilter,
  createInventoryHistoryEntry,
  extractInventoryPatchPayload,
  getInventoryHistoryForDevice,
  resolveInventoryHistoryReason,
  resolveInventoryStatus,
  sanitizeInventoryCreatePayload,
  sanitizeInventoryPayload,
  toInventorySetOperations,
} = require("./service");
const {
  buildContextFromReq,
  createGpsDeviceCreatedNotification,
} = require("../notifications/producers");

const normalizeGpsDevicePayload = (data = {}) => {
  const payload = { ...data };

  if (typeof payload.imei === "string") {
    payload.imei = payload.imei.trim();
  }

  if (typeof payload.firmwareVersion === "string") {
    payload.firmwareVersion = payload.firmwareVersion.trim();
  }

  if (typeof payload.softwareVersion === "string") {
    payload.softwareVersion = payload.softwareVersion.trim();
  }

  if (!payload.softwareVersion && payload.firmwareVersion) {
    payload.softwareVersion = payload.firmwareVersion;
  }

  if (!payload.firmwareVersion && payload.softwareVersion) {
    payload.firmwareVersion = payload.softwareVersion;
  }

  return payload;
};

const inventoryPopulate = [
  { path: "vehicleId", select: "vehicleNumber vehicleType make model status" },
  { path: "organizationId", select: "name" },
];

/* -------------------------------------------------------------------------- */
/*                               VALIDATIONS                                  */
/* -------------------------------------------------------------------------- */

const validateCreateGpsDevice = async (data, user) => {
  const rules = {
    imei: "required|string|size:15",
    softwareVersion: "required|string",
    status: "in:active,inactive,suspended",
  };

  if (user.role === "superadmin") {
    rules.organizationId = "required|string";
  }

  const validator = new Validator(data, rules);
  await validator.validate();
};

const validateUpdateGpsDevice = async (data, user) => {
  const rules = {
    imei: "string|size:15",
    softwareVersion: "string",
    vehicleRegistrationNumber: "string",
    status: "in:active,inactive,suspended",
    organizationId: "string",
    vehicleId: "string",
    configuration: "object",
    simNumber: "string",
    deviceModel: "string",
    manufacturer: "string",
    serialNumber: "string",
    firmwareVersion: "string",
    hardwareVersion: "string",
    warrantyExpiry: "string",
  };

  const allowedFields = Object.keys(rules);

  Object.keys(data).forEach((key) => {
    if (!allowedFields.includes(key)) {
      throw {
        status: 400,
        message: `Invalid field: ${key}`,
      };
    }
  });

  const validator = new Validator(data, rules);
  await validator.validate();
};

/* -------------------------------------------------------------------------- */
/*                                   CREATE                                   */
/* -------------------------------------------------------------------------- */

exports.create = async (req, res) => {
  try {
    const payload = normalizeGpsDevicePayload(req.body);
    const inventoryPayload = sanitizeInventoryCreatePayload(payload.inventory, req.user?._id);
    delete payload.inventory;
    delete payload.isOnline;
    delete payload.connectionStatus;
    await validateCreateGpsDevice(payload, req.user);

    // 🔐 ORG SCOPE FIX
    let organizationId;
    if (req.user.role === "superadmin") {
      organizationId = payload.organizationId || req.orgId;
    } else if (
      payload.organizationId &&
      req.orgScope !== "ALL" &&
      Array.isArray(req.orgScope) &&
      req.orgScope.some(id => id.toString() === payload.organizationId.toString())
    ) {
      organizationId = payload.organizationId;
    } else {
      organizationId = req.orgId;
    }

    if (!organizationId) {
      return res.status(400).json({
        status: false,
        message: "OrganizationId is required",
      });
    }

    const existing = await GpsDevice.findOne({
      imei: payload.imei,
    });

    if (existing) {
      return res.status(409).json({
        status: false,
        message: "GPS Device with this IMEI already exists",
      });
    }

    const device = await GpsDevice.create({
      ...payload,
      inventory: inventoryPayload,
      isOnline: false,
      connectionStatus: "offline",
      organizationId,
      createdBy: req.user._id,
    });

    // 🌊 Post-create logic (isolated)
    try {
      createGpsDeviceCreatedNotification(
        { device },
        buildContextFromReq(req),
      );
    } catch (notifErr) {
      console.warn("Notification failed for GPS device creation:", notifErr.message);
    }

    return res.status(201).json({
      status: true,
      message: "GPS Device created successfully",
      data: device,
    });
  } catch (error) {
    console.error("Create GPS Device Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   GET ALL                                  */
/* -------------------------------------------------------------------------- */

exports.getAll = async (req, res) => {
  try {
    const {
      status,
      isOnline,
      page,
      limit,
      search,
      organizationId,
      imei,
      model,
      firmware,
      simNumber,
      connectionStatus,
      assigned,
      vehicleNumber,
      warrantyExpiry,
    } = req.query;

    const filter = {};

    // 🔐 orgScope filter
    if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
      filter.organizationId = { $in: req.orgScope };
    }

    if (organizationId) {
      if (req.user.role === "superadmin" || req.orgScope === "ALL") {
        filter.organizationId = organizationId;
      } else if (
        Array.isArray(req.orgScope) &&
        req.orgScope.some((id) => id.toString() === String(organizationId))
      ) {
        filter.organizationId = organizationId;
      }
    }

    // 🎯 extra filters
    if (status) filter.status = status;
    if (isOnline !== undefined) filter.isOnline = isOnline === "true";
    if (imei) filter.imei = { $regex: String(imei).trim(), $options: "i" };
    if (model) filter.deviceModel = { $regex: String(model).trim(), $options: "i" };
    if (simNumber) filter.simNumber = { $regex: String(simNumber).trim(), $options: "i" };
    if (connectionStatus) filter.connectionStatus = connectionStatus;
    if (vehicleNumber) {
      filter.vehicleRegistrationNumber = {
        $regex: String(vehicleNumber).trim().toUpperCase(),
        $options: "i",
      };
    }
    if (firmware) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { firmwareVersion: { $regex: String(firmware).trim(), $options: "i" } },
            { softwareVersion: { $regex: String(firmware).trim(), $options: "i" } },
          ],
        },
      ];
    }
    if (assigned === "assigned") {
      filter.vehicleId = { $ne: null };
    } else if (assigned === "unassigned") {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [{ vehicleId: null }, { vehicleId: { $exists: false } }],
        },
      ];
      delete filter.vehicleId;
    }
    if (warrantyExpiry) {
      const parsedWarrantyDate = new Date(String(warrantyExpiry));
      if (!Number.isNaN(parsedWarrantyDate.getTime())) {
        const nextDay = new Date(parsedWarrantyDate);
        nextDay.setDate(nextDay.getDate() + 1);
        filter.warrantyExpiry = {
          $gte: parsedWarrantyDate,
          $lt: nextDay,
        };
      }
    }

    const result = await paginate(
      GpsDevice,
      filter,
      page,
      limit,

      // ✅ populate (correct format)
      [
        { path: "vehicleId", select: "vehicleNumber" },
        { path: "organizationId", select: "name" }
      ],

      // ✅ searchable fields
      ["imei", "vehicleRegistrationNumber", "softwareVersion"],

      search,

      // ✅ latest first
      { createdAt: -1 }
    );

    return res.status(200).json(result);

  } catch (error) {
    console.error("Get All GPS Devices Error:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                GET BY ID                                   */
/* -------------------------------------------------------------------------- */

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid ID",
      });
    }

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const device = await GpsDevice.findOne({ _id: id, ...orgFilter })
      .populate("organizationId")
      .populate("vehicleId");

    if (!device) {
      return res.status(404).json({
        status: false,
        message: "GPS Device not found or access denied",
      });
    }

    return res.json({
      status: true,
      data: device,
    });
  } catch (error) {
    console.error("Get GPS Device By ID Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   UPDATE                                   */
/* -------------------------------------------------------------------------- */

exports.update = async (req, res) => {
  try {
    const payload = normalizeGpsDevicePayload(req.body);
    delete payload.isOnline;
    delete payload.connectionStatus;
    await validateUpdateGpsDevice(payload, req.user);

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const device = await GpsDevice.findOne({ _id: req.params.id, ...orgFilter });

    if (!device) {
      return res.status(404).json({
        status: false,
        message: "GPS Device not found or access denied",
      });
    }

    if (payload.imei) {
      const duplicate = await GpsDevice.findOne({
        imei: payload.imei,
        _id: { $ne: device._id },
      });

      if (duplicate) {
        return res.status(409).json({
          status: false,
          message: "Duplicate IMEI not allowed",
        });
      }

      payload.imei = payload.imei.trim();
    }

    Object.assign(device, payload);
    await device.save();

    await device.populate("organizationId vehicleId");

    return res.json({
      status: true,
      message: "GPS Device updated successfully",
      data: device,
    });
  } catch (error) {
    console.error("Update GPS Device Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                             UPDATE ONLINE STATUS                            */
/* -------------------------------------------------------------------------- */

exports.updateConnectionStatus = async (req, res) => {
  return res.status(403).json({
    status: false,
    message: "Connection status is managed by TCP server only",
  });
};

/* -------------------------------------------------------------------------- */
/*                              INVENTORY LIST                                */
/* -------------------------------------------------------------------------- */

exports.getInventory = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const filter = buildInventoryFilter(req.query, req.orgScope);

    const result = await paginate(
      GpsDevice,
      filter,
      page,
      limit,
      inventoryPopulate,
      ["imei", "vehicleRegistrationNumber", "softwareVersion", "deviceModel", "manufacturer", "serialNumber"],
      search,
      { createdAt: -1 },
    );

    result.data = result.data.map((device) => attachInventorySnapshot(device));

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get GPS Device Inventory Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                           INVENTORY GET BY ID                              */
/* -------------------------------------------------------------------------- */

exports.getInventoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid ID",
      });
    }

    const orgFilter = buildOrgScopeFilter(req.orgScope);
    const device = await GpsDevice.findOne({ _id: id, ...orgFilter }).populate([
      ...inventoryPopulate,
      { path: "inventory.updatedBy", select: "firstName lastName email" },
    ]);

    if (!device) {
      return res.status(404).json({
        status: false,
        message: "GPS Device not found or access denied",
      });
    }

    const history = await getInventoryHistoryForDevice(device._id);

    return res.status(200).json({
      status: true,
      data: attachInventorySnapshot(device),
      history,
    });
  } catch (error) {
    console.error("Get GPS Device Inventory By ID Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                             INVENTORY UPDATE                               */
/* -------------------------------------------------------------------------- */

exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid ID",
      });
    }

    const inventoryPayload = extractInventoryPatchPayload(req.body);
    const inventoryUpdates = sanitizeInventoryPayload(inventoryPayload);
    if (Object.keys(inventoryUpdates).length === 0) {
      return res.status(400).json({
        status: false,
        message: "No inventory fields provided",
      });
    }

    const orgFilter = buildOrgScopeFilter(req.orgScope);
    const existingDevice = await GpsDevice.findOne({ _id: id, ...orgFilter });

    if (!existingDevice) {
      return res.status(404).json({
        status: false,
        message: "GPS Device not found or access denied",
      });
    }

    const previousStatus = resolveInventoryStatus(existingDevice);
    const nextStatus = inventoryUpdates.status || previousStatus;
    const changedAt = new Date();
    const reason = resolveInventoryHistoryReason(inventoryUpdates, req.body?.reason);

    const device = await GpsDevice.findOneAndUpdate(
      { _id: id, ...orgFilter },
      {
        $set: {
          ...toInventorySetOperations(inventoryUpdates),
          "inventory.updatedAt": changedAt,
          "inventory.updatedBy": req.user?._id || null,
        },
      },
      { new: true, runValidators: true },
    ).populate([
      ...inventoryPopulate,
      { path: "inventory.updatedBy", select: "firstName lastName email" },
    ]);

    if (!device) {
      return res.status(404).json({
        status: false,
        message: "GPS Device not found or access denied",
      });
    }

    await createInventoryHistoryEntry({
      deviceId: device._id,
      organizationId: device.organizationId?._id || device.organizationId,
      previousStatus,
      newStatus: nextStatus,
      reason,
      changedBy: req.user?._id || null,
      changedAt,
    });

    const history = await getInventoryHistoryForDevice(device._id);

    return res.status(200).json({
      status: true,
      message: "GPS Device inventory updated successfully",
      data: attachInventorySnapshot(device),
      history,
    });
  } catch (error) {
    console.error("Update GPS Device Inventory Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                  AVAILABLE                                 */
/* -------------------------------------------------------------------------- */

exports.getAvailable = async (req, res) => {
  try {
    const filter = { status: "active", vehicleId: null };

    // 🔐 ORG SCOPE FIX
    if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
      filter.organizationId = { $in: req.orgScope };
    }

    const devices = await GpsDevice.find(filter)
      .populate("organizationId", "name")
      .populate("vehicleId", "vehicleNumber");

    return res.json({
      status: true,
      data: devices,
    });
  } catch (error) {
    console.error("Get Available Devices Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   DELETE                                   */
/* -------------------------------------------------------------------------- */

exports.delete = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const device = await GpsDevice.findOne({ _id: req.params.id, ...orgFilter }).session(session);

    if (!device) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      return res.status(404).json({
        status: false,
        message: "GPS Device not found or access denied",
      });
    }

    await cleanupForGpsDeviceDeletion(device, session);
    await device.deleteOne({ session });
    await session.commitTransaction();

    return res.json({
      status: true,
      message: "GPS Device deleted successfully",
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Delete GPS Device Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};
