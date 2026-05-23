const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../users/model");
const Organization = require("../organizations/model");

const Validator = require("../../helpers/validators");
const paginate = require("../../helpers/limitoffset");

const JWT_SECRET = process.env.JWT_SECRET;

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildUserDateRange = (from, to) => {
  const range = {};

  if (from) {
    const parsedFrom = new Date(String(from));
    if (!Number.isNaN(parsedFrom.getTime())) {
      range.$gte = parsedFrom;
    }
  }

  if (to) {
    const parsedTo = new Date(String(to));
    if (!Number.isNaN(parsedTo.getTime())) {
      parsedTo.setHours(23, 59, 59, 999);
      range.$lte = parsedTo;
    }
  }

  return Object.keys(range).length ? range : null;
};

const buildScopedOrgIdsForManagerView = (req) => {
  if (req.orgScope === "ALL") return null;

  const scopedOrgIds = req.orgScope.map((id) => id.toString());
  const parentOrgId = req.user.organizationId
    ? req.user.organizationId.toString()
    : null;

  return parentOrgId
    ? scopedOrgIds.filter((id) => id !== parentOrgId)
    : scopedOrgIds;
};

const buildUsersQuery = async (req, options = {}) => {
  const {
    organizationId,
    organizationName,
    role,
    status,
    name,
    email,
    mobile,
    from,
    to,
    roles,
    excludeUserId,
  } = req.query;

  const query = {};
  const andClauses = [];

  if (options.managerScoped) {
    const scopedOrgIds = buildScopedOrgIdsForManagerView(req);
    if (scopedOrgIds) {
      query.organizationId = { $in: scopedOrgIds };
    }
  } else if (req.user.role === "superadmin") {
    if (organizationId) {
      query.organizationId = organizationId;
    }
  } else if (req.orgScope !== "ALL") {
    query.organizationId = { $in: req.orgScope };
  }

  if (organizationId && options.managerScoped) {
    const scopedOrgIds = buildScopedOrgIdsForManagerView(req);
    if (!scopedOrgIds || scopedOrgIds.includes(String(organizationId))) {
      query.organizationId = organizationId;
    } else {
      query.organizationId = { $in: [] };
    }
  }

  if (organizationName) {
    const orgQuery = {
      name: { $regex: escapeRegex(organizationName), $options: "i" },
    };

    if (query.organizationId && query.organizationId.$in) {
      orgQuery._id = { $in: query.organizationId.$in };
    }

    const matchingOrgIds = await Organization.find(orgQuery).distinct("_id");
    query.organizationId =
      matchingOrgIds.length > 0 ? { $in: matchingOrgIds } : { $in: [] };
  }

  if (role) query.role = role;
  if (status) query.status = status;

  if (roles) {
    const parsedRoles = String(roles)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (parsedRoles.length) {
      query.role = { $in: parsedRoles };
    }
  }

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  if (name) {
    andClauses.push({
      $or: [
        { firstName: { $regex: escapeRegex(name), $options: "i" } },
        { lastName: { $regex: escapeRegex(name), $options: "i" } },
      ],
    });
  }

  if (email) {
    query.email = { $regex: escapeRegex(email), $options: "i" };
  }

  if (mobile) {
    query.mobile = { $regex: escapeRegex(mobile), $options: "i" };
  }

  const createdAt = buildUserDateRange(from, to);
  if (createdAt) {
    query.createdAt = createdAt;
  }

  if (andClauses.length) {
    query.$and = andClauses;
  }

  return query;
};

/* ======================================================
   VALIDATIONS
====================================================== */

const validateLoginData = async (data) => {
  const rules = {
    email: "required|email",
    password: "required",
  };
  const validator = new Validator(data, rules);
  await validator.validate();
};

const validateUpdateUserData = async (data) => {
  const rules = {
    firstName: "string",
    lastName: "string",
    email: "email",
    mobile: "string",
    status: "in:active,inactive",
  };

  const allowedFields = ["firstName", "lastName", "email", "mobile", "status"];

  Object.keys(data).forEach((key) => {
    if (!allowedFields.includes(key)) {
      throw { status: 400, message: `Invalid field: ${key}` };
    }
    if (data[key] === "") {
      throw { status: 400, message: `${key} cannot be empty` };
    }
  });

  const validator = new Validator(data, rules);
  await validator.validate();
};

/* ======================================================
   AUTH
====================================================== */

