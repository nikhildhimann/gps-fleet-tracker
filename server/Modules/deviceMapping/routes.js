const express = require("express");
const router = express.Router();

const verifyToken = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");

const Controller = require("./controller");

// Standardized mapping list (Frontend uses GET /api/devicemapping)
router.get(
  "/",
  verifyToken,
  checkAuthorization(["admin", "superadmin", "driver"], "deviceMapping", "read"),
  checkOrganization,
  Controller.getActiveMappings
);

// Standardized assign (Frontend uses POST /api/devicemapping)
router.post(
  "/",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "deviceMapping", "create"),
  checkOrganization,
  Controller.assign
);

// Standardized unassign (Frontend uses PATCH /api/devicemapping/:id/unassign)
router.patch(
  "/unassign",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "deviceMapping", "update"),
  checkOrganization,
  Controller.unassign
);

router.patch(
  "/:id/unassign",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "deviceMapping", "update"),
  checkOrganization,
  Controller.unassignById
);

// Keep legacy /vehicle and /device routes for other parts of the system if any
router.get(
  "/vehicle/:vehicleId",
  verifyToken,
  checkAuthorization(["admin", "superadmin", "driver"], "deviceMapping", "read"),
  checkOrganization,
  Controller.getByVehicle
);

router.get(
  "/device/:gpsDeviceId",
  verifyToken,
  checkAuthorization(["admin", "superadmin", "driver"], "deviceMapping", "read"),
  checkOrganization,
  Controller.getByDevice
);

module.exports = router;
