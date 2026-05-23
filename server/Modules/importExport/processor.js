const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Vehicle = require("../vehicle/model");
const GpsDevice = require("../gpsDevice/model");
const Organization = require("../organizations/model");
const Driver = require("../drivers/model");
const User = require("../users/model");
const DeviceMapping = require("../deviceMapping/model");
const VehicleDriverMapping = require("../vehicleDriverMapping/model");
const { syncInventoryStatus } = require("../gpsDevice/service");
const { normalizeImportedRow } = require("./validator");

function addError(result, row, field, message, raw = null) {
  result.errorRowSet.add(row);
  result.errors.push({ row, field, message, raw });
}

function addDuplicate(result, row, field, message, raw = null) {
  result.duplicateRowSet.add(row);
  result.errors.push({ row, field, message, raw, type: "duplicate" });
}

function buildOrgSlug(name) {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "") || "org"
  );
}

function buildUniqueOrganizationPath(parentPath, baseSlug, rowNumber, usedPaths) {
  const normalizedParentPath = parentPath || "";
  const basePath = normalizedParentPath ? `${normalizedParentPath}/${baseSlug}` : `/${baseSlug}`;
  if (!usedPaths.has(basePath)) {
    usedPaths.add(basePath);
    return basePath;
  }

  let suffix = 1;
  let candidate = normalizedParentPath
    ? `${normalizedParentPath}/${baseSlug}-${rowNumber}`
    : `/${baseSlug}-${rowNumber}`;

  while (usedPaths.has(candidate)) {
    suffix += 1;
    candidate = normalizedParentPath
      ? `${normalizedParentPath}/${baseSlug}-${rowNumber}-${suffix}`
      : `/${baseSlug}-${rowNumber}-${suffix}`;
  }

  usedPaths.add(candidate);
  return candidate;
}

function addChunkFailure(result, rows, field, message) {
  rows.forEach((item) => {
    if (result.errorRowSet.has(item.rowNumber) || result.duplicateRowSet.has(item.rowNumber)) {
      return;
    }
    addError(result, item.rowNumber, field, message, item.raw);
  });
}

async function normalizeChunkRows(entity, rows, req, context, result, options) {
  const normalizedRows = [];

  for (const item of rows) {
    const { normalized, errors } = normalizeImportedRow(entity, item.data, req, context, options);
    if (errors.length > 0) {
      errors.forEach((error) => addError(result, item.rowNumber, error.field, error.message, item.data));
      continue;
    }
    normalizedRows.push({
      rowNumber: item.rowNumber,
      raw: item.data,
      data: normalized,
    });
  }

  return normalizedRows;
}

