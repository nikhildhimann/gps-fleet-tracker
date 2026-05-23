const express = require("express");
const router = express.Router();

const verifyToken = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");

const controller = require("./controller");

// test route
router.get("/", verifyToken, (req, res) => {
  res.json({
    status: true,
    message: "HealthMonitoring API is running",
  });
});

// latest by IMEI
router.get(
  "/imei/:imei/latest",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "healthmonitoring", "read"),
  checkOrganization,
  controller.getLatestByImei,
);

// history by IMEI
router.get(
  "/imei/:imei/history",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "healthmonitoring", "read"),
  checkOrganization,
  controller.getHistoryByImei,
);

// latest by vehicle
router.get(
  "/vehicle/:vehicleId/latest",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "healthmonitoring", "read"),
  checkOrganization,
  controller.getLatestByVehicle,
);

// latest list
router.get(
  "/latest",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "healthmonitoring", "read"),
  checkOrganization,
  controller.getLatestList,
);

// history by vehicle
router.get(
  "/vehicle/:vehicleId/history",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "healthmonitoring", "read"),
  checkOrganization,
  controller.getHistoryByVehicle,
);

module.exports = router;
