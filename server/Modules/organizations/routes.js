const express = require("express");
const router = express.Router();

const requireAuth = require("../../middleware/verifyToken");
const checkAuthorization = require("../../middleware/checkAuthorization");
const checkOrganization = require("../../middleware/checkOrganization");
const { handleLogoUpload } = require("../../middleware/multerUpload");

const Controller = require("./controller");

/* =========================
   CREATE
========================= */

// 1️⃣ Create root organization + admin (INITIAL SETUP)
router.post(
  "/",
  requireAuth,
  checkAuthorization(["superadmin"], "organizations", "create"),
  handleLogoUpload,
  Controller.createOrganizationWithAdmin
);

// 2️⃣ Create sub-organization + admin
router.post(
  "/sub",
  requireAuth,
  checkAuthorization(["superadmin", "admin"], "organizations", "create"),
  checkOrganization,
  handleLogoUpload,
  Controller.createSubOrganizationWithManager
);

// 3️⃣ Create sub-organization only
// router.post(
//   "/sub-organization",
//   requireAuth,
//   checkAuthorization(["superadmin", "admin"], "organizations", "create"),
//   checkOrganization,
//   handleLogoUpload,
//   Controller.createSubOrganization
// );

// 4️⃣ Create sub-organization admin only
// router.post(
//   "/sub-admin",
//   requireAuth,
//   checkAuthorization(["superadmin", "admin"], "organizations", "create"),
//   checkOrganization,
//   Controller.createSubAdmin
// );

/* =========================
   READ
========================= */

// 5️⃣ Get organizations (scoped)
router.get(
  "/",
  requireAuth,
  checkAuthorization(["superadmin", "admin"], "organizations", "read"),
  checkOrganization,
  Controller.getAll
);

// 6️⃣ Get only sub-organizations of current org
router.get(
  "/sub",
  requireAuth,
  checkAuthorization(["superadmin", "admin"], "organizations", "read"),
  checkOrganization,
  Controller.getSubOrganizations
);

// 7️⃣ Get organization by id (superadmin only)
router.get(
  "/:id",
  requireAuth,
  checkAuthorization(["superadmin"], "organizations", "read"),
  checkOrganization,
  Controller.getById
);

/* =========================
   UPDATE
========================= */

router.put(
  "/:id",
  requireAuth,
  checkAuthorization(["superadmin", "admin"], "organizations", "update"),
  checkOrganization,
  handleLogoUpload,
  Controller.update
);

/* =========================
   DELETE
========================= */

router.delete(
  "/:id",
  requireAuth,
  checkAuthorization(["superadmin", "admin"], "organizations", "delete"),
  checkOrganization,
  Controller.delete
);

module.exports = router;
