const jwt = require("jsonwebtoken");
const User = require("../Modules/users/model");

const JWT_SECRET = process.env.JWT_SECRET;

console.log("VERIFY SECRET:", JWT_SECRET);

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 🔥 STEP 1: Check header + Bearer
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized: Token missing or malformed",
      });
    }

    // 🔥 STEP 2: Extract actual token
    const token = authHeader.split(" ")[1];

    // 🔥 STEP 3: Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 🔥 STEP 4: Find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized: User not found",
      });
    }

    if (user.status && user.status !== "active") {
      return res.status(403).json({
        status: false,
        message: "Forbidden: User is inactive",
      });
    }

    // 🔥 STEP 5: Attach clean user object
    req.user = {
      _id: user._id,
      role: user.role,
      organizationId: user.organizationId || null,
      assignedVehicleId: user.assignedVehicleId || null,
    };

    next();
  } catch (error) {
    console.error("JWT Error:", error.message);

    return res.status(401).json({
      status: false,
      message: "Unauthorized: Invalid or expired token",
    });
  }
};

module.exports = requireAuth;
