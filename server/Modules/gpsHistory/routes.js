const express = require("express");
const router = express.Router();

const Controller = require("./controller");
const verifyToken = require("../../middleware/verifyToken");
const checkAuthorization = require("../../middleware/checkAuthorization");
const checkOrganization = require("../../middleware/checkOrganization");

const readRoles = ["admin", "superadmin", "driver"];

// GET ALL / REPLAY
router.get(
  "/",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getAll,
);

router.get(
  "/statistics/:vehicleId",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getStatistics,
);

router.get(
  "/vehicle-status/:vehicleId",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getVehicleStatus,
);

router.get(
  "/playback/:vehicleId",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getPlayback,
);

router.get(
  "/travel-summary/:vehicleId",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getTravelSummary,
);

router.get(
  "/trip-summary/:vehicleId",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getTripSummary,
);

router.get(
  "/daywise-distance/:vehicleId",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getDaywiseDistance,
);

router.get(
  "/alert-summary/:vehicleId",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getAlertSummary,
);

router.get(
  "/ac-summary/:vehicleId",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getACSummary,
);

// GET BY VEHICLE
router.get(
  "/vehicle/:vehicleId",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getByVehicle,
);

// GET BY DEVICE
router.get(
  "/device/:gpsDeviceId",
  verifyToken,
  checkAuthorization(readRoles, "gpsHistory", "read"),
  checkOrganization,
  Controller.getByDevice,
);

// CLEAR HISTORY (SUPERADMIN ONLY)
router.delete(
  "/",
  verifyToken,
  checkAuthorization(["superadmin"], "gpsHistory", "delete"),
  checkOrganization,
  Controller.deleteHistory,
);

module.exports = router;
