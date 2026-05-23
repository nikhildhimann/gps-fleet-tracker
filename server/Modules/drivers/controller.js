const Driver = require('./model');
const User = require('../users/model');
const Vehicle = require('../vehicle/model');
const Validator = require('../../helpers/validators');
const mongoose = require('mongoose');
const paginate = require("../../helpers/limitoffset");
const bcrypt = require('bcryptjs');
const { cleanupForDriverDeletion } = require("../../common/mappingCleanup");

const validateDriverData = async (data) => {
    const rules = {
        firstName: "required|string",
        lastName: "required|string",
        phone: "required|string",
        email: "required|string",
        licenseNumber: "required|string",
        licenseExpiry: "date",
        photo: "string",
        address: "string",
        status: "in:active,inactive,blocked",
        organizationId: "string",
    }
    const validator = new Validator(data, rules);
    await validator.validate()
}

const validateDriverUserData = async (data) => {
    const rules = {
        firstName: "required|string",
        lastName: "required|string",
        phone: "required|string",
        email: "required|email",
        licenseNumber: "required|string",
        licenseExpiry: "date",
        passwordHash: "required",
        address: "string",
        status: "in:active,inactive,blocked",
    }
    const validator = new Validator(data, rules);
    await validator.validate()
}

const resolveDriverOrganizationId = (payload, req) => {
    const candidate = payload?.organizationId;
    if (req.user.role === "superadmin" && candidate) {
        return candidate.toString();
    }

    if (candidate) {
        const candidateId = candidate.toString();
        if (
            req.orgScope === "ALL" ||
            (Array.isArray(req.orgScope) &&
                req.orgScope.some((id) => id.toString() === candidateId))
        ) {
            return candidateId;
        }
    }

    return req.orgId;
};

const validateUpdateDriverData = async (data) => {
    const rules = {
        firstName: "string",
        lastName: "string",
        phone: "string",
        email: "string",
        licenseNumber: "string",
        licenseExpiry: "date",
        photo: "string",
        address: "string",
        status: "in:active,inactive,blocked",
        availability: "boolean",
        assignedVehicleId: "string"
    };

    // Empty string check
    Object.keys(data).forEach((key) => {
        if (data[key] === "") {
            throw {
                status: 400,
                message: `${key} cannot be empty`,
            };
        }
    });

    // Allowed fields only
    const allowedFields = [
        "firstName",
        "lastName",
        "phone",
        "email",
        "licenseNumber",
        "licenseExpiry",
        "photo",
        "address",
        "status",
        "availability",
        "assignedVehicleId"
    ];
    if (data.organizationId) {
        allowedFields.push("organizationId");
        rules.organizationId = "string";
    }

    Object.keys(data).forEach((key) => {
        if (!allowedFields.includes(key)) {
            throw {
                status: 400,
                message: `Invalid field: ${key}`,
            };
        }
    });

    const validator = new Validator(data, rules);
    await validator.validate()
}

exports.create = async (req, res) => {
    try {
        await validateDriverData(req.body);

        const { assignedVehicleId, firstName, lastName, phone, email, licenseNumber, licenseExpiry, photo, address, organizationId: orgPayload } = req.body;

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

        if (!organizationId) {
            return res.status(400).json({
                status: false,
                message: "OrganizationId is required",
            });
        }

        // Check for duplicate by organization-scoped unique fields
        const existingDriver = await Driver.findOne({
            organizationId,
            $or: [{ email }, { phone }, { licenseNumber }]
        });

        if (existingDriver) {
            return res.status(409).json({
                status: false,
                message: "Driver with this email, phone, or license number already exists in this organization"
            });
        }

        // Validate assignedVehicleId if provided
        if (assignedVehicleId && !mongoose.isValidObjectId(assignedVehicleId)) {
            return res.status(400).json({
                status: false,
                message: "Invalid assigned vehicle ID"
            });
        }

        const driver = await Driver.create({
            organizationId,
            assignedVehicleId: assignedVehicleId || null,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            email: email.toLowerCase().trim(),
            licenseNumber: licenseNumber.toUpperCase().trim(),
            licenseExpiry,
            photo: photo || null,
            address: address || null,
            status: "active",
            availability: true,
            totalTrips: 0,
            rating: 0,
            joiningDate: new Date()
        });

        await driver.populate(['organizationId', 'assignedVehicleId']);

        return res.status(201).json({
            status: true,
            message: "Driver Created Successfully",
            data: driver
        });
    } catch (error) {
        console.error("Create Driver Error:", error);
        return res.status(error.status || 500).json({
            status: false,
            message: error.message || "Internal server error",
        });
    }
};

