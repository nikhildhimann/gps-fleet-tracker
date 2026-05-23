const Validator = require("../../helpers/validators");
const notificationService = require("./service");

const validateCreatePayload = async (data) => {
  const rules = {
    title: "required|string|max:200",
    message: "required|string|max:2000",
    type: "in:alert,device_health,mapping,import,admin,system",
    severity: "in:critical,warning,info,success",
    status: "in:new,acknowledged,resolved",
    organizationId: "string",
    vehicleId: "string",
    deviceId: "string",
    driverId: "string",
    userId: "string",
    alertId: "string",
    importJobId: "string",
    mappingId: "string",
    entityType: "string",
    entityId: "string",
    actionUrl: "string",
    occurredAt: "date",
    metadata: "object",
    isRead: "boolean",
  };

  const validator = new Validator(data, rules);
  await validator.validate();
};

const handleError = (res, error) => {
  if (error?.errors) {
    return res.status(error.status || 400).json({
      status: false,
      message: error.message || "Validation failed",
      errors: error.errors,
    });
  }

  return res.status(error.status || 500).json({
    status: false,
    message: error.message || "Internal server error",
  });
};

exports.create = async (req, res) => {
  try {
    await validateCreatePayload(req.body);
    const notification = await notificationService.createNotification(req.body, req);

    return res.status(201).json({
      status: true,
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getAll = async (req, res) => {
  try {
    const result = await notificationService.listNotifications(req.query, req);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getCounts = async (req, res) => {
  try {
    const result = await notificationService.getNotificationCounts(req.query, req);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getById = async (req, res) => {
  try {
    const notification = await notificationService.getNotificationById(req.params.id, req);
    return res.status(200).json({
      status: true,
      message: "Notification fetched successfully",
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req);
    return res.status(200).json({
      status: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.markAsAcknowledged = async (req, res) => {
  try {
    const notification = await notificationService.markAsAcknowledged(req.params.id, req);
    return res.status(200).json({
      status: true,
      message: "Notification acknowledged successfully",
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.markAsResolved = async (req, res) => {
  try {
    const notification = await notificationService.markAsResolved(req.params.id, req);
    return res.status(200).json({
      status: true,
      message: "Notification resolved successfully",
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.bulkMarkAsRead = async (req, res) => {
  try {
    const result = await notificationService.bulkMarkAsRead(req.body || {}, req);
    return res.status(200).json({
      status: true,
      message: "Notifications marked as read",
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.bulkMarkAsAcknowledged = async (req, res) => {
  try {
    const result = await notificationService.bulkMarkAsAcknowledged(req.body || {}, req);
    return res.status(200).json({
      status: true,
      message: "Notifications acknowledged successfully",
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.delete = async (req, res) => {
  try {
    await notificationService.deleteNotification(req.params.id, req);
    return res.status(200).json({
      status: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
