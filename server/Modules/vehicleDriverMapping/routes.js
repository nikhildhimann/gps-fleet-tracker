const express = require("express");
const router = express.Router();

const verifyToken = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const checkAuthorization = require("../../middleware/checkAuthorization");

const Controller = require("./controller");

// Assign driver to vehicle
router.post(
    "/assign",
    verifyToken,
    checkAuthorization(["admin", "superadmin"], "vehicleDriverMapping", "create"),
    checkOrganization,
    Controller.assignDriverToVehicle
);

router.get(
    "/",
    verifyToken,
    checkAuthorization(["admin", "superadmin"], "vehicleDriverMapping", "read"),
    checkOrganization,
    Controller.getAll
);

// Unassign driver from vehicle
router.post(
    "/unassign",
    verifyToken,
    checkAuthorization(["admin", "superadmin"], "vehicleDriverMapping", "update"),
    checkOrganization,
    Controller.unassignDriverFromVehicle
);

// Get current driver for a vehicle
router.get(
    "/:vehicleId/current",
    verifyToken,
    checkAuthorization(["admin", "superadmin", "driver"], "vehicleDriverMapping", "read"),
    checkOrganization,
    Controller.getCurrentDriverByVehicle
);

module.exports = router;
