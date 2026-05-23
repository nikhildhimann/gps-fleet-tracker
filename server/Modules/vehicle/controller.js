const mongoose = require("mongoose");
const VehicleModel = require("./model");
const GpsDevice = require("../gpsDevice/model");
const paginate = require("../../helpers/limitoffset");
const Validator = require("../../helpers/validators");
const { cleanupForVehicleDeletion } = require("../../common/mappingCleanup");
const {
  buildContextFromReq,
  createVehicleCreatedNotification,
} = require("../notifications/producers");

/* -------------------------------------------------------------------------- */
/*                               VALIDATION RULES                              */
/* -------------------------------------------------------------------------- */

const VEHICLE_RULES = {
  vehicleType: "in:car,bus,truck,bike,other",
  vehicleNumber: "string",
  make: "string",
  model: "string",
  year: "numeric",
  color: "string",
  deviceId: "string",
  driverId: "string",
  status: "in:active,inactive,maintenance,decommissioned",
};

/* -------------------------------------------------------------------------- */
/*                                   CREATE                                   */
/* -------------------------------------------------------------------------- */

exports.create = async (req, res) => {
  try {
    const { runningStatus, ...vehiclePayload } = req.body;
    const rules = {
      ...VEHICLE_RULES,
      vehicleType: "required|in:car,bus,truck,bike,other",
      vehicleNumber: "required|string",
    };

    if (req.user.role === "superadmin") {
      rules.organizationId = "required|string";
    }

    await new Validator(vehiclePayload, rules).validate();

    // 🔐 ORG SCOPE FIX
    let organizationId;
    if (req.user.role === "superadmin") {
      organizationId = vehiclePayload.organizationId || req.orgId;
    } else if (
      vehiclePayload.organizationId &&
      req.orgScope !== "ALL" &&
      Array.isArray(req.orgScope) &&
      req.orgScope.some(id => id.toString() === vehiclePayload.organizationId.toString())
    ) {
      organizationId = vehiclePayload.organizationId;
    } else {
      organizationId = req.orgId;
    }

    if (!organizationId) {
      return res.status(400).json({
        status: false,
        message: "OrganizationId is required",
      });
    }

    const vehicleNumber = req.body.vehicleNumber.toUpperCase().trim();

    const exists = await VehicleModel.findOne({
      organizationId,
      vehicleNumber,
    });

    if (exists) {
      return res.status(409).json({
        status: false,
        message: "Vehicle already exists in this organization",
      });
    }

    const vehicleData = {
      organizationId,
      ...vehiclePayload,
      vehicleNumber,
      createdBy: req.user._id,
    };

    // Clean up empty strings for IDs
    if (!vehicleData.deviceId) vehicleData.deviceId = null;
    if (!vehicleData.driverId) vehicleData.driverId = null;

    const vehicle = await VehicleModel.create(vehicleData);

    // 🌊 Post-create logic (isolated)
    try {
      createVehicleCreatedNotification(
        { vehicle },
        buildContextFromReq(req),
      );
    } catch (notifErr) {
      console.warn("Notification failed for vehicle creation:", notifErr.message);
    }

    return res.status(201).json({
      status: true,
      message: "Vehicle created successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("Create Vehicle Error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: false,
        message: "Validation failed",
        errors: error.errors,
      });
    }

    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
      errors: error.errors || null,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   UPDATE                                   */
/* -------------------------------------------------------------------------- */

exports.update = async (req, res) => {
  try {
    const { runningStatus, ...vehiclePayload } = req.body;
    // SAME RULES, NO MODIFICATION
    await new Validator(vehiclePayload, VEHICLE_RULES).validate();

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const vehicle = await VehicleModel.findOne({ _id: req.params.id, ...orgFilter });

    if (!vehicle) {
      return res.status(404).json({
        status: false,
        message: "Vehicle not found or access denied",
      });
    }

    if (vehiclePayload.vehicleNumber) {
      const formattedVehicleNumber = vehiclePayload.vehicleNumber
        .toUpperCase()
        .trim();

      const duplicate = await VehicleModel.findOne({
        organizationId: vehicle.organizationId,
        vehicleNumber: formattedVehicleNumber,
        _id: { $ne: vehicle._id },
      });

      if (duplicate) {
        return res.status(409).json({
          status: false,
          message: "Vehicle number already exists",
        });
      }

      vehiclePayload.vehicleNumber = formattedVehicleNumber;
    }

    // Clean up empty strings for IDs
    if (vehiclePayload.deviceId === "") vehiclePayload.deviceId = null;
    if (vehiclePayload.driverId === "") vehiclePayload.driverId = null;

    Object.assign(vehicle, vehiclePayload);
    vehicle.updatedAt = new Date();
    await vehicle.save();

    return res.json({
      status: true,
      message: "Vehicle updated successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("Update Vehicle Error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: false,
        message: "Validation failed",
        errors: error.errors,
      });
    }

    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
      errors: error.errors || null,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   GET ALL                                  */
/* -------------------------------------------------------------------------- */

exports.getAll = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      organizationId,
      vehicleNumber,
      vehicleType,
      status,
      runningStatus,
      driverId,
      deviceAssigned,
      connectionStatus,
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

    if (vehicleNumber) {
      filter.vehicleNumber = {
        $regex: String(vehicleNumber).trim().toUpperCase(),
        $options: "i",
      };
    }

    if (vehicleType) filter.vehicleType = vehicleType;
    if (status) filter.status = status;
    if (runningStatus) filter.runningStatus = runningStatus;
    if (driverId) filter.driverId = driverId;

    if (deviceAssigned === "assigned") {
      filter.deviceId = { $ne: null };
    } else if (deviceAssigned === "unassigned") {
      filter.$or = [{ deviceId: null }, { deviceId: { $exists: false } }];
    }

    if (connectionStatus === "online" || connectionStatus === "offline") {
      const deviceQuery = { connectionStatus };
      if (filter.organizationId) {
        deviceQuery.organizationId = filter.organizationId;
      }

      const matchingDeviceIds = await GpsDevice.find(deviceQuery).distinct("_id");
      filter.deviceId =
        matchingDeviceIds.length > 0 ? { $in: matchingDeviceIds } : { $in: [] };
    }

    const result = await paginate(
      VehicleModel,
      filter,
      page,
      limit,

      // ✅ populate
      [
        { path: "organizationId", select: "name" },
        { path: "driverId", select: "firstName lastName phone email licenseNumber address" },
      ],

      // ✅ searchable fields
      ["vehicleNumber", "model", "vehicleType"],

      search,

      // ✅ latest first
      { createdAt: -1 }
    );

    return res.status(200).json(result);

  } catch (error) {
    console.error("Get All VehicleModels Error:", error);

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   GET BY ID                                */
/* -------------------------------------------------------------------------- */

exports.getById = async (req, res) => {
  try {
    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const vehicle = await VehicleModel.findOne({ _id: req.params.id, ...orgFilter }).populate([
      { path: "organizationId", select: "name" },
      { path: "driverId", select: "firstName lastName phone email licenseNumber address" }
    ]);

    if (!vehicle) {
      return res.status(404).json({
        status: false,
        message: "Vehicle not found or access denied",
      });
    }

    return res.json({
      status: true,
      data: vehicle,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   DELETE                                   */
/* -------------------------------------------------------------------------- */

exports.remove = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const vehicle = await VehicleModel.findOne({ _id: req.params.id, ...orgFilter }).session(session);

    if (!vehicle) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      return res.status(404).json({
        status: false,
        message: "Vehicle not found or access denied",
      });
    }

    await cleanupForVehicleDeletion(vehicle, session);
    await vehicle.deleteOne({ session });
    await session.commitTransaction();

    return res.json({
      status: true,
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Delete Vehicle Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};
