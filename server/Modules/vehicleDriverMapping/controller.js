const VehicleDriverMapping = require('./model');
const Vehicle = require('../vehicle/model');
const Driver = require('../drivers/model');
const Validator = require('../../helpers/validators');
const mongoose = require('mongoose');
const {
  buildContextFromReq,
  createDriverMappingNotification,
} = require("../notifications/producers");

const validateAssignData = async (data) => {
  const rules = {
    vehicleId: "required|string",
    driverId: "required|string"
  };
  const validator = new Validator(data, rules);
  await validator.validate();
};

const validateUnassignData = async (data) => {
  const rules = {
    vehicleId: "required|string"
  };
  const validator = new Validator(data, rules);
  await validator.validate();
};

// Assign driver to vehicle (only one active driver per vehicle)
exports.assignDriverToVehicle = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await validateAssignData(req.body);

    const { vehicleId, driverId } = req.body;

    if (
      !mongoose.isValidObjectId(vehicleId) ||
      !mongoose.isValidObjectId(driverId)
    ) {
      throw { status: 400, message: "Invalid vehicleId or driverId" };
    }

    /* 🔐 ORG SCOPE FILTER */
    const orgFilter =
      req.orgScope === "ALL"
        ? {}
        : { organizationId: { $in: req.orgScope } };

    /* 🔍 FETCH VEHICLE */
    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      ...orgFilter,
    }).session(session);

    /* 🔍 FETCH DRIVER */
    const driver = await Driver.findOne({
      _id: driverId,
      ...orgFilter,
    }).session(session);

    if (!vehicle || !driver) {
      throw {
        status: 404,
        message: "Vehicle or driver not found or access denied",
      };
    }

    /* 🛡️ STATUS CHECK — Issue 4 implemented */
    if (driver.status !== "active") {
      throw {
        status: 400,
        message: "Only 'active' drivers can be assigned to vehicles",
      };
    }

    /* 🛑 CORE BUSINESS RULE — SAME ORG ONLY */
    if (
      vehicle.organizationId.toString() !==
      driver.organizationId.toString()
    ) {
      throw {
        status: 400,
        message: "Vehicle and driver must belong to the same organization",
      };
    }

    const organizationId = vehicle.organizationId;

    /* 🚫 DRIVER ALREADY ASSIGNED */
    const driverAlreadyMapped = await VehicleDriverMapping.findOne({
      driverId,
      unassignedAt: null,
    }).session(session);

    if (driverAlreadyMapped) {
      throw {
        status: 409,
        message: "Driver already assigned to another vehicle",
      };
    }

    /* 🔄 UNASSIGN EXISTING DRIVER FROM VEHICLE (IF ANY) */
    await VehicleDriverMapping.updateOne(
      {
        vehicleId,
        unassignedAt: null,
      },
      {
        unassignedAt: new Date(),
        status: "unassigned",
      },
      { session }
    );

    /* 🧩 CREATE NEW MAPPING */
    const [mapping] = await VehicleDriverMapping.create(
      [
        {
          organizationId,
          vehicleId,
          driverId,
          assignedAt: new Date(),
          unassignedAt: null,
          status: "assigned",
        },
      ],
      { session }
    );

    /* 🔄 SYNC CACHE FIELDS */
    vehicle.driverId = driverId;
    driver.assignedVehicleId = vehicleId;

    await vehicle.save({ session });
    await driver.save({ session });

    await session.commitTransaction();

    // ✅ Populate outside transaction — wrapped so it cannot hit outer catch after commit
    try {
      await mapping.populate([
        { path: "vehicleId" },
        { path: "driverId" },
        { path: "organizationId" },
      ]);
    } catch (populateErr) {
      console.warn("Driver mapping populate warning (non-critical):", populateErr);
    }

    // ✅ GUARANTEED SUCCESS RESPONSE — returned before fire-and-forget notification
    res.status(201).json({
      status: true,
      message: "Driver assigned to vehicle successfully",
      data: mapping,
    });

    // 🔔 Fire-and-forget notification — cannot fail the HTTP response
    createDriverMappingNotification(
      {
        action: "assigned",
        mappingId: mapping._id,
        organizationId,
        vehicle,
        driver,
      },
      buildContextFromReq(req),
    ).catch((notifErr) =>
      console.error("Driver assign notification error (non-critical):", notifErr)
    );

  } catch (error) {
    // ⛔ Only abort if still inside a transaction (prevents abort-after-commit)
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Assign Driver Error:", error);

    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

// Unassign driver from vehicle
exports.unassignDriverFromVehicle = async (req, res) => {
  try {
    await validateUnassignData(req.body);

    const { vehicleId } = req.body;

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const vehicle = await Vehicle.findOne({ _id: vehicleId, ...orgFilter });
    if (!vehicle) {
      return res.status(404).json({
        status: false,
        message: "Vehicle not found or access denied"
      });
    }

    // Find active mapping
    const activeMapping = await VehicleDriverMapping.findOne({
      vehicleId,
      unassignedAt: null,
      status: "assigned"
    });

    if (!activeMapping) {
      return res.status(404).json({
        status: false,
        message: "No active driver assignment found for this vehicle"
      });
    }

    // Unassign
    activeMapping.unassignedAt = new Date();
    activeMapping.status = "unassigned";
    await activeMapping.save();

    // Clear denormalized cache fields
    await Vehicle.findByIdAndUpdate(vehicleId, { driverId: null });
    await Driver.findByIdAndUpdate(activeMapping.driverId, { assignedVehicleId: null });

    await activeMapping.populate(['vehicleId', 'driverId']);

    await createDriverMappingNotification(
      {
        action: "unassigned",
        mappingId: activeMapping._id,
        organizationId: vehicle.organizationId,
        vehicle: activeMapping.vehicleId,
        driver: activeMapping.driverId,
      },
      buildContextFromReq(req),
    );

    return res.status(200).json({
      status: true,
      message: "Driver unassigned from vehicle successfully",
      data: {
        _id: activeMapping._id,
        vehicleId: activeMapping.vehicleId._id,
        vehicleName: activeMapping.vehicleId.vehicleNumber,
        driverId: activeMapping.driverId._id,
        driverName: `${activeMapping.driverId.firstName} ${activeMapping.driverId.lastName}`,
        assignedAt: activeMapping.assignedAt,
        unassignedAt: activeMapping.unassignedAt,
        status: activeMapping.status
      }
    });
  } catch (error) {
    console.error("Unassign Driver Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error"
    });
  }
};

