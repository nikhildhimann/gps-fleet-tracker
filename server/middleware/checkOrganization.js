const Organization = require("../Modules/organizations/model");

module.exports = async function checkOrganization(req, res, next) {
  try {
    const user = req.user;

    if (!user || !user.role) {
      return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    // ✅ superadmin → full access
    if (user.role === "superadmin") {
      req.orgScope = "ALL";
      return next();
    }

    if (!user.organizationId) {
      return res.status(403).json({
        status: false,
        message: "Organization context missing",
      });
    }

    req.orgId = user.organizationId;

    // 🔥 get current org path
    const currentOrg = await Organization.findById(user.organizationId)
      .select("path")
      .lean();

    if (!currentOrg) {
      return res.status(404).json({
        status: false,
        message: "User organization not found",
      });
    }

    // 🔥 find ALL descendants using path
    const regex = new RegExp(`^${currentOrg.path}(/|$)`);

    const orgs = await Organization.find({
      path: { $regex: regex },
    }).select("_id");

    req.orgScope = orgs.map((o) => o._id.toString());

    next();
  } catch (error) {
    console.error("checkOrganization error:", error);
    return res.status(500).json({
      status: false,
      message: "Organization validation failed",
    });
  }
};