async function processOrganizationsChunk(rows, req, context, result, state) {
  if (rows.length === 0) return;

  const candidateEmails = [...new Set(rows.map((item) => item.data.email).filter(Boolean))];
  const candidatePhones = [...new Set(rows.map((item) => item.data.phone).filter(Boolean))];
  const existingOrganizations =
    candidateEmails.length || candidatePhones.length
      ? await Organization.find({
          $or: [
            candidateEmails.length ? { email: { $in: candidateEmails } } : null,
            candidatePhones.length ? { phone: { $in: candidatePhones } } : null,
          ].filter(Boolean),
        })
          .select("email phone path")
          .lean()
      : [];

  const existingEmails = new Set([
    ...existingOrganizations.map((organization) => organization.email).filter(Boolean),
    ...state.seenOrganizationEmails,
  ]);
  const existingPhones = new Set([
    ...existingOrganizations.map((organization) => organization.phone).filter(Boolean),
    ...state.seenOrganizationPhones,
  ]);

  const resolvedRows = [];
  const candidatePaths = [];

  for (const item of rows) {
    const row = item.data;
    let parentOrganizationId = null;
    let parentPath = "";

    if (row.parentOrganizationId) {
      const parent = context.organizationsById.get(String(row.parentOrganizationId));
      if (!parent) {
        addError(result, item.rowNumber, "parentOrganizationId", "parentOrganizationId not found", item.raw);
        continue;
      }
      if (req.orgScope !== "ALL" && !req.orgScope.includes(String(parent._id))) {
        addError(result, item.rowNumber, "parentOrganizationId", "parentOrganizationId is outside the allowed scope", item.raw);
        continue;
      }
      parentOrganizationId = String(parent._id);
      parentPath = parent.path || "";
    } else if (row.parentOrganizationName) {
      const parents = context.organizationsByNormalizedName.get(String(row.parentOrganizationName).toLowerCase()) || [];
      const scopedParents =
        req.orgScope === "ALL"
          ? parents
          : parents.filter((org) => req.orgScope.includes(String(org._id)));
      if (scopedParents.length !== 1) {
        addError(result, item.rowNumber, "parentOrganizationName", "parentOrganizationName did not match exactly one accessible organization", item.raw);
        continue;
      }
      parentOrganizationId = String(scopedParents[0]._id);
      parentPath = scopedParents[0].path || "";
    } else if (req.user.role !== "superadmin") {
      parentOrganizationId = String(req.orgId);
      parentPath = context.organizationsById.get(String(req.orgId))?.path || "";
    }

    if (existingEmails.has(row.email) || existingPhones.has(row.phone)) {
      addDuplicate(result, item.rowNumber, "email", "Organization with this email or phone already exists", item.raw);
      continue;
    }

    existingEmails.add(row.email);
    existingPhones.add(row.phone);

    const baseSlug = buildOrgSlug(row.name);
    candidatePaths.push(parentPath ? `${parentPath}/${baseSlug}` : `/${baseSlug}`);
    resolvedRows.push({
      item,
      row,
      parentOrganizationId,
      parentPath,
      baseSlug,
    });
  }

  if (resolvedRows.length === 0) return;

  const existingPaths = candidatePaths.length
    ? await Organization.find({ path: { $in: candidatePaths } }).select("path").lean()
    : [];
  const usedPaths = new Set([
    ...existingPaths.map((organization) => organization.path).filter(Boolean),
    ...state.seenOrganizationPaths,
  ]);

  const docs = [];
  const meta = [];
  for (const resolved of resolvedRows) {
    const generatedPath = buildUniqueOrganizationPath(
      resolved.parentPath,
      resolved.baseSlug,
      resolved.item.rowNumber,
      usedPaths,
    );
    docs.push({
      name: resolved.row.name,
      organizationType: resolved.row.organizationType,
      email: resolved.row.email,
      phone: resolved.row.phone,
      address: {
        addressLine: resolved.row.addressLine || "",
        city: resolved.row.city || "",
        state: resolved.row.state || "",
        country: resolved.row.country || "",
        pincode: resolved.row.pincode || "",
      },
      geo: { timezone: "Asia/Kolkata" },
      settings: {},
      parentOrganizationId: resolved.parentOrganizationId || null,
      path: generatedPath,
      adminUser: null,
      status: resolved.row.status || "active",
      createdBy: req.user._id,
    });
    meta.push(resolved);
  }

  try {
    const insertedOrganizations = await Organization.insertMany(docs, { ordered: false });
    insertedOrganizations.forEach((organization) => {
      if (organization.email) state.seenOrganizationEmails.add(organization.email);
      if (organization.phone) state.seenOrganizationPhones.add(organization.phone);
      if (organization.path) state.seenOrganizationPaths.add(organization.path);
    });
    result.successfulRows += insertedOrganizations.length;
    result.summary.inserted += insertedOrganizations.length;
  } catch (error) {
    if (!error?.writeErrors?.length) throw error;
    const failedIndexes = new Set();
    for (const writeError of error.writeErrors) {
      failedIndexes.add(writeError.index);
      const source = meta[writeError.index];
      if (writeError.code === 11000) {
        addDuplicate(result, source.item.rowNumber, "email", "Duplicate organization unique key conflict", source.item.raw);
      } else if (source) {
        addError(result, source.item.rowNumber, "name", writeError.errmsg || "Organization import failed", source.item.raw);
      }
    }

    const insertedCount = docs.length - failedIndexes.size;
    result.successfulRows += insertedCount;
    result.summary.inserted += insertedCount;

    docs.forEach((doc, index) => {
      if (failedIndexes.has(index)) return;
      if (doc.email) state.seenOrganizationEmails.add(doc.email);
      if (doc.phone) state.seenOrganizationPhones.add(doc.phone);
      if (doc.path) state.seenOrganizationPaths.add(doc.path);
    });
  }
}

