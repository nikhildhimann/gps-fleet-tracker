const express = require("express");

const verifyToken = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");
const Controller = require("./controller");

const router = express.Router();

router.get(
  "/",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "notifications", "read"),
  checkOrganization,
  Controller.getAll
);

router.get(
  "/counts",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "notifications", "read"),
  checkOrganization,
  Controller.getCounts
);

router.get(
  "/:id",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "notifications", "read"),
  checkOrganization,
  Controller.getById
);

router.post(
  "/",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "notifications", "create"),
  checkOrganization,
  Controller.create
);

router.patch(
  "/bulk/read",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "notifications", "update"),
  checkOrganization,
  Controller.bulkMarkAsRead
);

router.patch(
  "/bulk/acknowledge",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "notifications", "update"),
  checkOrganization,
  Controller.bulkMarkAsAcknowledged
);

router.patch(
  "/:id/read",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "notifications", "update"),
  checkOrganization,
  Controller.markAsRead
);

router.patch(
  "/:id/acknowledge",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "notifications", "update"),
  checkOrganization,
  Controller.markAsAcknowledged
);

router.patch(
  "/:id/resolve",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "notifications", "update"),
  checkOrganization,
  Controller.markAsResolved
);

router.delete(
  "/:id",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "notifications", "delete"),
  checkOrganization,
  Controller.delete
);

module.exports = router;
