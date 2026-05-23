const Organization = require("./model");
const User = require("../users/model");
const Vehicle = require("../vehicle/model");
const Device = require("../gpsDevice/model");
const Driver = require("../drivers/model");
const VehicleMapping = require("../deviceMapping/model");
const Validator = require("../../helpers/validators");
const paginate = require("../../helpers/limitoffset");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const {
  buildContextFromReq,
  createOrganizationCreatedNotification,
} = require("../notifications/producers");

/* ======================================================
   COMMON HELPERS
====================================================== */

const parseJsonFields = (body, fields = []) => {
  fields.forEach((field) => {
    if (typeof body[field] === "string" && body[field].trim().startsWith("{")) {
      try {
        body[field] = JSON.parse(body[field]);
      } catch (e) {
        console.warn(`Failed to parse field ${field}:`, e.message);
      }
    }
  });
};

/* ======================================================
   VALIDATIONS
====================================================== */

const validateOrganizationData = async (data) => {
  const rules = {
    name: "required|string",
    organizationType: "required|in:logistics,transport,school,taxi,fleet",
    email: "required|email",
    phone: "required|string",
  };
  const validator = new Validator(data, rules);
  await validator.validate();
};

const validateOrganizationWithAdminData = async (data) => {
  const rules = {
    name: "required|string",
    organizationType: "required|in:logistics,transport,school,taxi,fleet",
    email: "required|email",
    phone: "required|string",
    firstName: "required|string",
    lastName: "required|string",
    password: "required|string",
  };
  const validator = new Validator(data, rules);
  await validator.validate();
};

const validateSubOrgData = async (data) => {
  const rules = {
    name: "required|string",
    organizationType: "required|in:logistics,transport,school,taxi,fleet",
    email: "required|email",
    phone: "required|string",
    parentOrganizationId: "required",
  };
  const validator = new Validator(data, rules);
  await validator.validate();
};

const validateManagerData = async (data) => {
  const rules = {
    firstName: "required|string",
    lastName: "required|string",
    password: "required",
  };
  const validator = new Validator(data, rules);
  await validator.validate();
};

const validateSubAdminData = async (data) => {
  const rules = {
    organizationId: "required",
    firstName: "required|string",
    lastName: "required|string",
    email: "required|email",
    mobile: "required|string",
    password: "required|string",
  };
  const validator = new Validator(data, rules);
  await validator.validate();
};

const resolveParentOrganizationId = (req, requestedParentOrganizationId) => {
  if (req.user?.role === "admin") {
    return req.user.organizationId || null;
  }
  return requestedParentOrganizationId || null;
};

const validateAddressData = (address) => {
  if (!address) return true;
  if (typeof address !== "object" && typeof address !== "string") {
    throw {
      status: 400,
      message:
        "Address must be an object or a string",
    };
  }
};

const normalizeAddress = (address) => {
  if (!address) return { addressLine: "", city: "", state: "", country: "", pincode: "" };
  if (typeof address === "string") {
    return { addressLine: address, city: "", state: "", country: "", pincode: "" };
  }
  return {
    addressLine: address.addressLine || "",
    city: address.city || "",
    state: address.state || "",
    country: address.country || "",
    pincode: address.pincode || "",
  };
};

const validateGeoData = (geo) => {
  if (!geo) return true;
  if (typeof geo !== "object") {
    throw { status: 400, message: "Geo must be an object" };
  }
  if (geo.lat && (geo.lat < -90 || geo.lat > 90)) {
    throw { status: 400, message: "Latitude must be between -90 and 90" };
  }
  if (geo.lng && (geo.lng < -180 || geo.lng > 180)) {
    throw { status: 400, message: "Longitude must be between -180 and 180" };
  }
};

const validateSettingsData = (settings) => {
  if (!settings) return true;
  if (typeof settings !== "object") {
    throw { status: 400, message: "Settings must be an object" };
  }
};

/* ======================================================
   CREATE ORGANIZATION + ADMIN
====================================================== */

