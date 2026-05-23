const express = require("express");
const router = express.Router();
const Controller = require("./controller");

const verifyToken = require("../../middleware/verifyToken");
const checkAuthorization = require("../../middleware/checkAuthorization");
const checkOrganization = require("../../middleware/checkOrganization");

// AUTH
router.post("/login", Controller.login);
router.get("/me", verifyToken, Controller.getMe);

// SUPERADMIN – GLOBAL
router.get(
  "/",
  verifyToken,
  checkAuthorization(["superadmin"], "users", "read"),
  Controller.getAll
);

router.put(
  "/:id",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "users", "update"),
  checkOrganization,
  Controller.updateUser
);

router.delete(
  "/:id",
  verifyToken,
  checkAuthorization(["superadmin", "admin"], "users", "delete"),
  checkOrganization,
  Controller.deleteUser
);

// ORG-SCOPED
router.get(
  "/by-organization",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "users", "read"),
  checkOrganization,
  Controller.getManagerByOrganization
);

// CREATE USER
router.post(
  "/",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "users", "create"),
  checkOrganization,
  Controller.createUser
);

module.exports = router;