async function processUsersChunk(rows, req, result) {
  if (rows.length === 0) return;

  const emails = [...new Set(rows.map((item) => item.data.email).filter(Boolean))];
  const mobiles = [...new Set(rows.map((item) => item.data.mobile).filter(Boolean))];
  const existingUsers = await User.find({
    $or: [
      emails.length ? { email: { $in: emails } } : null,
      mobiles.length ? { mobile: { $in: mobiles } } : null,
    ].filter(Boolean),
  }).select("email mobile").lean();

  const existingEmail = new Set(existingUsers.map((user) => user.email));
  const existingMobile = new Set(existingUsers.map((user) => user.mobile));

  const docs = [];
  const meta = [];
  for (const item of rows) {
    const row = item.data;
    if (existingEmail.has(row.email) || existingMobile.has(row.mobile)) {
      addDuplicate(result, item.rowNumber, "email", "User with this email or mobile already exists", item.raw);
      continue;
    }

    const passwordHash = await bcrypt.hash(row.password, 10);
    docs.push({
      organizationId: new mongoose.Types.ObjectId(row.organizationId),
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      mobile: row.mobile,
      passwordHash,
      role: row.role,
      status: row.status,
    });
    meta.push(item);
  }

  if (docs.length === 0) return;

  try {
    await User.insertMany(docs, { ordered: false });
    result.successfulRows += docs.length;
    result.summary.inserted += docs.length;
  } catch (error) {
    if (!error?.writeErrors?.length) throw error;
    const failedIndexes = new Set();
    for (const writeError of error.writeErrors) {
      failedIndexes.add(writeError.index);
      const source = meta[writeError.index];
      if (writeError.code === 11000) {
        addDuplicate(result, source.rowNumber, "email", "Duplicate user unique key conflict", source.raw);
      } else {
        addError(result, source.rowNumber, "email", writeError.errmsg || "User insert failed", source.raw);
      }
    }
    const insertedCount = docs.length - failedIndexes.size;
    result.successfulRows += insertedCount;
    result.summary.inserted += insertedCount;
  }
}

async function processDevicesChunk(rows, req, result, state) {
  if (rows.length === 0) return;

  const imeis = [];
  const dedupedRows = [];
  for (const item of rows) {
    if (state.seenDeviceImeis.has(item.data.imei)) {
      addDuplicate(result, item.rowNumber, "imei", "Duplicate IMEI in file", item.raw);
      continue;
    }
    state.seenDeviceImeis.add(item.data.imei);
    imeis.push(item.data.imei);
    dedupedRows.push(item);
  }

  const existingDevices = await GpsDevice.find({ imei: { $in: imeis } }).select("imei").lean();
  const existingImeis = new Set(existingDevices.map((device) => device.imei));

  const docs = [];
  const meta = [];
  for (const item of dedupedRows) {
    const row = item.data;
    if (existingImeis.has(row.imei)) {
      addDuplicate(result, item.rowNumber, "imei", "GPS device with this IMEI already exists", item.raw);
      continue;
    }

    docs.push({
      imei: row.imei,
      organizationId: new mongoose.Types.ObjectId(row.organizationId),
      softwareVersion: row.softwareVersion,
      vendorId: row.vendorId,
      deviceModel: row.deviceModel || "",
      manufacturer: row.manufacturer || "",
      simNumber: row.simNumber || "",
      serialNumber: row.serialNumber || "",
      firmwareVersion: row.firmwareVersion || row.softwareVersion,
      hardwareVersion: row.hardwareVersion || "",
      warrantyExpiry: row.warrantyExpiry || null,
      vehicleRegistrationNumber: row.vehicleRegistrationNumber || undefined,
      status: row.status || "active",
      isOnline: false,
      connectionStatus: "offline",
      createdBy: req.user._id,
    });
    meta.push(item);
  }

  if (docs.length === 0) return;

  try {
    await GpsDevice.insertMany(docs, { ordered: false });
    result.successfulRows += docs.length;
    result.summary.inserted += docs.length;
  } catch (error) {
    if (!error?.writeErrors?.length) throw error;
    const failedIndexes = new Set();
    for (const writeError of error.writeErrors) {
      failedIndexes.add(writeError.index);
      const source = meta[writeError.index];
      if (writeError.code === 11000) {
        addDuplicate(result, source.rowNumber, "imei", "Duplicate IMEI unique key conflict", source.raw);
      } else {
        addError(result, source.rowNumber, "imei", writeError.errmsg || "Device insert failed", source.raw);
      }
    }
    const insertedCount = docs.length - failedIndexes.size;
    result.successfulRows += insertedCount;
    result.summary.inserted += insertedCount;
  }
}

