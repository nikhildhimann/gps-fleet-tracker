const Alert = require('./model');
const Validator = require('../../helpers/validators');
const paginate = require("../../helpers/limitoffset");
const {
    buildContextFromReq,
    createNotificationFromAlert,
} = require("../notifications/producers");

const validateAlertData = async (data) => {
    const rules = {
        organizationId: "required",
        gpsDeviceId: "required",
        vehicleId: "required",
        type: "required",
        message: "required",
    }
    const validator = new Validator(data, rules);
    await validator.validate()
}

exports.create = async (req, res) => {
    try {
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

        const { gpsDeviceId, vehicleId, type, message, locationType, locationCoordinates } = req.body;

        const alert = await Alert.create({
            organizationId,
            gpsDeviceId,
            vehicleId,
            type,
            message,
            locationType,
            locationCoordinates,
            acknowledged: false,
        })

        await createNotificationFromAlert(alert, buildContextFromReq(req));

        return res.status(201).json({
            status: true,
            message: "Alert Created Successfully",
            data: alert
        })
    } catch (error) {
        console.error("Create Alert Error:", error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
};

exports.getAll = async (req, res) => {
    try {
        const { page, limit, search, type, acknowledged } = req.query;

        const filter = {};
        if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
            filter.organizationId = { $in: req.orgScope };
        }
        if (type) filter.type = type;
        if (acknowledged !== undefined) filter.acknowledged = acknowledged === 'true';

        const result = await paginate(
            Alert,
            filter,
            page,
            limit,
            ['organizationId', 'gpsDeviceId', 'vehicleId'],
            ['message', 'type'],
            search
        );

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        // 🔐 ORG SCOPE FIX
        const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
        const alert = await Alert.findOne({ _id: req.params.id, ...orgFilter })
            .populate('organizationId')
            .populate('gpsDeviceId')
            .populate('vehicleId');

        if (!alert) return res.status(404).json({ status: false, message: "Alert not found" });

        return res.status(200).json({ status: true, data: alert });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        // 🔐 ORG SCOPE FIX
        const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
        const alert = await Alert.findOne({ _id: req.params.id, ...orgFilter });
        if (!alert) return res.status(404).json({ status: false, message: "Alert not found or access denied" });

        const updatedAlert = await Alert.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .populate('organizationId')
            .populate('gpsDeviceId')
            .populate('vehicleId');

        return res.status(200).json({ status: true, message: "Updated Successfully", data: updatedAlert });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.acknowledge = async (req, res) => {
    try {
        // 🔐 ORG SCOPE FIX
        const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
        const alert = await Alert.findOne({ _id: req.params.id, ...orgFilter });
        if (!alert) return res.status(404).json({ status: false, message: "Alert not found or access denied" });

        const updatedAlert = await Alert.findByIdAndUpdate(
            req.params.id,
            { acknowledged: true, acknowledgedAt: new Date() },
            { new: true }
        ).populate('organizationId')
            .populate('gpsDeviceId')
            .populate('vehicleId');

        return res.status(200).json({ status: true, message: "Alert Acknowledged", data: updatedAlert });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.acknowledgeAll = async (req, res) => {
    try {
        const filter = { acknowledged: false };
        if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
            filter.organizationId = { $in: req.orgScope };
        }

        const result = await Alert.updateMany(
            filter,
            { acknowledged: true, acknowledgedAt: new Date() }
        );
        return res.status(200).json({
            status: true,
            message: "All alerts acknowledged",
            data: result,
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        // 🔐 ORG SCOPE FIX
        const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
        const alert = await Alert.findOne({ _id: req.params.id, ...orgFilter });
        if (!alert) return res.status(404).json({ status: false, message: "Alert not found or access denied" });

        await alert.deleteOne();
        return res.status(200).json({ status: true, message: "Deleted Successfully" });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.deleteAll = async (req, res) => {
    try {
        const filter = {};
        if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
            filter.organizationId = { $in: req.orgScope };
        }

        const result = await Alert.deleteMany(filter);
        return res.status(200).json({
            status: true,
            message: "All alerts deleted",
            data: result,
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getByVehicle = async (req, res) => {
    try {
        const { page, limit, search, type, acknowledged } = req.query;

        const filter = { vehicleId: req.params.vehicleId };
        // 🔐 ORG SCOPE FIX
        if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
            filter.organizationId = { $in: req.orgScope };
        }
        if (type) filter.type = type;
        if (acknowledged !== undefined) filter.acknowledged = acknowledged === 'true';

        const result = await paginate(
            Alert,
            filter,
            page,
            limit,
            ['organizationId', 'gpsDeviceId', 'vehicleId'],
            ['message', 'type'],
            search
        );

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getUnacknowledged = async (req, res) => {
    try {
        const { page, limit, search, type } = req.query;

        const filter = { acknowledged: false };
        if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
            filter.organizationId = { $in: req.orgScope };
        }
        if (type) filter.type = type;

        const result = await paginate(
            Alert,
            filter,
            page,
            limit,
            ['organizationId', 'gpsDeviceId', 'vehicleId'],
            ['message', 'type'],
            search
        );

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};
