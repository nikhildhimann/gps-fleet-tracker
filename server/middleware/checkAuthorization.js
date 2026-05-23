const fs = require("fs");
const path = require("path");

const loadPermissions = () => {
  try {
    const filePath = path.join(__dirname, "../config/permissions.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load permissions.json:", err);
    return {};
  }
};

// HTTP method → action mapping
const methodToAction = {
  POST: "create",
  GET: "read",
  PUT: "update",
  DELETE: "delete",
  PATCH: "update"
};

// Extract module name from URL: /api/<module>/...
const extractModuleFromUrl = (url) => {
  const parts = url.split("/").filter(Boolean);
  const apiIndex = parts.indexOf("api");
  return apiIndex !== -1 && parts[apiIndex + 1]
    ? parts[apiIndex + 1]
    : null;
};

const checkAuthorization = (
  allowedRoles = [],
  module = null,
  customAction = null
) => {
  return (req, res, next) => {
    try {
      const user = req.user;

      // 1️⃣ User must be authenticated
      if (!user || !user.role) {
        return res.status(401).json({
          status: false,
          message: "Unauthorized: No user context found",
        });
      }

      const userRole = user.role;

      // 2️⃣ Role-level access (route-level)
      allowedRoles = Array.isArray(allowedRoles)
        ? allowedRoles
        : [allowedRoles];

      // Superadmin always allowed
      if (
        allowedRoles.length > 0 &&
        userRole !== "superadmin" &&
        !allowedRoles.includes(userRole)
      ) {
        return res.status(403).json({
          status: false,
          message: "Forbidden: Role not allowed for this route",
        });
      }

      // 3️⃣ Resolve module & action
      const resolvedModule =
        module || extractModuleFromUrl(req.originalUrl);

      const resolvedAction =
        customAction || methodToAction[req.method];

      if (!resolvedModule || !resolvedAction) {
        return res.status(403).json({
          status: false,
          message: "Forbidden: Unable to resolve permission context",
        });
      }

      // Superadmin always allowed
      if (userRole === "superadmin") {
        return next();
      }

      // 4️⃣ Permission check from permissions.json
      const permissions = loadPermissions();
      const rolePermissions = permissions[userRole]?.modules;

      if (!rolePermissions) {
        return res.status(403).json({
          status: false,
          message: `Forbidden: ${userRole} has no permissions defined`,
        });
      }

      // Find the module key in a case-insensitive way
      const moduleKey = Object.keys(rolePermissions).find(
        (key) => key.toLowerCase() === resolvedModule.toLowerCase()
      );

      if (
        !moduleKey ||
        !Array.isArray(rolePermissions[moduleKey]) ||
        !rolePermissions[moduleKey].includes(resolvedAction)
      ) {
        return res.status(403).json({
          status: false,
          message: `Forbidden: ${userRole} cannot ${resolvedAction} ${resolvedModule}`,
        });
      }

      // ✅ Permission passed
      next();
    } catch (err) {
      console.error("Authorization Error:", err);
      return res.status(500).json({
        status: false,
        message: "Internal authorization error",
      });
    }
  };
};

module.exports = checkAuthorization;