async function processDriversChunk(rows, req, result, state) {
  if (rows.length === 0) return;

  const dedupedRows = [];
  const seenDriverEmails = new Set();
  const seenDriverPhones = new Set();
  const pendingDriverKeys = [];
  for (const item of rows) {
    const key = `${item.data.organizationId}:${item.data.licenseNumber}`;
    if (state.seenDriverKeys.has(key)) {
      addDuplicate(result, item.rowNumber, "licenseNumber", "Duplicate licenseNumber in file for the same organization", item.raw);
      continue;
    }
    const emailKey = `${item.data.organizationId}:${item.data.email}`;
    const phoneKey = `${item.data.organizationId}:${item.data.phone}`;
    if (seenDriverEmails.has(emailKey)) {
      addDuplicate(result, item.rowNumber, "email", "Duplicate email in file for the same organization", item.raw);
      continue;
    }
    if (seenDriverPhones.has(phoneKey)) {
      addDuplicate(result, item.rowNumber, "phone", "Duplicate phone in file for the same organization", item.raw);
      continue;
    }
    seenDriverEmails.add(emailKey);
    seenDriverPhones.add(phoneKey);
    pendingDriverKeys.push(key);
    dedupedRows.push(item);
  }

  if (dedupedRows.length === 0) return;

  const orgIds = [...new Set(dedupedRows.map((item) => item.data.organizationId))];
  const emails = [...new Set(dedupedRows.map((item) => item.data.email).filter(Boolean))];
  const phones = [...new Set(dedupedRows.map((item) => item.data.phone).filter(Boolean))];
  const licenseNumbers = [...new Set(dedupedRows.map((item) => item.data.licenseNumber).filter(Boolean))];

  const existingDrivers = await Driver.find({
    organizationId: { $in: orgIds },
    $or: [
      emails.length ? { email: { $in: emails } } : null,
      phones.length ? { phone: { $in: phones } } : null,
      licenseNumbers.length ? { licenseNumber: { $in: licenseNumbers } } : null,
    ].filter(Boolean),
  }).select("organizationId email phone licenseNumber").lean();

  const driverKeys = new Set();
  for (const driver of existingDrivers) {
    driverKeys.add(`${driver.organizationId}:${driver.email}`);
    driverKeys.add(`${driver.organizationId}:${driver.phone}`);
    driverKeys.add(`${driver.organizationId}:${driver.licenseNumber}`);
  }

  const existingUsers = await User.find({
    $or: [
      emails.length ? { email: { $in: emails } } : null,
      phones.length ? { mobile: { $in: phones } } : null,
    ].filter(Boolean),
  }).select("email mobile").lean();
  const existingUserEmails = new Set(existingUsers.map((user) => user.email));
  const existingUserMobiles = new Set(existingUsers.map((user) => user.mobile));

  const preparedRows = [];
  for (const item of dedupedRows) {
    const row = item.data;
    const rowKeys = [
      `${row.organizationId}:${row.email}`,
      `${row.organizationId}:${row.phone}`,
      `${row.organizationId}:${row.licenseNumber}`,
    ];
    if (rowKeys.some((key) => driverKeys.has(key))) {
      addDuplicate(result, item.rowNumber, "licenseNumber", "Driver with this email, phone, or license number already exists in this organization", item.raw);
      continue;
    }
    if (existingUserEmails.has(row.email) || existingUserMobiles.has(row.phone)) {
      addDuplicate(result, item.rowNumber, "email", "User with this email or mobile already exists", item.raw);
      continue;
    }

    const passwordHash = await bcrypt.hash(row.password, 10);
    preparedRows.push({
      item,
      driverDoc: {
        organizationId: new mongoose.Types.ObjectId(row.organizationId),
        assignedVehicleId: null,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        email: row.email,
        licenseNumber: row.licenseNumber,
        licenseExpiry: row.licenseExpiry || null,
        status: row.status || "active",
        availability: true,
        totalTrips: 0,
        rating: 0,
        joiningDate: new Date(),
      },
      userDocBase: {
        organizationId: new mongoose.Types.ObjectId(row.organizationId),
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        mobile: row.phone,
        passwordHash,
        role: "driver",
        status: row.status || "active",
        assignedVehicleId: null,
      },
    });
  }

  if (preparedRows.length === 0) return;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const insertedDrivers = await Driver.insertMany(
        preparedRows.map((entry) => entry.driverDoc),
        { session },
      );

      const userDocs = insertedDrivers.map((driver, index) => ({
        ...preparedRows[index].userDocBase,
        driverId: driver._id,
      }));

      await User.insertMany(userDocs, { session });
    });

    pendingDriverKeys.forEach((key) => state.seenDriverKeys.add(key));
    result.successfulRows += preparedRows.length;
    result.summary.inserted += preparedRows.length;
  } catch (error) {
    if (error?.code === 11000 || error?.writeErrors?.length) {
      const duplicateMessage =
        error?.message?.includes("mobile")
          ? "Duplicate user mobile unique key conflict"
          : error?.message?.includes("email")
            ? "Duplicate user email unique key conflict"
            : error?.message?.includes("licenseNumber")
              ? "Duplicate driver licenseNumber unique key conflict"
              : "Duplicate unique key conflict during driver import";
      addChunkFailure(result, preparedRows.map((entry) => entry.item), "driverImport", duplicateMessage);
      return;
    }

    addChunkFailure(
      result,
      preparedRows.map((entry) => entry.item),
      "driverImport",
      error?.message || "Driver import transaction failed",
    );
  } finally {
    await session.endSession();
  }
}

