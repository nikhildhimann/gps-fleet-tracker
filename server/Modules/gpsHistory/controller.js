const GpsHistory = require("./model");
const paginate = require("../../helpers/limitoffset");
const mongoose = require("mongoose");
const Service = require("./service");

function validateVehicleId(vehicleId) {
  if (vehicleId === "all") return;
  if (!mongoose.isValidObjectId(vehicleId)) {
    const error = new Error("Invalid vehicleId");
    error.status = 400;
    throw error;
  }
}

async function handleAnalyticsRequest(res, work) {
  try {
    const data = await work();
    return res.status(200).json({ status: true, data });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      status: false,
      message: error.message,
    });
  }
}

/* ==========================================================================
   GET ALL GPS HISTORY (REPLAY / FILTER)
   ========================================================================== */
exports.getAll = async (req, res) => {
  try {
    const { page, limit, search, vehicleId, imei, from, to } = req.query;

    const filter = {};

    // 🔐 ORG SCOPE FIX
    if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
      filter.organizationId = { $in: req.orgScope };
    }

    if (vehicleId && mongoose.isValidObjectId(vehicleId)) {
      filter.vehicleId = vehicleId;
    }

    if (imei) {
      filter.imei = imei;
    }

    // Date range filter
    if (from || to) {
      filter.gpsTimestamp = {};
      if (from) filter.gpsTimestamp.$gte = new Date(from);
      if (to) filter.gpsTimestamp.$lte = new Date(to);
    }

    const result = await paginate(
      GpsHistory,
      filter,
      page,
      limit,
      ["organizationId", "vehicleId", "gpsDeviceId", "driverId", "tripId"],
      ["imei", "vehicleRegistrationNumber"],
      search,
      { gpsTimestamp: 1 },
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get GPS History Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

/* ==========================================================================
   GET GPS HISTORY BY VEHICLE
   ========================================================================== */
exports.getByVehicle = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const { vehicleId } = req.params;

    if (!mongoose.isValidObjectId(vehicleId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid vehicleId",
      });
    }

    const filter = { vehicleId };

    // 🔐 ORG SCOPE FIX
    if (req.orgScope !== "ALL") {
      filter.organizationId = { $in: req.orgScope };
    }


    const result = await paginate(
      GpsHistory,
      filter,
      page,
      limit,
      ["organizationId", "vehicleId", "gpsDeviceId"],
      [],
      search,
      { gpsTimestamp: 1 },
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get History By Vehicle Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

/* ==========================================================================
   GET GPS HISTORY BY DEVICE
   ========================================================================== */
exports.getByDevice = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const { gpsDeviceId } = req.params;

    if (!mongoose.isValidObjectId(gpsDeviceId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid gpsDeviceId",
      });
    }

    const filter = { gpsDeviceId };

    // 🔐 ORG SCOPE FIX
    if (req.orgScope !== "ALL") {
      filter.organizationId = { $in: req.orgScope };
    }


    const result = await paginate(
      GpsHistory,
      filter,
      page,
      limit,
      ["organizationId", "vehicleId", "gpsDeviceId"],
      [],
      search,
      { gpsTimestamp: 1 },
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get History By Device Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

/* ==========================================================================
   CLEAR ALL GPS HISTORY (SUPERADMIN ONLY)
   ========================================================================== */
exports.deleteHistory = async (req, res) => {
  try {
    // 🔐 ORG SCOPE FIX
    const filter =
      req.orgScope === "ALL"
        ? {}
        : { organizationId: { $in: req.orgScope } };

    await GpsHistory.deleteMany(filter);
    return res.status(200).json({
      status: true,
      message: "GPS history cleared successfully",
    });
  } catch (error) {
    console.error("Delete GPS History Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

/* ==========================================================================
   ANALYTICS ENDPOINTS
   ========================================================================== */

exports.getStatistics = async (req, res) =>
  handleAnalyticsRequest(res, async () => {
    validateVehicleId(req.params.vehicleId);
    return Service.getStatistics(req.params.vehicleId, req.orgScope, req.query);
  });

exports.getVehicleStatus = async (req, res) =>
  handleAnalyticsRequest(res, async () => {
    validateVehicleId(req.params.vehicleId);
    return Service.getVehicleStatus(req.params.vehicleId, req.orgScope);
  });

exports.getPlayback = async (req, res) =>
  handleAnalyticsRequest(res, async () => {
    validateVehicleId(req.params.vehicleId);
    return Service.getPlayback(req.params.vehicleId, req.orgScope, req.query);
  });

exports.getTravelSummary = async (req, res) =>
  handleAnalyticsRequest(res, async () => {
    validateVehicleId(req.params.vehicleId);
    return Service.getTravelSummary(
      req.params.vehicleId,
      req.orgScope,
      req.query,
    );
  });

exports.getTripSummary = async (req, res) =>
  handleAnalyticsRequest(res, async () => {
    validateVehicleId(req.params.vehicleId);
    return Service.getTripSummary(req.params.vehicleId, req.orgScope, req.query);
  });

exports.getDaywiseDistance = async (req, res) =>
  handleAnalyticsRequest(res, async () => {
    validateVehicleId(req.params.vehicleId);
    return Service.getDaywiseDistance(
      req.params.vehicleId,
      req.orgScope,
      req.query,
    );
  });

exports.getAlertSummary = async (req, res) =>
  handleAnalyticsRequest(res, async () => {
    validateVehicleId(req.params.vehicleId);
    return Service.getAlertSummary(req.params.vehicleId, req.orgScope, req.query);
  });

exports.getACSummary = async (req, res) =>
  handleAnalyticsRequest(res, async () => {
    validateVehicleId(req.params.vehicleId);
    return Service.getACSummary(req.params.vehicleId, req.orgScope, req.query);
  });