exports.getAll = async (req, res) => {
    try {
        const {
            status,
            page,
            limit,
            search,
            organizationId,
            name,
            phone,
            licenseNumber,
            vehicleNumber,
            startDate,
            endDate,
        } = req.query;

        const filter = {};

        // 🔐 ORG SCOPE FIX
        if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
            filter.organizationId = { $in: req.orgScope };
        }

        if (status) filter.status = status;
        if (organizationId) {
            if (req.user.role === "superadmin" || req.orgScope === "ALL") {
                filter.organizationId = organizationId;
            } else if (
                Array.isArray(req.orgScope) &&
                req.orgScope.some((id) => id.toString() === String(organizationId))
            ) {
                filter.organizationId = organizationId;
            }
        }

        if (name) {
            filter.$and = [
                ...(filter.$and || []),
                {
                    $or: [
                        { firstName: { $regex: String(name).trim(), $options: "i" } },
                        { lastName: { $regex: String(name).trim(), $options: "i" } },
                    ],
                },
            ];
        }

        if (phone) {
            filter.phone = { $regex: String(phone).trim(), $options: "i" };
        }

        if (licenseNumber) {
            filter.licenseNumber = {
                $regex: String(licenseNumber).trim().toUpperCase(),
                $options: "i",
            };
        }

        if (vehicleNumber) {
            const vehicleFilter = {
                vehicleNumber: {
                    $regex: String(vehicleNumber).trim().toUpperCase(),
                    $options: "i",
                },
            };

            if (filter.organizationId) {
                vehicleFilter.organizationId = filter.organizationId;
            }

            const vehicleIds = await Vehicle.find(vehicleFilter).distinct("_id");
            filter.assignedVehicleId =
                vehicleIds.length > 0 ? { $in: vehicleIds } : { $in: [] };
        }

        if (startDate || endDate) {
            const joiningDate = {};

            if (startDate) {
                const parsedStart = new Date(String(startDate));
                if (!Number.isNaN(parsedStart.getTime())) {
                    joiningDate.$gte = parsedStart;
                }
            }

            if (endDate) {
                const parsedEnd = new Date(String(endDate));
                if (!Number.isNaN(parsedEnd.getTime())) {
                    parsedEnd.setHours(23, 59, 59, 999);
                    joiningDate.$lte = parsedEnd;
                }
            }

            if (Object.keys(joiningDate).length) {
                filter.joiningDate = joiningDate;
            }
        }

        const result = await paginate(
            Driver,
            filter,
            page,
            limit,
            [
                { path: "organizationId", select: "name" },
                { path: "assignedVehicleId", select: "vehicleNumber" }
            ],
            ["firstName", "lastName", "email", "phone"],
            search,
            { createdAt: -1 }   // 👈 newest first
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error("Get All Drivers Error:", error);
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

exports.getById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                status: false,
                message: "Invalid driver ID"
            });
        }

        // 🔐 ORG SCOPE FIX
        const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
        const driver = await Driver.findOne({ _id: id, ...orgFilter })
            .populate('organizationId')
            .populate('assignedVehicleId');

        if (!driver) {
            return res.status(404).json({
                status: false,
                message: "Driver not found or access denied"
            });
        }

        return res.status(200).json({
            status: true,
            data: driver
        });
    } catch (error) {
        console.error("Get Driver By ID Error:", error);
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                status: false,
                message: "Invalid driver ID"
            });
        }

        await validateUpdateDriverData(req.body);

        // 🔐 ORG SCOPE FIX
        const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
        const driver = await Driver.findOne({ _id: id, ...orgFilter });

        if (!driver) {
            return res.status(404).json({
                status: false,
                message: "Driver not found or access denied"
            });
        }

        // Check for duplicate unique fields if updating them
        let targetOrganizationId = driver.organizationId;
        if (req.body.organizationId) {
            const resolvedOrgId = resolveDriverOrganizationId({ organizationId: req.body.organizationId }, req);
            if (!resolvedOrgId) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid organization selection"
                });
            }
            targetOrganizationId = resolvedOrgId;
        }

        if (req.body.email || req.body.phone || req.body.licenseNumber) {
            const query = {
                organizationId: targetOrganizationId,
                _id: { $ne: driver._id }
            };

            const orConditions = [];
            if (req.body.email) orConditions.push({ email: req.body.email.toLowerCase().trim() });
            if (req.body.phone) orConditions.push({ phone: req.body.phone.trim() });
            if (req.body.licenseNumber) orConditions.push({ licenseNumber: req.body.licenseNumber.toUpperCase().trim() });

            if (orConditions.length > 0) {
                query.$or = orConditions;
                const duplicate = await Driver.findOne(query);
                if (duplicate) {
                    return res.status(409).json({
                        status: false,
                        message: "Driver with this email, phone, or license number already exists in this organization"
                    });
                }
            }
        }

        // Validate assignedVehicleId if provided
        if (req.body.assignedVehicleId && !mongoose.isValidObjectId(req.body.assignedVehicleId)) {
            return res.status(400).json({
                status: false,
                message: "Invalid assigned vehicle ID"
            });
        }

        if (req.body.organizationId) {
            req.body.organizationId = targetOrganizationId;
        }

        // Trim and normalize string fields
        if (req.body.firstName) req.body.firstName = req.body.firstName.trim();
        if (req.body.lastName) req.body.lastName = req.body.lastName.trim();
        if (req.body.phone) req.body.phone = req.body.phone.trim();
        if (req.body.email) req.body.email = req.body.email.toLowerCase().trim();
        if (req.body.licenseNumber) req.body.licenseNumber = req.body.licenseNumber.toUpperCase().trim();

        // Update with new fields
        Object.assign(driver, req.body);
        driver.updatedAt = new Date();
        await driver.save();

        await driver.populate(['organizationId', 'assignedVehicleId']);

        return res.status(200).json({
            status: true,
            message: "Driver Updated Successfully",
            data: driver
        });
    } catch (error) {
        console.error("Update Driver Error:", error);
        return res.status(error.status || 500).json({
            status: false,
            message: error.message || "Internal server error"
        });
    }
};