async function processVehiclesChunk(rows, req, result, state) {
  if (rows.length === 0) return;

  const dedupedRows = [];
  for (const item of rows) {
    const key = `${item.data.organizationId}:${item.data.vehicleNumber}`;
    if (state.seenVehicleKeys.has(key)) {
      addDuplicate(result, item.rowNumber, "vehicleNumber", "Duplicate vehicleNumber in file for the same organization", item.raw);
      continue;
    }
    state.seenVehicleKeys.add(key);
    dedupedRows.push(item);
  }

  const existingVehicles = await Vehicle.find({
    $or: dedupedRows.map((item) => ({
      organizationId: item.data.organizationId,
      vehicleNumber: item.data.vehicleNumber,
    })),
  }).select("organizationId vehicleNumber").lean();
  const existingKeys = new Set(existingVehicles.map((vehicle) => `${vehicle.organizationId}:${vehicle.vehicleNumber}`));

  const imeis = [...new Set(dedupedRows.map((item) => item.data.deviceImei).filter(Boolean))];
  const devices = imeis.length
    ? await GpsDevice.find({ imei: { $in: imeis } }).select("_id imei organizationId").lean()
    : [];
  const deviceByImei = new Map(devices.map((device) => [device.imei, device]));

  const activeMappings = devices.length
    ? await DeviceMapping.find({
        gpsDeviceId: { $in: devices.map((device) => device._id) },
        unassignedAt: null,
      }).select("gpsDeviceId").lean()
    : [];
  const mappedDeviceIds = new Set(activeMappings.map((mapping) => String(mapping.gpsDeviceId)));

  const docs = [];
  const meta = [];
  for (const item of dedupedRows) {
    const row = item.data;
    const uniqueKey = `${row.organizationId}:${row.vehicleNumber}`;
    if (existingKeys.has(uniqueKey)) {
      addDuplicate(result, item.rowNumber, "vehicleNumber", "Vehicle already exists in this organization", item.raw);
      continue;
    }

    if (row.deviceImei) {
      const device = deviceByImei.get(row.deviceImei);
      if (!device) {
        addError(result, item.rowNumber, "deviceImei", "deviceImei not found", item.raw);
        continue;
      }
      if (String(device.organizationId) !== String(row.organizationId)) {
        addError(result, item.rowNumber, "deviceImei", "deviceImei belongs to a different organization", item.raw);
        continue;
      }
      if (mappedDeviceIds.has(String(device._id))) {
        addDuplicate(result, item.rowNumber, "deviceImei", "deviceImei is already actively mapped", item.raw);
        continue;
      }
    }

    docs.push({
      organizationId: new mongoose.Types.ObjectId(row.organizationId),
      vehicleType: row.vehicleType,
      vehicleNumber: row.vehicleNumber,
      ais140Compliant: row.ais140Compliant === true,
      ais140CertificateNumber: row.ais140CertificateNumber || undefined,
      make: row.make || undefined,
      model: row.model || undefined,
      year: row.year ?? undefined,
      color: row.color || undefined,
      status: row.status || "active",
      runningStatus: row.runningStatus || "inactive",
      lastUpdated: row.lastUpdated || undefined,
      createdBy: req.user._id,
    });
    meta.push(item);
  }

  if (docs.length === 0) return;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      let insertResult = [];
      try {
        insertResult = await Vehicle.insertMany(docs, { ordered: false, session });
      } catch (error) {
        if (!error?.writeErrors?.length) throw error;
        const failedIndexes = new Set();
        for (const writeError of error.writeErrors) {
          failedIndexes.add(writeError.index);
          const source = meta[writeError.index];
          if (writeError.code === 11000) {
            addDuplicate(result, source.rowNumber, "vehicleNumber", "Duplicate vehicle unique key conflict", source.raw);
          } else {
            addError(result, source.rowNumber, "vehicleNumber", writeError.errmsg || "Vehicle insert failed", source.raw);
          }
        }
        insertResult = docs
          .map((doc, index) => (!failedIndexes.has(index) ? doc : null))
          .filter(Boolean);
      }

      const persistedVehicles = await Vehicle.find({
        $or: insertResult.map((doc) => ({
          organizationId: doc.organizationId,
          vehicleNumber: doc.vehicleNumber,
        })),
      }).select("_id organizationId vehicleNumber").session(session).lean();
      const vehicleByKey = new Map(
        persistedVehicles.map((vehicle) => [`${vehicle.organizationId}:${vehicle.vehicleNumber}`, vehicle]),
      );

      const mappingDocs = [];
      const vehicleUpdates = [];
      const deviceUpdates = [];
      const vehicleIdsToUnassign = [];
      const deviceIdsToUnassign = [];
      const now = new Date();

      for (const item of meta) {
        if (!item.data.deviceImei) continue;
        const vehicle = vehicleByKey.get(`${item.data.organizationId}:${item.data.vehicleNumber}`);
        const device = deviceByImei.get(item.data.deviceImei);
        if (!vehicle || !device) continue;

        vehicleIdsToUnassign.push(vehicle._id);
        deviceIdsToUnassign.push(device._id);
        mappingDocs.push({
          organizationId: vehicle.organizationId,
          vehicleId: vehicle._id,
          gpsDeviceId: device._id,
          assignedAt: now,
          unassignedAt: null,
        });
        vehicleUpdates.push({
          updateOne: {
            filter: { _id: vehicle._id },
            update: { $set: { deviceId: device._id, deviceImei: item.data.deviceImei } },
          },
        });
        deviceUpdates.push({
          updateOne: {
            filter: { _id: device._id },
            update: {
              $set: {
                vehicleId: vehicle._id,
                organizationId: vehicle.organizationId,
                vehicleRegistrationNumber: vehicle.vehicleNumber,
              },
            },
          },
        });
      }

      if (vehicleIdsToUnassign.length || deviceIdsToUnassign.length) {
        await DeviceMapping.updateMany(
          {
            unassignedAt: null,
            $or: [
              vehicleIdsToUnassign.length ? { vehicleId: { $in: vehicleIdsToUnassign } } : null,
              deviceIdsToUnassign.length ? { gpsDeviceId: { $in: deviceIdsToUnassign } } : null,
            ].filter(Boolean),
          },
          { $set: { unassignedAt: now } },
          { session },
        );
      }
      if (mappingDocs.length) {
        await DeviceMapping.insertMany(mappingDocs, { ordered: false, session });
      }
      if (vehicleUpdates.length) {
        await Vehicle.bulkWrite(vehicleUpdates, { session });
      }
      if (deviceUpdates.length) {
        await GpsDevice.bulkWrite(deviceUpdates, { session });
      }

      result.successfulRows += persistedVehicles.length;
      result.summary.inserted += persistedVehicles.length;
    });
  } finally {
    await session.endSession();
  }
}

