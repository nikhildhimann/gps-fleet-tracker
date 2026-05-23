const VehicleMapping = require("./model");
const Validator = require("../../helpers/validators");
const mongoose = require("mongoose");
const VehicleModel = require("../vehicle/model");
const DeviceModel = require("../gpsDevice/model");
const DriverModel = require("../drivers/model");
const VehicleDriverMapping = require("../vehicleDriverMapping/model");
const paginate = require("../../helpers/limitoffset");
const { syncInventoryStatus } = require("../gpsDevice/service");
const {
  buildContextFromReq,
  createDeviceMappingNotification,
  createDriverMappingNotification,
} = require("../notifications/producers");

const validateVehicleMappingData = async (data) => {
  const rules = {
    vehicleId: "required|string",
    gpsDeviceId: "required|string",
  };
  const validator = new Validator(data, rules);
  await validator.validate();
};

exports.assign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await validateVehicleMappingData(req.body);

    const { vehicleId, gpsDeviceId } = req.body;

    if (
      !mongoose.isValidObjectId(vehicleId) ||
      !mongoose.isValidObjectId(gpsDeviceId)
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid vehicle ID or GPS device ID",
      });
    }

    // 🔐 ORG SCOPE FILTER
    const orgFilter =
      req.orgScope === "ALL"
        ? {}
        : { organizationId: { $in: req.orgScope } };

    const vehicle = await VehicleModel.findOne({
      _id: vehicleId,
      ...orgFilter,
    }).session(session);

    const device = await DeviceModel.findOne({
      _id: gpsDeviceId,
      ...orgFilter,
    }).session(session);

    if (!vehicle || !device) {
      throw {
        status: 404,
        message: "Vehicle or GPS device not found or access denied",
      };
    }

    /* 🛡️ STATUS CHECK — Issue 5 implemented */
    if (device.status !== "active") {
      throw {
        status: 400,
        message: "Only 'active' GPS devices can be assigned to vehicles",
      };
    }

    /* 🛑 CORE BUSINESS RULE — SAME ORG ONLY */
    if (
      vehicle.organizationId.toString() !==
      device.organizationId.toString()
    ) {
      throw {
        status: 400,
        message:
          "Vehicle and GPS device must belong to the same organization",
      };
    }

    const organizationId = vehicle.organizationId;

    /* 🔒 EXTRA HARDENING — direct reference check */
    if (vehicle.deviceId) {
      throw {
        status: 409,
        message: "Vehicle already has a linked GPS device",
      };
    }

    if (device.vehicleId) {
      throw {
        status: 409,
        message: "GPS device already linked to a vehicle",
      };
    }

    /* 🔒 CHECK MAPPING COLLECTION */

    const deviceAlreadyMapped = await VehicleMapping.findOne({
      gpsDeviceId,
      unassignedAt: null,
    }).session(session);

    if (deviceAlreadyMapped) {
      throw {
        status: 409,
        message: "GPS device already assigned to another vehicle",
      };
    }

    const vehicleAlreadyMapped = await VehicleMapping.findOne({
      vehicleId,
      unassignedAt: null,
    }).session(session);

    if (vehicleAlreadyMapped) {
      throw {
        status: 409,
        message: "Vehicle already has an assigned GPS device",
      };
    }

    /* 🧩 CREATE MAPPING */

    const [vehicleMapping] = await VehicleMapping.create(
      [
        {
          organizationId,
          vehicleId,
          gpsDeviceId,
          assignedAt: new Date(),
          unassignedAt: null,
        },
      ],
      { session }
    );

    /* 🔄 SYNC REFERENCES */

    vehicle.deviceId = gpsDeviceId;
    device.vehicleId = vehicleId;

    await vehicle.save({ session });
    await device.save({ session });
    await syncInventoryStatus(device._id, "assigned", { session });

    await session.commitTransaction();

    // ✅ Populate outside transaction — wrapped so it cannot hit outer catch after commit
    try {
      await vehicleMapping.populate([
        { path: "organizationId" },
        { path: "vehicleId" },
        { path: "gpsDeviceId" },
      ]);
    } catch (populateErr) {
      console.warn("Device mapping populate warning (non-critical):", populateErr);
    }

    // ✅ GUARANTEED SUCCESS RESPONSE — returned before fire-and-forget notification
    res.status(201).json({
      status: true,
      message: "Device assigned to vehicle successfully",
      data: vehicleMapping,
    });

    // 🔔 Fire-and-forget notification — cannot fail the HTTP response
    createDeviceMappingNotification(
      {
        action: "assigned",
        mappingId: vehicleMapping._id,
        organizationId,
        vehicle,
        device,
      },
      buildContextFromReq(req),
    ).catch((notifErr) =>
      console.error("Device assign notification error (non-critical):", notifErr)
    );

  } catch (error) {
    // ⛔ Only abort if still inside a transaction (prevents abort-after-commit)
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Assign Device Mapping Error:", error);

    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

exports.getActiveMappings = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const filter = { unassignedAt: null };

    if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
      filter.organizationId = { $in: req.orgScope };
    }

    const result = await paginate(
      VehicleMapping,
      filter,
      page,
      limit,
      ["organizationId", "vehicleId", "gpsDeviceId"],
      [],
      search,
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get Active Mappings Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.unassignById = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ status: false, message: "Invalid mapping ID" });
    }

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const mapping = await VehicleMapping.findOne({ _id: id, ...orgFilter }).session(session);

    if (!mapping || mapping.unassignedAt) {
      throw { status: 404, message: "Active mapping not found or access denied" };
    }

    const { vehicleId, gpsDeviceId } = mapping;
    const [vehicleSnapshot, deviceSnapshot] = await Promise.all([
      VehicleModel.findById(vehicleId).session(session),
      DeviceModel.findById(gpsDeviceId).session(session),
    ]);
    let driverSnapshot = null;

    // 🔄 Sync vehicle & device
    await VehicleModel.findByIdAndUpdate(
      vehicleId,
      { deviceId: null },
      { session },
    );

    await DeviceModel.findByIdAndUpdate(
      gpsDeviceId,
      { vehicleId: null },
      { session },
    );
    await syncInventoryStatus(gpsDeviceId, "in_stock", { session });

    mapping.unassignedAt = new Date();
    await mapping.save({ session });

    // ── CASCADE: also unassign driver from this vehicle ──
    const activeDriverMapping = await VehicleDriverMapping.findOne({
      vehicleId,
      unassignedAt: null,
    }).session(session);

    if (activeDriverMapping) {
      driverSnapshot = await DriverModel.findById(activeDriverMapping.driverId).session(session);
      activeDriverMapping.unassignedAt = new Date();
      activeDriverMapping.status = "unassigned";
      await activeDriverMapping.save({ session });

      // Clear denormalized cache fields
      await VehicleModel.findByIdAndUpdate(
        vehicleId,
        { driverId: null },
        { session },
      );
      await DriverModel.findByIdAndUpdate(
        activeDriverMapping.driverId,
        { assignedVehicleId: null },
        { session },
      );
    }

    // ✅ COMMIT
    await session.commitTransaction();
    session.endSession();

    // ✅ GUARANTEED SUCCESS RESPONSE
    res.status(200).json({
      status: true,
      message: "Device unassigned successfully",
    });

    // 🔔 Fire-and-forget notifications — isolated so they cannot fail the response
    createDeviceMappingNotification(
      {
        action: "unassigned",
        mappingId: mapping._id,
        organizationId: mapping.organizationId,
        vehicle: vehicleSnapshot || { _id: vehicleId },
        device: deviceSnapshot || { _id: gpsDeviceId },
      },
      buildContextFromReq(req),
    ).catch((notifErr) =>
      console.error("Device unassign (by ID) notification error (non-critical):", notifErr)
    );

    if (activeDriverMapping && driverSnapshot) {
      createDriverMappingNotification(
        {
          action: "unassigned",
          mappingId: activeDriverMapping._id,
          organizationId: mapping.organizationId,
          vehicle: vehicleSnapshot || { _id: vehicleId },
          driver: driverSnapshot,
        },
        buildContextFromReq(req),
      ).catch((notifErr) =>
        console.error("Driver cascade unassign notification error (non-critical):", notifErr)
      );
    }

  } catch (error) {
    // ⛔ Only abort if still inside a transaction
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    console.error("Unassign By ID Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.unassign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { vehicleId, gpsDeviceId } = req.body;

    if (!vehicleId || !gpsDeviceId) {
      return res.status(400).json({
        status: false,
        message: "vehicleId and gpsDeviceId are required",
      });
    }

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const mapping = await VehicleMapping.findOneAndUpdate(
      {
        vehicleId,
        gpsDeviceId,
        unassignedAt: null,
        ...orgFilter
      },
      { unassignedAt: new Date() },
      { new: true, session },
    );

    if (!mapping) {
      throw { status: 404, message: "Active mapping not found or access denied" };
    }

    const [vehicleSnapshot, deviceSnapshot] = await Promise.all([
      VehicleModel.findById(vehicleId).session(session),
      DeviceModel.findById(gpsDeviceId).session(session),
    ]);
    let driverSnapshot = null;

    await VehicleModel.findByIdAndUpdate(
      vehicleId,
      { deviceId: null },
      { session },
    );

    await DeviceModel.findByIdAndUpdate(
      gpsDeviceId,
      { vehicleId: null },
      { session },
    );
    await syncInventoryStatus(gpsDeviceId, "in_stock", { session });

    // ── CASCADE: also unassign driver from this vehicle ──
    const activeDriverMapping = await VehicleDriverMapping.findOne({
      vehicleId,
      unassignedAt: null,
    }).session(session);

    if (activeDriverMapping) {
      driverSnapshot = await DriverModel.findById(activeDriverMapping.driverId).session(session);
      activeDriverMapping.unassignedAt = new Date();
      activeDriverMapping.status = "unassigned";
      await activeDriverMapping.save({ session });

      // Clear denormalized cache fields
      await VehicleModel.findByIdAndUpdate(
        vehicleId,
        { driverId: null },
        { session },
      );
      await DriverModel.findByIdAndUpdate(
        activeDriverMapping.driverId,
        { assignedVehicleId: null },
        { session },
      );
    }

    // ✅ COMMIT
    await session.commitTransaction();
    session.endSession();

    // ✅ GUARANTEED SUCCESS RESPONSE
    res.status(200).json({
      status: true,
      message: "Device unassigned successfully",
    });

    // 🔔 Fire-and-forget notifications — isolated so they cannot fail the response
    createDeviceMappingNotification(
      {
        action: "unassigned",
        mappingId: mapping._id,
        organizationId: mapping.organizationId,
        vehicle: vehicleSnapshot || { _id: vehicleId },
        device: deviceSnapshot || { _id: gpsDeviceId },
      },
      buildContextFromReq(req),
    ).catch((notifErr) =>
      console.error("Device unassign notification error (non-critical):", notifErr)
    );

    if (activeDriverMapping && driverSnapshot) {
      createDriverMappingNotification(
        {
          action: "unassigned",
          mappingId: activeDriverMapping._id,
          organizationId: mapping.organizationId,
          vehicle: vehicleSnapshot || { _id: vehicleId },
          driver: driverSnapshot,
        },
        buildContextFromReq(req),
      ).catch((notifErr) =>
        console.error("Driver cascade unassign (by body) notification error (non-critical):", notifErr)
      );
    }

  } catch (error) {
    // ⛔ Only abort if still inside a transaction
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    console.error("Unassign Device Mapping Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.getByVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { page, limit, search } = req.query;

    const filter = { vehicleId };
    // 🔐 ORG SCOPE FIX
    if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
      filter.organizationId = { $in: req.orgScope };
    }

    const result = await paginate(
      VehicleMapping,
      filter,
      page,
      limit,
      ["organizationId", "vehicleId", "gpsDeviceId"],
      [],
      search,
    );

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getByDevice = async (req, res) => {
  try {
    const { gpsDeviceId } = req.params;
    const { page, limit, search } = req.query;

    const filter = { gpsDeviceId };
    // 🔐 ORG SCOPE FIX
    if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
      filter.organizationId = { $in: req.orgScope };
    }

    const result = await paginate(
      VehicleMapping,
      filter,
      page,
      limit,
      ["organizationId", "vehicleId", "gpsDeviceId"],
      [],
      search,
    );

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