// Get current driver assigned to vehicle
exports.getCurrentDriverByVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const vehicle = await Vehicle.findOne({ _id: vehicleId, ...orgFilter });
    if (!vehicle) {
      return res.status(404).json({
        status: false,
        message: "Vehicle not found or access denied"
      });
    }

    // Find active driver assignment
    const activeMapping = await VehicleDriverMapping.findOne({
      vehicleId,
      unassignedAt: null,
      status: "assigned"
    }).populate(['vehicleId', 'driverId']);

    if (!activeMapping) {
      return res.status(200).json({
        status: true,
        message: "No active driver assigned to this vehicle",
        data: null
      });
    }

    return res.status(200).json({
      status: true,
      message: "Current driver fetched successfully",
      data: {
        _id: activeMapping._id,
        vehicleId: activeMapping.vehicleId._id,
        vehicleName: activeMapping.vehicleId.vehicleNumber,
        driverId: activeMapping.driverId._id,
        driverName: `${activeMapping.driverId.firstName} ${activeMapping.driverId.lastName}`,
        driverEmail: activeMapping.driverId.email,
        driverPhone: activeMapping.driverId.phone,
        driverStatus: activeMapping.driverId.status,
        assignedAt: activeMapping.assignedAt,
        status: activeMapping.status
      }
    });
  } catch (error) {
    console.error("Get Current Driver Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error"
    });
  }
};

exports.getAll = async (req, res) => {
  try {
    const filter = { unassignedAt: null };

    const isSuperAdminOrFullScope = req.user.role === "superadmin" || req.user.role === "super_admin" || req.orgScope === "ALL";
    if (!isSuperAdminOrFullScope) {
      filter.organizationId = { $in: req.orgScope };
    }

    const mappings = await VehicleDriverMapping.find(filter)
      .populate('organizationId', 'name')
      .populate('vehicleId')
      .populate('driverId');

    return res.status(200).json({
      status: true,
      data: mappings
    });
  } catch (error) {
    console.error("Get All Mappings Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