exports.login = async (req, res) => {
  try {
    await validateLoginData(req.body);

    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() })
      .populate("organizationId", "name path"); // 👈 IMPORTANT

    if (!user) {
      return res.status(401).json({ status: false, message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ status: false, message: "Invalid email or password" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ status: false, message: "User account is inactive" });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        organizationId: user.organizationId?._id || null,
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      status: true,
      message: "Login Successfully",
      token,
      user: {
        _id: user._id,
        role: user.role,

        organizationId: user.organizationId?._id,
        organizationName: user.organizationId?.name,
        organizationPath: user.organizationId?.path,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Server error",
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-passwordHash")
      .populate("organizationId", "name email phone logo")
      .populate("assignedVehicleId", "vehicleNumber vehicleType model status runningStatus deviceId");
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });
    return res.json({ status: true, data: user });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/* ======================================================
   READ USERS
====================================================== */

exports.getAll = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const query = await buildUsersQuery(req, { managerScoped: false });

    const result = await paginate(
      User,
      query,
      page,
      limit,
      ["organizationId"],
      ["firstName", "lastName", "email", "mobile"],
      search,
      { createdAt: -1 }
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get All Users Error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
    });
  }
};

exports.getManagerByOrganization = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const usersQuery = await buildUsersQuery(req, { managerScoped: true });

    const result = await paginate(
      User,
      usersQuery,
      page,
      limit,
      ["organizationId"],
      ["firstName", "lastName", "email", "mobile"],
      search,
      { createdAt: -1 }
    );

    return res.status(200).json({
      ...result,
      message: "Users fetched successfully",
    });
  } catch (error) {
    console.error("Get Users Error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
    });
  }
};

/* ======================================================
   CREATE USER (ADMIN / SUPERADMIN)
====================================================== */

exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, mobile, password, role, organizationId } =
      req.body;
    const allowedRoles = ["admin", "driver"];

    if (!firstName || !email || !mobile || !password || !role) {
      return res.status(400).json({
        status: false,
        message: "Required fields missing",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        status: false,
        message: "Invalid role. Allowed roles: admin, driver",
      });
    }

    // 🔐 ORG SCOPE FIX
    let finalOrgId;
    if (req.user.role === "superadmin") {
      finalOrgId = organizationId || req.user.organizationId;
    } else if (
      organizationId &&
      req.orgScope !== "ALL" &&
      Array.isArray(req.orgScope) &&
      req.orgScope.some(id => id.toString() === organizationId.toString())
    ) {
      finalOrgId = organizationId;
    } else {
      finalOrgId = req.user.organizationId;
    }

    if (!finalOrgId) {
      return res.status(400).json({
        status: false,
        message: "Organization is required",
      });
    }

    const org = await Organization.findById(finalOrgId);
    if (!org) {
      return res
        .status(404)
        .json({ status: false, message: "Organization not found" });
    }

    const exists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { mobile: mobile.trim() }],
    });
    if (exists) {
      return res.status(409).json({
        status: false,
        message: "User with this email or mobile already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      organizationId: finalOrgId,
      firstName: firstName.trim(),
      lastName: lastName?.trim(),
      email: email.toLowerCase().trim(),
      mobile: mobile.trim(),
      passwordHash,
      role,
      status: "active",
    });

    return res.status(201).json({
      status: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    console.error("Create User Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* ======================================================
   UPDATE USER
====================================================== */

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid user ID" });
    }

    await validateUpdateUserData(req.body);

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const user = await User.findOne({ _id: id, ...orgFilter });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found or access denied",
      });
    }

    if (req.body.email || req.body.mobile) {
      const duplicate = await User.findOne({
        _id: { $ne: user._id },
        $or: [
          req.body.email && { email: req.body.email.toLowerCase() },
          req.body.mobile && { mobile: req.body.mobile.trim() },
        ].filter(Boolean),
      });

      if (duplicate) {
        return res.status(409).json({
          status: false,
          message: "User with this email or mobile already exists",
        });
      }
    }

    Object.assign(user, req.body);
    await user.save();

    return res.status(200).json({
      status: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update User Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* ======================================================
   DELETE USER
====================================================== */

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid user ID" });
    }

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { organizationId: { $in: req.orgScope } };
    const user = await User.findOne({ _id: id, ...orgFilter });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found or access denied",
      });
    }

    if (req.user.role !== "superadmin") {
      if (!req.orgScope) {
        return res.status(400).json({
          status: false,
          message: "Organization scope missing",
        });
      }

      if (user.role === "superadmin") {
        return res.status(403).json({
          status: false,
          message: "Forbidden: Cannot delete superadmin user",
        });
      }
    }

    await user.deleteOne();

    return res.status(200).json({
      status: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};
