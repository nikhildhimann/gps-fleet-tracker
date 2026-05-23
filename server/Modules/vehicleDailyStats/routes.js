const express = require("express");
const router = express.Router();

const requireAuth = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");

const Controller = require("./controller");

router.get(
  "/",
  requireAuth,
  checkAuthorization(["superadmin", "admin"], "vehicleDailyStats", "read"),
  checkOrganization,
  Controller.getAll
);

router.get(
  "/vehicle/:vehicleId",
  requireAuth,
  checkAuthorization(["superadmin", "admin"], "vehicleDailyStats", "read"),
  checkOrganization,
  Controller.getByVehicle
);

router.get(
  "/vehicle/:vehicleId/date/:date",
  requireAuth,
  checkAuthorization(["superadmin", "admin"], "vehicleDailyStats", "read"),
  checkOrganization,
  Controller.getByVehicleAndDate
);

module.exports = router;
