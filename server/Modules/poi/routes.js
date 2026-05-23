const express = require("express");
const router = express.Router();

const requireAuth = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");

const Controller = require("./controller");

router.post(
  "/",
  requireAuth,
  checkAuthorization(["admin"], "poi", "create"),
  checkOrganization,
  Controller.create
);

router.post(
  "/bulk",
  requireAuth,
  checkAuthorization(["admin"], "poi", "create"),
  checkOrganization,
  Controller.bulkCreate
);
router.get(
  "/",
  requireAuth,
  checkAuthorization(["admin"], "poi", "read"),
  checkOrganization,
  Controller.getAll
);
router.get(
  "/nearby",
  requireAuth,
  checkAuthorization(["admin"], "poi", "read"),
  checkOrganization,
  Controller.nearby
);

router.get(
  "/:id",
  requireAuth,
  checkAuthorization(["admin"], "poi", "read"),
  checkOrganization,
  Controller.getById
);

router.put(
  "/:id",
  requireAuth,
  checkAuthorization(["admin"], "poi", "update"),
  checkOrganization,
  Controller.update
);

router.delete(
  "/:id",
  requireAuth,
  checkAuthorization(["admin"], "poi", "delete"),
  checkOrganization,
  Controller.delete
);
router.delete(
  "/index-status",
  requireAuth,
  checkAuthorization(["admin"], "poi", "read"),
  checkOrganization,
  Controller.indexStatus
);


module.exports = router;
