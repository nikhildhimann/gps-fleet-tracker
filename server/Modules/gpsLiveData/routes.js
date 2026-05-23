const express = require("express");
const router = express.Router();

const requireAuth = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");

const Controller = require("./controller");

// Get all GPS live data
router.get(
  "/",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "gpsLiveData", "read"),
  checkOrganization,
  Controller.getLiveData
);

// Get GPS live data by vehicle ID
router.get(
  "/vehicle/:vehicleId",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "gpsLiveData", "read"),
  checkOrganization,
  Controller.getByVehicle
);

// Get GPS live data by device ID
router.get(
  "/device/:gpsDeviceId",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "gpsLiveData", "read"),
  checkOrganization,
  Controller.getByDevice
);

// Get GPS live data by IMEI
router.get(
  "/imei/:imei",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "gpsLiveData", "read"),
  checkOrganization,
  Controller.getByImei
);

module.exports = router;