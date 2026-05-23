const express = require("express");
const router = express.Router();

const verifyToken = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");

const Controller = require("./controller");

router.post(
  "/",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "gpsDevice", "create"),
  checkOrganization,
  Controller.create
);

router.get(
  "/",
  verifyToken,
  checkAuthorization(["admin", "driver"], "gpsDevice", "read"),
  checkOrganization,
  Controller.getAll
);

router.get(
  "/available",
  verifyToken,
  checkAuthorization(["admin", "driver"], "gpsDevice", "read"),
  checkOrganization,
  Controller.getAvailable
);

router.get(
  "/inventory",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "gpsDevice", "read"),
  checkOrganization,
  Controller.getInventory
);

router.get(
  "/inventory/:id",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "gpsDevice", "read"),
  checkOrganization,
  Controller.getInventoryById
);

router.patch(
  "/inventory/:id",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "gpsDevice", "update"),
  checkOrganization,
  Controller.updateInventory
);

router.get(
  "/:id",
  verifyToken,
  checkAuthorization(["admin", "driver"], "gpsDevice", "read"),
  checkOrganization,
  Controller.getById
);

router.put(
  "/:id",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "gpsDevice", "update"),
  checkOrganization,
  Controller.update
);

router.put(
  "/:id/status",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "gpsDevice", "update"),
  checkOrganization,
  Controller.updateConnectionStatus
);

router.delete(
  "/:id",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "gpsDevice", "delete"),
  checkOrganization,
  Controller.delete
);

module.exports = router;