async function processDeviceMappingsChunk(rows, req, result, state) {
  if (rows.length === 0) return;

  const dedupedRows = [];
  for (const item of rows) {
    const vehicleKey = `${item.data.organizationId}:${item.data.vehicleNumber}`;
    const deviceKey = `${item.data.organizationId}:${item.data.imei}`;

    if (state.seenDeviceMappingVehicleKeys.has(vehicleKey)) {
      addDuplicate(result, item.rowNumber, "vehicleNumber", "Duplicate vehicleNumber in file for device mapping", item.raw);
      continue;
    }

    if (state.seenDeviceMappingDeviceKeys.has(deviceKey)) {
      addDuplicate(result, item.rowNumber, "imei", "Duplicate imei in file for device mapping", item.raw);
      continue;
    }

    state.seenDeviceMappingVehicleKeys.add(vehicleKey);
    state.seenDeviceMappingDeviceKeys.add(deviceKey);
    dedupedRows.push(item);
  }

  if (dedupedRows.length === 0) return;

  const orgIds = [...new Set(dedupedRows.map((item) => item.data.organizationId))];
  const vehicleNumbers = [...new Set(dedupedRows.map((item) => item.data.vehicleNumber).filter(Boolean))];
  const imeis = [...new Set(dedupedRows.map((item) => item.data.imei).filter(Boolean))];

  const vehicles = await Vehicle.find({
    organizationId: { $in: orgIds },
    vehicleNumber: { $in: vehicleNumbers },
  }).select("_id organizationId vehicleNumber deviceId").lean();

  const devices = await GpsDevice.find({
    imei: { $in: imeis },
  }).select("_id organizationId imei vehicleId deviceModel status").lean();

  const vehicleByKey = new Map(
    vehicles.map((vehicle) => [`${vehicle.organizationId}:${vehicle.vehicleNumber}`, vehicle]),
  );
  const deviceByImei = new Map(devices.map((device) => [device.imei, device]));

  const activeMappings = await DeviceMapping.find({
    unassignedAt: null,
    $or: [
      { vehicleId: { $in: vehicles.map((vehicle) => vehicle._id) } },
      { gpsDeviceId: { $in: devices.map((device) => device._id) } },
    ],
  }).select("vehicleId gpsDeviceId").lean();

  const activeVehicleIds = new Set(activeMappings.map((mapping) => String(mapping.vehicleId)));
  const activeDeviceIds = new Set(activeMappings.map((mapping) => String(mapping.gpsDeviceId)));

  const preparedRows = [];
  for (const item of dedupedRows) {
    const row = item.data;
    const vehicle = vehicleByKey.get(`${row.organizationId}:${row.vehicleNumber}`);
    if (!vehicle) {
      addError(result, item.rowNumber, "vehicleNumber", "vehicleNumber not found in selected organization", item.raw);
      continue;
    }

    const device = deviceByImei.get(row.imei);
    if (!device) {
      addError(result, item.rowNumber, "imei", "imei not found", item.raw);
      continue;
    }

    if (String(device.organizationId) !== String(row.organizationId)) {
      addError(result, item.rowNumber, "imei", "imei belongs to a different organization", item.raw);
      continue;
    }

    if (device.status !== "active") {
      addError(result, item.rowNumber, "imei", "Only active GPS devices can be mapped", item.raw);
      continue;
    }

    if (vehicle.deviceId || activeVehicleIds.has(String(vehicle._id))) {
      addDuplicate(result, item.rowNumber, "vehicleNumber", "Vehicle already has an active device mapping", item.raw);
      continue;
    }

    if (device.vehicleId || activeDeviceIds.has(String(device._id))) {
      addDuplicate(result, item.rowNumber, "imei", "Device already has an active vehicle mapping", item.raw);
      continue;
    }

    activeVehicleIds.add(String(vehicle._id));
    activeDeviceIds.add(String(device._id));
    preparedRows.push({ item, vehicle, device });
  }

  if (preparedRows.length === 0) return;

  const now = new Date();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await DeviceMapping.insertMany(
        preparedRows.map(({ vehicle, device }) => ({
          organizationId: vehicle.organizationId,
          vehicleId: vehicle._id,
          gpsDeviceId: device._id,
          assignedAt: now,
          unassignedAt: null,
        })),
        { ordered: false, session },
      );

      await Vehicle.bulkWrite(
        preparedRows.map(({ vehicle, device }) => ({
          updateOne: {
            filter: { _id: vehicle._id },
            update: { $set: { deviceId: device._id, deviceImei: device.imei } },
          },
        })),
        { session },
      );

      await GpsDevice.bulkWrite(
        preparedRows.map(({ vehicle, device }) => ({
          updateOne: {
            filter: { _id: device._id },
            update: {
              $set: {
                vehicleId: vehicle._id,
                organizationId: vehicle.organizationId,
                vehicleRegistrationNumber: vehicle.vehicleNumber,
              },
            },
          },
        })),
        { session },
      );

      for (const { device } of preparedRows) {
        await syncInventoryStatus(device._id, "assigned", { session });
      }
    });

    result.successfulRows += preparedRows.length;
    result.summary.inserted += preparedRows.length;
  } catch (error) {
    if (error?.code === 11000 || error?.writeErrors?.length) {
      addChunkFailure(
        result,
        preparedRows.map((entry) => entry.item),
        "deviceMapping",
        "Duplicate active device mapping conflict",
      );
      return;
    }

    addChunkFailure(
      result,
      preparedRows.map((entry) => entry.item),
      "deviceMapping",
      error?.message || "Device mapping import failed",
    );
  } finally {
    await session.endSession();
  }
}

