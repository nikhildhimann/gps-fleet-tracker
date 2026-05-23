const express = require("express");
const router = express.Router();

const requireAuth = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");

const Controller = require("./controller");

router.get(
  "/",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "alerts", "read"),
  checkOrganization,
  Controller.getAll
);

router.get(
  "/vehicle/:vehicleId",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "alerts", "read"),
  checkOrganization,
  Controller.getByVehicle
);

router.get(
  "/unacknowledged",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "alerts", "read"),
  checkOrganization,
  Controller.getUnacknowledged
);

router.post(
  "/:id/ack",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "alerts", "update"),
  checkOrganization,
  Controller.acknowledge
);

router.post(
  "/ack-all",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "alerts", "update"),
  checkOrganization,
  Controller.acknowledgeAll
);

router.delete(
  "/:id",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "alerts", "delete"),
  checkOrganization,
  Controller.delete
);

router.delete(
  "/",
  requireAuth,
  checkAuthorization(["superadmin", "admin", "driver"], "alerts", "delete"),
  checkOrganization,
  Controller.deleteAll
);

module.exports = router;
