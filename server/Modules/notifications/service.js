const mongoose = require("mongoose");
const Notification = require("./model");

const ALLOWED_TYPES = ["alert", "device_health", "mapping", "import", "admin", "system"];
const ALLOWED_SEVERITIES = ["critical", "warning", "info", "success"];
const ALLOWED_STATUSES = ["new", "acknowledged", "resolved"];

const POPULATE_FIELDS = [
  { path: "organizationId", select: "name organizationType status" },
  { path: "createdBy", select: "firstName lastName email role" },
  { path: "vehicleId", select: "vehicleNumber vehicleType model status runningStatus" },
  { path: "deviceId", select: "imei deviceModel simNumber status connectionStatus" },
  { path: "driverId", select: "firstName lastName phone status" },
  { path: "userId", select: "firstName lastName email role" },
  { path: "alertId", select: "alertName alertId severity vehicleRegistrationNumber acknowledged" },
  { path: "acknowledgedBy", select: "firstName lastName email role" },
  { path: "resolvedBy", select: "firstName lastName email role" },
];

const normalizeContext = (context = {}) => ({
  user: context.user || null,
  orgScope: context.orgScope ?? (context.user?.role === "superadmin" ? "ALL" : []),
});

const isValidObjectId = (value) =>
  typeof value === "string" && mongoose.isValidObjectId(value);

const normalizeOptionalString = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeOptionalObjectId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && value._id) {
    return normalizeOptionalObjectId(String(value._id));
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed && mongoose.isValidObjectId(trimmed) ? trimmed : null;
};

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getOrgScopeIds = (context) => {
  if (context.orgScope === "ALL") {
    return "ALL";
  }

  if (!Array.isArray(context.orgScope)) {
    return [];
  }

  return context.orgScope
    .map((id) => String(id))
    .filter(Boolean);
};