// Get active drivers that are NOT assigned to any vehicle
exports.getAvailable = async (req, res) => {
    try {
        const filter = { status: "active", assignedVehicleId: null };
        
        // 🔐 ORG SCOPE FIX
        if (req.user.role !== "superadmin" && req.orgScope !== "ALL") {
            filter.organizationId = { $in: req.orgScope };
        }

        const drivers = await Driver.find(filter).populate('organizationId', 'name');

        return res.json({
            status: true,
            data: drivers
        });
    } catch (error) {
        console.error("Get Available Drivers Error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.delete = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                status: false,
                message: "Invalid driver ID"
            });
        }

        // 🔐 ORG SCOPE FIX
        const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
        const driver = await Driver.findOne({
            _id: id,
            ...orgFilter
        }).session(session);

        if (!driver) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            return res.status(403).json({
                status: false,
                message: "Forbidden: Access denied or driver not found"
            });
        }

        await cleanupForDriverDeletion(driver, session);
        await driver.deleteOne({ session });
        await session.commitTransaction();

        return res.status(200).json({
            status: true,
            message: "Driver Deleted Successfully"
        });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Delete Driver Error:", error);
        return res.status(error.status || 500).json({
            status: false,
            message: error.message || "Internal server error"
        });
    } finally {
        session.endSession();
    }
};

// Create Driver + User in one request (Industry Standard: Single Form Submission)
exports.createDriverUser = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await validateDriverUserData(req.body);

        const {
            firstName, lastName, phone, email, passwordHash,
            licenseNumber, licenseExpiry, photo, address, assignedVehicleId, organizationId: organizationPayload
        } = req.body;

        // 🔐 ORG SCOPE FIX
        let organizationId;
        if (req.user.role === "superadmin") {
            organizationId = organizationPayload || req.orgId;
        } else if (
            organizationPayload &&
            req.orgScope !== "ALL" &&
            Array.isArray(req.orgScope) &&
            req.orgScope.some(id => id.toString() === organizationPayload.toString())
        ) {
            organizationId = organizationPayload;
        } else {
            organizationId = req.orgId;
        }

        if (!organizationId) {
            throw { status: 400, message: "OrganizationId is required" };
        }

        // Check for duplicate Driver (email, phone, license number)
        const existingDriver = await Driver.findOne({
            organizationId,
            $or: [{ email: email.toLowerCase() }, { phone }, { licenseNumber: licenseNumber.toUpperCase() }]
        }).session(session);

        if (existingDriver) {
            throw { status: 409, message: "Driver with this email, phone, or license number already exists in this organization" };
        }

        // Check for duplicate User (email, mobile)
        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { mobile: phone }]
        }).session(session);

        if (existingUser) {
            throw { status: 409, message: "User with this email or mobile already exists" };
        }

        // Validate assignedVehicleId if provided
        if (assignedVehicleId && !mongoose.isValidObjectId(assignedVehicleId)) {
            throw { status: 400, message: "Invalid assigned vehicle ID" };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(passwordHash, 10);

        // Create Driver record
        const [driver] = await Driver.create([{
            organizationId,
            assignedVehicleId: assignedVehicleId || null,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            email: email.toLowerCase().trim(),
            licenseNumber: licenseNumber.toUpperCase().trim(),
            licenseExpiry,
            photo: photo || null,
            address: address || null,
            status: "active",
            availability: true,
            totalTrips: 0,
            rating: 0,
            joiningDate: new Date(),
            createdBy: req.user._id,
        }], { session });

        // Create User record with role="driver" and link to driver
        const [user] = await User.create([{
            organizationId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            mobile: phone.trim(),
            passwordHash: hashedPassword,
            role: "driver",
            status: "active",
            driverId: driver._id,
            assignedVehicleId: assignedVehicleId || null,
            lastLoginAt: null
        }], { session });

        await session.commitTransaction();

        // Populate references (not really needed for return data but good for consistency)
        // Note: population usually won't reflect session data until committed, so we do it after if needed.

        return res.status(201).json({
            status: true,
            message: "Driver and User account created successfully",
            data: {
                driver: {
                    _id: driver._id,
                    firstName: driver.firstName,
                    lastName: driver.lastName,
                    email: driver.email,
                    phone: driver.phone,
                    licenseNumber: driver.licenseNumber,
                    status: driver.status,
                    availability: driver.availability
                },
                user: {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    mobile: user.mobile,
                    role: user.role,
                    driverId: user.driverId,
                    status: user.status
                }
            }
        });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Create Driver User Error:", error);
        return res.status(error.status || 500).json({
            status: false,
            message: error.message || "Internal server error"
        });
    } finally {
        session.endSession();
    }
};
