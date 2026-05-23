const express = require("express");
const router = express.Router();

const requireAuth = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");

const Controller = require("./controller");

router.post(
  "/",
  requireAuth,
  checkAuthorization(["admin"], "geofence", "create"),
  checkOrganization,
  Controller.create
);

router.get(
  "/",
  requireAuth,
  checkAuthorization(["admin"], "geofence", "read"),
  checkOrganization,
  Controller.getAll
);

router.get(
  "/:id",
  requireAuth,
  checkAuthorization(["admin"], "geofence", "read"),
  checkOrganization,
  Controller.getById
);

router.put(
  "/:id",
  requireAuth,
  checkAuthorization(["admin"], "geofence", "update"),
  checkOrganization,
  Controller.update
);

router.delete(
  "/:id",
  requireAuth,
  checkAuthorization(["admin"], "geofence", "delete"),
  checkOrganization,
  Controller.delete
);

module.exports = router;
