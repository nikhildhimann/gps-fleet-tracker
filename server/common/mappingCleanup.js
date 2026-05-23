const VehicleMapping = require("../Modules/deviceMapping/model");
const VehicleDriverMapping = require("../Modules/vehicleDriverMapping/model");
const Vehicle = require("../Modules/vehicle/model");
const GpsDevice = require("../Modules/gpsDevice/model");
const Driver = require("../Modules/drivers/model");
const User = require("../Modules/users/model");
const { syncInventoryStatus } = require("../Modules/gpsDevice/service");

const buildOptions = (session) => (session ? { session } : {});

const softUnassignDeviceMappings = async (filter, session) => {
  const activeMappings = await VehicleMapping.find({
    ...filter,
    unassignedAt: null,
  })
    .select("vehicleId gpsDeviceId")
    .session(session);

  if (!activeMappings.length) {
    return { vehicleIds: [], deviceIds: [] };
  }

  const now = new Date();
  const vehicleIds = activeMappings.map((item) => item.vehicleId).filter(Boolean);
  const deviceIds = activeMappings.map((item) => item.gpsDeviceId).filter(Boolean);

  await VehicleMapping.updateMany(
    {
      _id: { $in: activeMappings.map((item) => item._id) },
    },
    { $set: { unassignedAt: now } },
    buildOptions(session),
  );

  if (vehicleIds.length) {
    await Vehicle.updateMany(
      { _id: { $in: vehicleIds } },
      { $set: { deviceId: null, deviceImei: null } },
      buildOptions(session),
    );
  }

  if (deviceIds.length) {
    await GpsDevice.updateMany(
      { _id: { $in: deviceIds } },
      { $set: { vehicleId: null, vehicleRegistrationNumber: "" } },
      buildOptions(session),
    );

    await Promise.all(
      deviceIds.map((deviceId) => syncInventoryStatus(deviceId, "in_stock", { session })),
    );
  }

  return { vehicleIds, deviceIds };
};

const softUnassignDriverMappings = async (filter, session) => {
  const activeMappings = await VehicleDriverMapping.find({
    ...filter,
    unassignedAt: null,
  })
    .select("vehicleId driverId")
    .session(session);

  if (!activeMappings.length) {
    return { vehicleIds: [], driverIds: [] };
  }

  const now = new Date();
  const vehicleIds = activeMappings.map((item) => item.vehicleId).filter(Boolean);
  const driverIds = activeMappings.map((item) => item.driverId).filter(Boolean);

  await VehicleDriverMapping.updateMany(
    { _id: { $in: activeMappings.map((item) => item._id) } },
    { $set: { unassignedAt: now, status: "unassigned" } },
    buildOptions(session),
  );

  if (vehicleIds.length) {
    await Vehicle.updateMany(
      { _id: { $in: vehicleIds } },
      { $set: { driverId: null } },
      buildOptions(session),
    );
  }

  if (driverIds.length) {
    await Driver.updateMany(
      { _id: { $in: driverIds } },
      { $set: { assignedVehicleId: null } },
      buildOptions(session),
    );

    await User.updateMany(
      { driverId: { $in: driverIds } },
      { $set: { assignedVehicleId: null } },
      buildOptions(session),
    );
  }

  return { vehicleIds, driverIds };
};

const cleanupForGpsDeviceDeletion = async (device, session) => {
  await softUnassignDeviceMappings({ gpsDeviceId: device._id }, session);

  await Vehicle.updateMany(
    {
      $or: [{ deviceId: device._id }, { deviceImei: device.imei }],
    },
    { $set: { deviceId: null, deviceImei: null } },
    buildOptions(session),
  );
};

const cleanupForDriverDeletion = async (driver, session) => {
  await softUnassignDriverMappings({ driverId: driver._id }, session);

  await Vehicle.updateMany(
    { driverId: driver._id },
    { $set: { driverId: null } },
    buildOptions(session),
  );

  await User.updateMany(
    { driverId: driver._id },
    { $set: { driverId: null, assignedVehicleId: null } },
    buildOptions(session),
  );
};

const cleanupForVehicleDeletion = async (vehicle, session) => {
  await softUnassignDeviceMappings({ vehicleId: vehicle._id }, session);
  await softUnassignDriverMappings({ vehicleId: vehicle._id }, session);

  const linkedDevices = await GpsDevice.find({
    $or: [{ vehicleId: vehicle._id }, { vehicleRegistrationNumber: vehicle.vehicleNumber }],
  })
    .select("_id")
    .session(session);

  await GpsDevice.updateMany(
    {
      $or: [{ vehicleId: vehicle._id }, { vehicleRegistrationNumber: vehicle.vehicleNumber }],
    },
    { $set: { vehicleId: null, vehicleRegistrationNumber: "" } },
    buildOptions(session),
  );

  await Promise.all(
    linkedDevices.map((device) => syncInventoryStatus(device._id, "in_stock", { session })),
  );

  await Driver.updateMany(
    { assignedVehicleId: vehicle._id },
    { $set: { assignedVehicleId: null } },
    buildOptions(session),
  );

  await User.updateMany(
    { assignedVehicleId: vehicle._id },
    { $set: { assignedVehicleId: null } },
    buildOptions(session),
  );
};

module.exports = {
  cleanupForGpsDeviceDeletion,
  cleanupForDriverDeletion,
  cleanupForVehicleDeletion,
};