const buildScopeCondition = (contextInput, requestedOrganizationId) => {
  const context = normalizeContext(contextInput);
  const normalizedOrganizationId = normalizeOptionalObjectId(requestedOrganizationId);

  if (context.orgScope === "ALL") {
    if (normalizedOrganizationId) {
      return { organizationId: new mongoose.Types.ObjectId(normalizedOrganizationId) };
    }

    return {};
  }

  const orgScopeIds = getOrgScopeIds(context);

  if (!orgScopeIds.length) {
    throw {
      status: 403,
      message: "Organization scope is not available for this user",
    };
  }

  if (normalizedOrganizationId) {
    if (!orgScopeIds.includes(normalizedOrganizationId)) {
      throw {
        status: 403,
        message: "Access denied for the selected organization",
      };
    }

    return { organizationId: new mongoose.Types.ObjectId(normalizedOrganizationId) };
  }

  return {
    $or: [
      { organizationId: { $in: orgScopeIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { organizationId: null },
    ],
  };
};

const buildSearchCondition = (search) => {
  const keyword = normalizeOptionalString(search);

  if (!keyword) {
    return null;
  }

  const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  return {
    $or: [{ title: { $regex: regex } }, { message: { $regex: regex } }],
  };
};

const buildDateRangeCondition = (dateFrom, dateTo) => {
  const from = normalizeDate(dateFrom);
  const to = normalizeDate(dateTo);

  if (!from && !to) {
    return null;
  }

  const condition = {};

  if (from) {
    condition.$gte = from;
  }

  if (to) {
    condition.$lte = to;
  }

  return { occurredAt: condition };
};

const buildQueryFilter = (context, params = {}) => {
  const conditions = [];
  conditions.push(buildScopeCondition(context, params.organizationId));

  if (params.type) {
    if (!ALLOWED_TYPES.includes(params.type)) {
      throw { status: 400, message: "Invalid notification type filter" };
    }
    conditions.push({ type: params.type });
  }

  if (params.severity) {
    if (!ALLOWED_SEVERITIES.includes(params.severity)) {
      throw { status: 400, message: "Invalid notification severity filter" };
    }
    conditions.push({ severity: params.severity });
  }

  if (params.status) {
    if (!ALLOWED_STATUSES.includes(params.status)) {
      throw { status: 400, message: "Invalid notification status filter" };
    }
    conditions.push({ status: params.status });
  }

  if (params.isRead === "true" || params.isRead === true) {
    conditions.push({ isRead: true });
  } else if (params.isRead === "false" || params.isRead === false) {
    conditions.push({ isRead: false });
  }

  const linkedIds = {
    vehicleId: normalizeOptionalObjectId(params.vehicleId),
    deviceId: normalizeOptionalObjectId(params.deviceId),
    driverId: normalizeOptionalObjectId(params.driverId),
    userId: normalizeOptionalObjectId(params.userId),
    alertId: normalizeOptionalObjectId(params.alertId),
  };

  Object.entries(linkedIds).forEach(([field, value]) => {
    if (value) {
      conditions.push({ [field]: new mongoose.Types.ObjectId(value) });
    }
  });

  if (params.entityType) {
    conditions.push({ entityType: normalizeOptionalString(params.entityType) });
  }

  if (params.entityId) {
    conditions.push({ entityId: normalizeOptionalString(params.entityId) });
  }

  if (params.importJobId) {
    conditions.push({ importJobId: normalizeOptionalString(params.importJobId) });
  }

  if (params.mappingId) {
    conditions.push({ mappingId: normalizeOptionalString(params.mappingId) });
  }

  const searchCondition = buildSearchCondition(params.search);
  if (searchCondition) {
    conditions.push(searchCondition);
  }

  const dateRangeCondition = buildDateRangeCondition(params.dateFrom, params.dateTo);
  if (dateRangeCondition) {
    conditions.push(dateRangeCondition);
  }

  if (!conditions.length) {
    return {};
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return { $and: conditions };
};

const populateNotificationQuery = (query) => {
  let populatedQuery = query;

  POPULATE_FIELDS.forEach((field) => {
    populatedQuery = populatedQuery.populate(field);
  });

  return populatedQuery;
};

const getNotificationByScopedId = async (context, notificationId) => {
  if (!isValidObjectId(notificationId)) {
    throw { status: 400, message: "Invalid notification ID" };
  }

  const filter = {
    $and: [
      { _id: new mongoose.Types.ObjectId(notificationId) },
      buildScopeCondition(context),
    ],
  };

  const notification = await populateNotificationQuery(
    Notification.findOne(filter)
  );

  if (!notification) {
    throw { status: 404, message: "Notification not found or access denied" };
  }

  return notification;
};

const applyReadState = (notification, userId) => {
  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
  }

  if (userId && !notification.acknowledgedBy && notification.status === "acknowledged") {
    notification.acknowledgedBy = userId;
  }
};

exports.createNotification = async (payload, contextInput = {}) => {
  const context = normalizeContext(contextInput);
  const requestedOrganizationId = normalizeOptionalObjectId(payload.organizationId);
  const initialStatus = payload.status || "new";
  const initialIsRead = Boolean(payload.isRead) || initialStatus !== "new";

  if (context.user?.role !== "superadmin" && !requestedOrganizationId && context.user?.organizationId) {
    payload.organizationId = context.user.organizationId;
  }

  buildScopeCondition(context, payload.organizationId || null);

  const notification = await Notification.create({
    title: payload.title.trim(),
    message: payload.message.trim(),
    type: payload.type || "system",
    severity: payload.severity || "info",
    status: initialStatus,
    isRead: initialIsRead,
    organizationId: normalizeOptionalObjectId(payload.organizationId),
    createdBy: context.user?._id || null,
    vehicleId: normalizeOptionalObjectId(payload.vehicleId),
    deviceId: normalizeOptionalObjectId(payload.deviceId),
    driverId: normalizeOptionalObjectId(payload.driverId),
    userId: normalizeOptionalObjectId(payload.userId),
    alertId: normalizeOptionalObjectId(payload.alertId),
    importJobId: normalizeOptionalString(payload.importJobId),
    mappingId: normalizeOptionalString(payload.mappingId),
    entityType: normalizeOptionalString(payload.entityType),
    entityId: normalizeOptionalString(payload.entityId),
    metadata:
      payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
        ? payload.metadata
        : {},
    actionUrl: normalizeOptionalString(payload.actionUrl),
    occurredAt: normalizeDate(payload.occurredAt) || new Date(),
    readAt: initialIsRead ? normalizeDate(payload.readAt) || new Date() : null,
    acknowledgedAt:
      initialStatus === "acknowledged" || initialStatus === "resolved"
        ? normalizeDate(payload.acknowledgedAt) || new Date()
        : null,
    resolvedAt: initialStatus === "resolved" ? normalizeDate(payload.resolvedAt) || new Date() : null,
    acknowledgedBy:
      initialStatus === "acknowledged" || initialStatus === "resolved"
        ? context.user?._id || normalizeOptionalObjectId(payload.acknowledgedBy)
        : normalizeOptionalObjectId(payload.acknowledgedBy),
    resolvedBy:
      initialStatus === "resolved"
        ? context.user?._id || normalizeOptionalObjectId(payload.resolvedBy)
        : normalizeOptionalObjectId(payload.resolvedBy),
  });

  return getNotificationByScopedId(context, notification._id);
};

exports.listNotifications = async (query, contextInput = {}) => {
  const context = normalizeContext(contextInput);
  const page = Math.max(parseInt(query.page, 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  const skip = page * limit;
  const filter = buildQueryFilter(context, query);

  const [data, totalrecords] = await Promise.all([
    populateNotificationQuery(
      Notification.find(filter)
        .sort({ occurredAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ),
    Notification.countDocuments(filter),
  ]);

  return {
    status: true,
    message: data.length ? "Notifications fetched successfully" : "No notifications found",
    data,
    pagination: {
      totalrecords,
      currentPage: page,
      totalPages: Math.ceil(totalrecords / limit),
      limit,
    },
  };
};

exports.getNotificationCounts = async (query, contextInput = {}) => {
  const context = normalizeContext(contextInput);
  const filter = buildQueryFilter(context, query);

  const [total, unread, newCount, acknowledged, resolved, bySeverity, byType] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ $and: [filter, { isRead: false }] }),
    Notification.countDocuments({ $and: [filter, { status: "new" }] }),
    Notification.countDocuments({ $and: [filter, { status: "acknowledged" }] }),
    Notification.countDocuments({ $and: [filter, { status: "resolved" }] }),
    Notification.aggregate([
      { $match: filter },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]),
    Notification.aggregate([
      { $match: filter },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);

  const severityCounts = ALLOWED_SEVERITIES.reduce((acc, severity) => {
    acc[severity] = 0;
    return acc;
  }, {});

  bySeverity.forEach((item) => {
    if (item._id) {
      severityCounts[item._id] = item.count;
    }
  });

  const typeCounts = ALLOWED_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {});

  byType.forEach((item) => {
    if (item._id) {
      typeCounts[item._id] = item.count;
    }
  });

  return {
    status: true,
    message: "Notification counts fetched successfully",
    data: {
      total,
      unread,
      new: newCount,
      acknowledged,
      resolved,
      bySeverity: severityCounts,
      byType: typeCounts,
    },
  };
};

exports.getNotificationById = async (notificationId, contextInput = {}) => {
  const context = normalizeContext(contextInput);
  return getNotificationByScopedId(context, notificationId);
};

exports.markAsRead = async (notificationId, contextInput = {}) => {
  const context = normalizeContext(contextInput);
  const notification = await getNotificationByScopedId(context, notificationId);

  if (notification.isRead) {
    return notification;
  }

  applyReadState(notification, context.user?._id);
  await notification.save();
  return getNotificationByScopedId(context, notification._id);
};

exports.markAsAcknowledged = async (notificationId, contextInput = {}) => {
  const context = normalizeContext(contextInput);
  const notification = await getNotificationByScopedId(context, notificationId);

  if (notification.status === "resolved") {
    throw { status: 400, message: "Resolved notifications cannot be acknowledged again" };
  }

  if (notification.status === "acknowledged") {
    applyReadState(notification, context.user?._id);
    await notification.save();
    return getNotificationByScopedId(context, notification._id);
  }

  applyReadState(notification, context.user?._id);
  notification.status = "acknowledged";
  notification.acknowledgedAt = new Date();
  notification.acknowledgedBy = context.user?._id || null;

  await notification.save();
  return getNotificationByScopedId(context, notification._id);
};

exports.markAsResolved = async (notificationId, contextInput = {}) => {
  const context = normalizeContext(contextInput);
  const notification = await getNotificationByScopedId(context, notificationId);

  if (notification.status === "resolved") {
    applyReadState(notification, context.user?._id);
    await notification.save();
    return getNotificationByScopedId(context, notification._id);
  }

  applyReadState(notification, context.user?._id);
  notification.status = "resolved";
  notification.resolvedAt = new Date();
  notification.resolvedBy = context.user?._id || null;

  if (!notification.acknowledgedAt) {
    notification.acknowledgedAt = new Date();
    notification.acknowledgedBy = context.user?._id || null;
  }

  await notification.save();
  return getNotificationByScopedId(context, notification._id);
};

exports.bulkMarkAsRead = async (query, contextInput = {}) => {
  const context = normalizeContext(contextInput);
  const filter = buildQueryFilter(context, { ...query, isRead: false });
  const now = new Date();

  const result = await Notification.updateMany(filter, {
    $set: {
      isRead: true,
      readAt: now,
    },
  });

  return {
    matchedCount: result.matchedCount ?? result.modifiedCount ?? 0,
    modifiedCount: result.modifiedCount ?? 0,
  };
};

exports.bulkMarkAsAcknowledged = async (query, contextInput = {}) => {
  const context = normalizeContext(contextInput);
  const filter = buildQueryFilter(context, { ...query, status: "new" });
  const now = new Date();

  const result = await Notification.updateMany(filter, {
    $set: {
      isRead: true,
      readAt: now,
      status: "acknowledged",
      acknowledgedAt: now,
      acknowledgedBy: context.user?._id || null,
    },
  });

  return {
    matchedCount: result.matchedCount ?? result.modifiedCount ?? 0,
    modifiedCount: result.modifiedCount ?? 0,
  };
};

exports.deleteNotification = async (notificationId, contextInput = {}) => {
  const context = normalizeContext(contextInput);
  const notification = await getNotificationByScopedId(context, notificationId);
  await notification.deleteOne();
  return notification;
};

exports.constants = {
  ALLOWED_TYPES,
  ALLOWED_SEVERITIES,
  ALLOWED_STATUSES,
};