exports.createOrganizationWithAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    parseJsonFields(req.body, ["address", "geo", "settings"]);

    await validateOrganizationWithAdminData(req.body);
    validateAddressData(req.body.address);
    validateGeoData(req.body.geo);
    validateSettingsData(req.body.settings);

    const {
      name,
      organizationType,
      email,
      phone,
      firstName,
      lastName,
      password,
      address,
      geo,
      settings,
    } = req.body;

    /* 🔒 GLOBAL UNIQUE OR SCOPED UNIQUE — choose strategy */

    const orgExists = await Organization.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: phone.trim() }],
    }).session(session);

    if (orgExists) {
      throw {
        status: 409,
        message: "Organization with this email or phone already exists",
      };
    }

    const userExists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { mobile: phone.trim() }],
    }).session(session);

    if (userExists) {
      throw {
        status: 409,
        message: "Admin user with this email or mobile already exists",
      };
    }

    /* 🧠 SLUG SAFE */

    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    let slug = baseSlug;
    let slugExists = await Organization.findOne({ path: `/${slug}` });

    if (slugExists) {
      slug = `${baseSlug}-${Date.now()}`;
    }

    const path = `/${slug}`;

    const logo = req.file ? `/uploads/logos/${req.file.filename}` : null;

    /* 🏢 CREATE ORG */

    const [organization] = await Organization.create(
      [
        {
          name: name.trim(),
          organizationType,
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          logo,
          address: normalizeAddress(address),
          geo: geo || { timezone: "Asia/Kolkata" },
          settings: settings || {},
          parentOrganizationId: null,
          path,
          status: "active",
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    /* 👤 CREATE ADMIN */

    const passwordHash = await bcrypt.hash(password, 10);

    const [adminUser] = await User.create(
      [
        {
          organizationId: organization._id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.toLowerCase().trim(),
          mobile: phone.trim(),
          passwordHash,
          role: "admin",
          status: "active",
        },
      ],
      { session }
    );

    organization.adminUser = adminUser._id;
    await organization.save({ session });

    await session.commitTransaction();

    // 🌊 Post-commit logic (isolated)
    try {
      createOrganizationCreatedNotification(
        {
          organization,
          createdWithAdmin: true,
          isSubOrganization: false,
        },
        buildContextFromReq(req),
      );
    } catch (notifErr) {
      console.warn("Notification failed for organization creation:", notifErr.message);
    }

    return res.status(201).json({
      status: true,
      message: "Organization and Admin created successfully",
      data: { organization, admin: adminUser },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Create Organization With Admin Error:", error);

    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};
/* ======================================================
   CREATE ORGANIZATION ONLY
====================================================== */

exports.createOrganization = async (req, res) => {
  try {
    parseJsonFields(req.body, ["address", "geo", "settings"]);

    await validateOrganizationData(req.body);
    validateAddressData(req.body.address);
    validateGeoData(req.body.geo);
    validateSettingsData(req.body.settings);

    const { name, organizationType, email, phone, address, geo, settings } =
      req.body;

    const exists = await Organization.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: phone.trim() }],
    });
    if (exists) {
      return res.status(409).json({
        status: false,
        message: "Organization with this email or phone already exists",
      });
    }

    const logo = req.file
      ? `/uploads/logos/${req.file.filename}`
      : req.body.logo || null;

    const path = `/${name.toLowerCase().replace(/\s+/g, "-")}`;

    const organization = await Organization.create({
      name: name.trim(),
      organizationType,
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      logo,
      address: address || {},
      geo: geo || { timezone: "Asia/Kolkata" },
      settings: settings || {},
      parentOrganizationId: null,
      path,
      adminUser: null,
      createdBy: req.user._id,
      status: "active",
    });

    // 🌊 Post-create logic (isolated)
    try {
      createOrganizationCreatedNotification(
        {
          organization,
          createdWithAdmin: false,
          isSubOrganization: false,
        },
        buildContextFromReq(req),
      );
    } catch (notifErr) {
      console.warn("Notification failed for organization creation:", notifErr.message);
    }

    return res.status(201).json({
      status: true,
      message: "Organization Created Successfully",
      data: organization,
    });
  } catch (error) {
    console.error("Create Organization Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* ======================================================
   READ
====================================================== */

exports.getAll = async (req, res) => {
  try {
    const query =
      req.user.role === "superadmin" || req.orgScope === "ALL"
        ? {}
        : { _id: { $in: req.orgScope } };

    const organizations = await Organization.find(query);

    return res.status(200).json({
      status: true,
      message: "Organizations Fetched Successfully",
      data: organizations,
    });
  } catch (error) {
    console.error("Get All Organizations Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    // 🔐 ORG SCOPE FIX
    const organizationQuery =
      req.orgScope === "ALL"
        ? { _id: req.params.id }
        : {
            $and: [
              { _id: req.params.id },
              { _id: { $in: req.orgScope } },
            ],
          };
    const organization = await Organization.findOne(organizationQuery);

    if (!organization) {
      return res
        .status(404)
        .json({ status: false, message: "Organization not found or access denied" });
    }
    return res.status(200).json({
      status: true,
      message: "Organization Fetched Successfully",
      data: organization,
    });
  } catch (error) {
    console.error("Get Organization By ID Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

/* ======================================================
   UPDATE
====================================================== */

exports.update = async (req, res) => {
  try {
    // 🔐 ORG SCOPE FIX
    const organizationQuery =
      req.orgScope === "ALL"
        ? { _id: req.params.id }
        : {
            $and: [
              { _id: req.params.id },
              { _id: { $in: req.orgScope } },
            ],
          };
    const organization = await Organization.findOne(organizationQuery);

    if (!organization) {
      return res
        .status(404)
        .json({ status: false, message: "Organization not found or access denied" });
    }

    // 🛡️ LOGO UPDATE RESTRICTION & PROPAGATION
    const isSuperAdmin = req.user.role === "superadmin";
    const isRootAdmin = req.user.role === "admin" && 
                       req.user.organizationId.toString() === organization._id.toString() && 
                       !organization.parentOrganizationId;

    if (req.file) {
      req.body.logo = `/uploads/logos/${req.file.filename}`;
    }

    if (req.body.logo !== undefined) {
      if (!isSuperAdmin && !isRootAdmin) {
        // Non-main admins cannot update logo
        delete req.body.logo;
        if (req.file) {
          // If they uploaded a file, it's already on disk, but we won't use it.
          // Ideally delete it, but for now we just won't update the DB.
        }
      }
    }

    const allowedFields = [
      "name",
      "organizationType",
      "email",
      "phone",
      "logo",
      "address",
      "geo",
      "settings",
      "status",
    ];

    let logoChanged = false;
    const oldLogo = organization.logo;

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "logo" && req.body.logo !== oldLogo) {
          logoChanged = true;
        }
        organization[field] =
          field === "email"
            ? req.body[field].toLowerCase()
            : field === "phone"
              ? req.body[field].trim()
              : req.body[field];
      }
    });

    await organization.save();

    // 🌊 PROPAGATE LOGO TO SUB-ORGANIZATIONS
    if (logoChanged && organization.logo) {
      const regex = new RegExp(`^${organization.path}/`);
      await Organization.updateMany(
        { path: { $regex: regex } },
        { $set: { logo: organization.logo, updatedAt: Date.now() } }
      );
    }

    return res.status(200).json({
      status: true,
      message: "Organization Updated Successfully",
      data: organization,
    });
  } catch (error) {
    console.error("Update Organization Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

/* ======================================================
   DELETE
====================================================== */

exports.delete = async (req, res) => {
  try {
    const organizationQuery =
      req.orgScope === "ALL"
        ? { _id: req.params.id }
        : {
            $and: [
              { _id: req.params.id },
              { _id: { $in: req.orgScope } },
            ],
          };

    const organization = await Organization.findOne(organizationQuery);

    if (!organization) {
      return res.status(404).json({
        status: false,
        message: "Organization not found or access denied",
        });
      }
      
      if (!organization.parentOrganizationId || organization.parentOrganizationId === "") {
  return res.status(400).json({
          status: false, 
    message: "Root organization cannot be deleted",
        });
      }
    /* 🧨 CASCADE DELETE */

    await Promise.all([
      User.deleteMany({ organizationId: req.params.id }),
      Vehicle.deleteMany({ organizationId: req.params.id }),
      Device.deleteMany({ organizationId: req.params.id }),
      Driver.deleteMany({ organizationId: req.params.id }),
      VehicleMapping.deleteMany({ organizationId: req.params.id }),
    ]);

    await Organization.deleteOne({ _id: req.params.id });

    return res.status(200).json({
      status: true,
      message: "Organization Deleted Successfully",
    });
  } catch (error) {
    console.error("Delete Organization Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

/* ======================================================
   CREATE SUB-ORG + ADMIN (TRANSACTION)
====================================================== */
exports.createSubOrganizationWithManager = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (typeof req.body.organizationData === "string") {
      try {
        req.body.organizationData = JSON.parse(req.body.organizationData);
      } catch (_) { }
    }
    if (typeof req.body.managerData === "string") {
      try {
        req.body.managerData = JSON.parse(req.body.managerData);
      } catch (_) { }
    }

    const organizationData = req.body.organizationData || {};
    const managerData = req.body.managerData || {};

    const parentOrganizationId = resolveParentOrganizationId(
      req,
      req.body.parentOrganizationId || organizationData.parentOrganizationId
    );

    await validateOrganizationData(organizationData);
    await validateManagerData(managerData);
    validateAddressData(organizationData.address);
    validateGeoData(organizationData.geo);
    validateSettingsData(organizationData.settings);

    if (!parentOrganizationId) {
      throw { status: 400, message: "parentOrganizationId is required" };
    }

    // 🔐 ensure admin has access to parent org
    if (
      req.orgScope !== "ALL" &&
      Array.isArray(req.orgScope) &&
      !req.orgScope.some(
        (id) => id.toString() === parentOrganizationId.toString()
      )
    ) {
      throw { status: 403, message: "You are not allowed to create sub-organization under this organization" };
    }

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { _id: { $in: req.orgScope } };
    const parentOrg = await Organization.findOne({
      _id: parentOrganizationId,
      ...orgFilter
    }).session(session);

    if (!parentOrg) {
      throw { status: 404, message: "Parent organization not found" };
    }

    // 🔒 duplicate organization check (SAME as root org)
    const orgExists = await Organization.findOne({
      $or: [
        { email: organizationData.email.toLowerCase() },
        { phone: organizationData.phone.trim() },
      ],
    }).session(session);

    if (orgExists) {
      throw { status: 409, message: "Organization with this email or phone already exists" };
    }

    const adminEmail = (managerData.email || organizationData.email || "")
      .toLowerCase()
      .trim();
    const adminMobile = (managerData.mobile || organizationData.phone || "")
      .trim();

    const userExists = await User.findOne({
      $or: [{ email: adminEmail }, { mobile: adminMobile }],
    }).session(session);

    if (userExists) {
      throw { status: 409, message: "User with this email or mobile already exists" };
    }

    // 🧠 slug + path (same logic everywhere)
    const slug = organizationData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    const path = `${parentOrg.path}/${slug}`;

    const logo = req.file
      ? `/uploads/logos/${req.file.filename}`
      : null;

    // 1️⃣ create sub-organization
    const [subOrganization] = await Organization.create(
      [
        {
          name: organizationData.name.trim(),
          organizationType: organizationData.organizationType,
          email: organizationData.email.toLowerCase().trim(),
          phone: organizationData.phone.trim(),
          logo,
          address: organizationData.address || {},
          geo: organizationData.geo || { timezone: "Asia/Kolkata" },
          settings: organizationData.settings || {},
          parentOrganizationId,
          path,
          status: "active",
          createdBy: req.user._id,
          adminUser: null,
        },
      ],
      { session },
    );

    // 2️⃣ create manager
    // 🔥 email & phone SAME as organization
    const passwordHash = await bcrypt.hash(managerData.password, 10);

    const [newOrgAdmin] = await User.create(
      [
        {
          organizationId: subOrganization._id,
          firstName: managerData.firstName.trim(),
          lastName: managerData.lastName.trim(),
          email: adminEmail,
          mobile: adminMobile,
          passwordHash,
          role: "admin",
          status: "active",
          createdBy: req.user._id,
        },
      ],
      { session },
    );

    subOrganization.adminUser = newOrgAdmin._id;
    await subOrganization.save({ session });

    await session.commitTransaction();

    // 🌊 Post-commit logic (isolated)
    try {
      createOrganizationCreatedNotification(
        {
          organization: subOrganization,
          createdWithAdmin: true,
          isSubOrganization: true,
        },
        buildContextFromReq(req),
      );
    } catch (notifErr) {
      console.warn("Notification failed for sub-organization creation:", notifErr.message);
    }

    return res.status(201).json({
      status: true,
      message: "Sub-organization and admin created successfully",
      data: {
        organization: subOrganization,
        admin: newOrgAdmin,
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Create Sub Organization With Manager Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

/* ======================================================
   CREATE SUB-ORGANIZATION ONLY
====================================================== */
exports.createSubOrganization = async (req, res) => {
  try {
    parseJsonFields(req.body, ["address", "geo", "settings"]);

    const payload = req.body.organizationData || req.body;
    const parentOrganizationId = resolveParentOrganizationId(
      req,
      req.body.parentOrganizationId || payload.parentOrganizationId
    );

    await validateSubOrgData({
      ...payload,
      parentOrganizationId,
    });
    validateAddressData(payload.address);
    validateGeoData(payload.geo);
    validateSettingsData(payload.settings);

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { _id: { $in: req.orgScope } };
    const parentOrg = await Organization.findOne({
      _id: parentOrganizationId,
      ...orgFilter
    });
    if (!parentOrg) {
      return res.status(404).json({
        status: false,
        message: "Parent organization not found",
      });
    }

    if (
      req.orgScope !== "ALL" &&
      Array.isArray(req.orgScope) &&
      !req.orgScope.some((id) => id.toString() === parentOrganizationId.toString())
    ) {
      return res.status(403).json({
        status: false,
        message: "You are not allowed to create sub-organization under this organization",
      });
    }

    const exists = await Organization.findOne({
      $or: [
        { email: payload.email.toLowerCase().trim() },
        { phone: payload.phone.trim() },
      ],
    });
    if (exists) {
      return res.status(409).json({
        status: false,
        message: "Organization with this email or phone already exists",
      });
    }

    const slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const path = `${parentOrg.path}/${slug}`;
    const logo = req.file ? `/uploads/logos/${req.file.filename}` : null;

    const organization = await Organization.create({
      name: payload.name.trim(),
      organizationType: payload.organizationType,
      email: payload.email.toLowerCase().trim(),
      phone: payload.phone.trim(),
      logo,
      address: payload.address || {},
      geo: payload.geo || { timezone: "Asia/Kolkata" },
      settings: payload.settings || {},
      parentOrganizationId,
      path,
      status: "active",
      createdBy: req.user._id,
      adminUser: null,
    });

    // 🌊 Post-create logic (isolated)
    try {
      createOrganizationCreatedNotification(
        {
          organization,
          createdWithAdmin: false,
          isSubOrganization: true,
        },
        buildContextFromReq(req),
      );
    } catch (notifErr) {
      console.warn("Notification failed for sub-organization creation:", notifErr.message);
    }

    return res.status(201).json({
      status: true,
      message: "Sub-organization created successfully",
      data: organization,
    });
  } catch (error) {
    console.error("Create Sub Organization Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

/* ======================================================
   CREATE SUB-ADMIN ONLY
====================================================== */
exports.createSubAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await validateSubAdminData(req.body);

    const { organizationId, firstName, lastName, email, mobile, password } =
      req.body;

    // 🔐 ORG SCOPE FIX
    const orgFilter = req.orgScope === "ALL" ? {} : { _id: { $in: req.orgScope } };
    const organization = await Organization.findOne({
      _id: organizationId,
      ...orgFilter
    }).session(session);
    if (!organization) {
      throw { status: 404, message: "Organization not found" };
    }

    if (
      req.orgScope !== "ALL" &&
      !req.orgScope.some((id) => id.toString() === organizationId.toString())
    ) {
      throw { status: 403, message: "You are not allowed to add sub-admin for this organization" };
    }

    if (organization.adminUser) {
      throw { status: 409, message: "Sub-admin already exists for this organization" };
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { mobile: mobile.trim() }],
    }).session(session);

    if (existingUser) {
      throw { status: 409, message: "User with this email or mobile already exists" };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [subAdmin] = await User.create(
      [
        {
          organizationId: organization._id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.toLowerCase().trim(),
          mobile: mobile.trim(),
          passwordHash,
          role: "admin",
          status: "active",
          createdBy: req.user._id,
        },
      ],
      { session },
    );

    organization.adminUser = subAdmin._id;
    organization.createdBy = organization.createdBy || req.user._id;
    await organization.save({ session });

    await session.commitTransaction();

    return res.status(201).json({
      status: true,
      message: "Sub-admin created successfully",
      data: subAdmin,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Create Sub Admin Error:", error);
    return res.status(error.status || 500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};


/* ======================================================
   GET SUB-ORGANIZATIONS
====================================================== */

exports.getSubOrganizations = async (req, res) => {
  try {
    const { page, limit, search, organizationType, status, name } = req.query;

    // 🔐 org scope from middleware
    if (!req.orgScope || req.orgScope === "ALL") {
      return res.status(400).json({
        status: false,
        message: "Organization scope missing",
      });
    }

    // 👇 exclude parent org itself, keep only sub-orgs
    const filter = {
      _id: { $in: req.orgScope },
      parentOrganizationId: { $ne: null },
    };

    if (organizationType) filter.organizationType = organizationType;
    if (status) filter.status = status;
    if (name && String(name).trim()) {
      filter.name = { $regex: String(name).trim(), $options: "i" };
    }

    const result = await paginate(
      Organization,
      filter,
      page,
      limit,
      ["parentOrganizationId", "createdBy"],
      ["name", "email", "phone", "organizationType"],
      search
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get Sub Organizations Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};