async function processDriverMappingsChunk(rows, req, result, state) {
  if (rows.length === 0) return;

  const dedupedRows = [];
  for (const item of rows) {
    const vehicleKey = `${item.data.organizationId}:${item.data.vehicleNumber}`;
    const driverKey = `${item.data.organizationId}:${item.data.driverEmail}`;

    if (state.seenDriverMappingVehicleKeys.has(vehicleKey)) {
      addDuplicate(result, item.rowNumber, "vehicleNumber", "Duplicate vehicleNumber in file for driver mapping", item.raw);
      continue;
    }

    if (state.seenDriverMappingDriverKeys.has(driverKey)) {
      addDuplicate(result, item.rowNumber, "driverEmail", "Duplicate driverEmail in file for driver mapping", item.raw);
      continue;
    }

    state.seenDriverMappingVehicleKeys.add(vehicleKey);
    state.seenDriverMappingDriverKeys.add(driverKey);
    dedupedRows.push(item);
  }

  if (dedupedRows.length === 0) return;

  const orgIds = [...new Set(dedupedRows.map((item) => item.data.organizationId))];
  const vehicleNumbers = [...new Set(dedupedRows.map((item) => item.data.vehicleNumber).filter(Boolean))];
  const driverEmails = [...new Set(dedupedRows.map((item) => item.data.driverEmail).filter(Boolean))];

  const vehicles = await Vehicle.find({
    organizationId: { $in: orgIds },
    vehicleNumber: { $in: vehicleNumbers },
  }).select("_id organizationId vehicleNumber driverId").lean();

  const drivers = await Driver.find({
    organizationId: { $in: orgIds },
    email: { $in: driverEmails },
  }).select("_id organizationId email firstName lastName licenseNumber assignedVehicleId status").lean();

  const vehicleByKey = new Map(
    vehicles.map((vehicle) => [`${vehicle.organizationId}:${vehicle.vehicleNumber}`, vehicle]),
  );
  const driverByKey = new Map(
    drivers.map((driver) => [`${driver.organizationId}:${driver.email}`, driver]),
  );

  const activeMappings = await VehicleDriverMapping.find({
    unassignedAt: null,
    status: "assigned",
    $or: [
      { vehicleId: { $in: vehicles.map((vehicle) => vehicle._id) } },
      { driverId: { $in: drivers.map((driver) => driver._id) } },
    ],
  }).select("vehicleId driverId").lean();

  const activeVehicleIds = new Set(activeMappings.map((mapping) => String(mapping.vehicleId)));
  const activeDriverIds = new Set(activeMappings.map((mapping) => String(mapping.driverId)));

  const preparedRows = [];
  for (const item of dedupedRows) {
    const row = item.data;
    const vehicle = vehicleByKey.get(`${row.organizationId}:${row.vehicleNumber}`);
    if (!vehicle) {
      addError(result, item.rowNumber, "vehicleNumber", "vehicleNumber not found in selected organization", item.raw);
      continue;
    }

    const driver = driverByKey.get(`${row.organizationId}:${row.driverEmail}`);
    if (!driver) {
      addError(result, item.rowNumber, "driverEmail", "driverEmail not found in selected organization", item.raw);
      continue;
    }

    if (driver.status !== "active") {
      addError(result, item.rowNumber, "driverEmail", "Only active drivers can be mapped", item.raw);
      continue;
    }

    if (vehicle.driverId || activeVehicleIds.has(String(vehicle._id))) {
      addDuplicate(result, item.rowNumber, "vehicleNumber", "Vehicle already has an active driver mapping", item.raw);
      continue;
    }

    if (driver.assignedVehicleId || activeDriverIds.has(String(driver._id))) {
      addDuplicate(result, item.rowNumber, "driverEmail", "Driver already has an active vehicle mapping", item.raw);
      continue;
    }

    activeVehicleIds.add(String(vehicle._id));
    activeDriverIds.add(String(driver._id));
    preparedRows.push({ item, vehicle, driver });
  }

  if (preparedRows.length === 0) return;

  const now = new Date();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await VehicleDriverMapping.insertMany(
        preparedRows.map(({ vehicle, driver }) => ({
          organizationId: vehicle.organizationId,
          vehicleId: vehicle._id,
          driverId: driver._id,
          assignedAt: now,
          unassignedAt: null,
          status: "assigned",
        })),
        { ordered: false, session },
      );

      await Vehicle.bulkWrite(
        preparedRows.map(({ vehicle, driver }) => ({
          updateOne: {
            filter: { _id: vehicle._id },
            update: { $set: { driverId: driver._id } },
          },
        })),
        { session },
      );

      await Driver.bulkWrite(
        preparedRows.map(({ vehicle, driver }) => ({
          updateOne: {
            filter: { _id: driver._id },
            update: { $set: { assignedVehicleId: vehicle._id } },
          },
        })),
        { session },
      );
    });

    result.successfulRows += preparedRows.length;
    result.summary.inserted += preparedRows.length;
  } catch (error) {
    if (error?.code === 11000 || error?.writeErrors?.length) {
      addChunkFailure(
        result,
        preparedRows.map((entry) => entry.item),
        "driverMapping",
        "Duplicate active driver mapping conflict",
      );
      return;
    }

    addChunkFailure(
      result,
      preparedRows.map((entry) => entry.item),
      "driverMapping",
      error?.message || "Driver mapping import failed",
    );
  } finally {
    await session.endSession();
  }
}

async function processChunk(entity, rows, req, context, result, state, options) {
  const normalizedRows = await normalizeChunkRows(entity, rows, req, context, result, options);
  if (normalizedRows.length === 0) return;

  if (entity === "organizations") {
    await processOrganizationsChunk(normalizedRows, req, context, result, state);
    return;
  }
  if (entity === "users") {
    await processUsersChunk(normalizedRows, req, result);
    return;
  }
  if (entity === "devices") {
    await processDevicesChunk(normalizedRows, req, result, state);
    return;
  }
  if (entity === "drivers") {
    await processDriversChunk(normalizedRows, req, result, state);
    return;
  }
  if (entity === "vehicles") {
    await processVehiclesChunk(normalizedRows, req, result, state);
    return;
  }
  if (entity === "devicemapping") {
    await processDeviceMappingsChunk(normalizedRows, req, result, state);
    return;
  }
  if (entity === "drivermapping") {
    await processDriverMappingsChunk(normalizedRows, req, result, state);
    return;
  }
  throw { status: 400, message: "Unsupported import entity" };
}

module.exports = {
  processChunk,
};
