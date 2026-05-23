const VehicleDailyStats = require('./model');
const Validator = require('../../helpers/validators');
const paginate = require("../../helpers/limitoffset");

const validateVehicleDailyStatsData = async (data) => {
    const rules = {
        organizationId: "required",
        vehicleId: "required",
        date: "required",
    }
    const validator = new Validator(data, rules);
    await validator.validate()
}

exports.create = async (req, res) => {
    try {
        await validateVehicleDailyStatsData(req.body);

        // 🔐 ORG SCOPE FIX
        let organizationId;
        if (req.user.role === "superadmin") {
            organizationId = req.body.organizationId || req.orgId;
        } else if (
            req.body.organizationId &&
            req.orgScope !== "ALL" &&
            Array.isArray(req.orgScope) &&
            req.orgScope.some(id => id.toString() === req.body.organizationId.toString())
        ) {
            organizationId = req.body.organizationId;
        } else {
            organizationId = req.orgId;
        }

        const { vehicleId, gpsDeviceId, date, totalDistance, maxSpeed, avgSpeed, runningTime, idleTime, stoppedTime, firstIgnitionOn, lastIgnitionOff } = req.body;

        const vehicleDailyStats = await VehicleDailyStats.create({
            organizationId,
            vehicleId,
            gpsDeviceId,
            date,
            totalDistance: totalDistance || 0,
            maxSpeed: maxSpeed || 0,
            avgSpeed: avgSpeed || 0,
            runningTime: runningTime || 0,
            idleTime: idleTime || 0,
            stoppedTime: stoppedTime || 0,
            firstIgnitionOn,
            lastIgnitionOff
        })
        return res.status(201).json({
            status: true,
            message: "Vehicle Daily Stats Created Successfully",
            data: vehicleDailyStats
        })
    } catch (error) {
        console.error("Create Vehicle Daily Stats Error:", error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
};

exports.getAll = async (req, res) => {
    try {
        const { page, limit, search } = req.query;

        const filter = {};
        // 🔐 ORG SCOPE FIX
        if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
            filter.organizationId = { $in: req.orgScope };
        }

        const result = await paginate(
            VehicleDailyStats,
            filter,
            page,
            limit,
            ['organizationId', 'vehicleId', 'gpsDeviceId'],
            [],
            search
        );

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getByVehicle = async (req, res) => {
    try {
        const { page, limit, search } = req.query;

        const filter = { vehicleId: req.params.vehicleId };
        // 🔐 ORG SCOPE FIX
        if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
            filter.organizationId = { $in: req.orgScope };
        }

        const result = await paginate(
            VehicleDailyStats,
            filter,
            page,
            limit,
            ['organizationId', 'vehicleId', 'gpsDeviceId'],
            [],
            search
        );

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getByVehicleAndDate = async (req, res) => {
    try {
        const { vehicleId, date } = req.params;
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // 🔐 ORG SCOPE FIX
        const filter = {
            vehicleId,
            date: { $gte: startOfDay, $lte: endOfDay }
        };
        if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
            filter.organizationId = { $in: req.orgScope };
        }

        const stats = await VehicleDailyStats.find(filter)
            .populate('organizationId')
            .populate('vehicleId')
            .populate('gpsDeviceId');

        if (!stats || stats.length === 0) {
            // Return empty stats instead of 404 to avoid noisy logs and handle new vehicles gracefully
            return res.status(200).json({
                status: true,
                data: {
                    totalDistance: 0,
                    maxSpeed: 0,
                    avgSpeed: 0,
                    runningTime: 0,
                    idleTime: 0,
                    stoppedTime: 0,
                    totalTrips: 0,
                    alertCounts: {
                        overspeedCount: 0,
                        harshBrakingCount: 0,
                        harshAccelerationCount: 0,
                        rashTurningCount: 0,
                        tamperAlertCount: 0,
                        emergencyCount: 0
                    }
                }
            });
        }
        return res.status(200).json({ status: true, data: stats[0] });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};
