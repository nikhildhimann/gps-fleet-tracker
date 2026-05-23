const express = require("express");
const router = express.Router();

const verifyToken = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");
const { handleVehicleImageUpload } = require("../../middleware/multerUpload");

const Controller = require("./controller");

// create vehicle
router.post(
  "/",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "vehicle", "create"),
  checkOrganization,
  Controller.create,
);

// get all vehicles
router.get(
  "/",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "vehicle", "read"),
  checkOrganization,
  Controller.getAll,
);

// get vehicle by id
router.get(
  "/:id",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "vehicle", "read"),
  checkOrganization,
  Controller.getById,
);

// update vehicle
router.put(
  "/:id",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "vehicle", "update"),
  checkOrganization,
  Controller.update,
);

// // deactivate vehicle
// router.patch(
//   "/:id/deactivate",
//   verifyToken,
//   checkAuthorization(["admin", "superadmin"], "vehicle", "update"),
//   checkOrganization,
//   Controller.deactivate,
// );

// // activate vehicle (MISSING AUTH ❌)
// router.patch(
//   "/:id/active",
//   verifyToken,
//   checkAuthorization(["admin", "superadmin"], "vehicle", "update"),
//   checkOrganization,
//   Controller.updateStatus,
// );

// hard delete
router.delete(
  "/:id",
  verifyToken,
  checkAuthorization(["admin", "superadmin"], "vehicle", "delete"),
  checkOrganization,
  Controller.remove,
);

// get vehicles by suborganization
// router.get(
//   "/suborganization/:suborganizationId",
//   verifyToken,
//   checkAuthorization(["admin", "superadmin"], "vehicle", "read"),
//   checkOrganization,
//   Controller.getBySuborganization,
// );

module.exports = router;
