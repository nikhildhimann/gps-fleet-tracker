const HealthMonitoring = require("./model");

const HealthMonitoringController = {
  /**
   * Get latest health packets list (one latest entry per vehicle/device/imei)
   * ORG SAFE
   */
  getLatestList: async (req, res) => {
    try {
      const { orgScope } = req;
      const { vehicleId, imei, limit = 100 } = req.query;

      const maxRows = Math.max(1, Math.min(Number(limit) || 100, 500));
      const query = {};
      // 🔐 ORG SCOPE FIX
      if (req.user.role !== "superadmin" && orgScope !== "ALL") {
        query.organizationId = { $in: orgScope };
      }
      if (vehicleId) query.vehicleId = vehicleId;
      if (imei) query.imei = imei;

      // Read a larger sorted window and dedupe in memory to keep latest snapshot per key.
      const scanLimit = Math.max(maxRows * 10, 200);
      const rows = await HealthMonitoring.find(query)
        .sort({ timestamp: -1 })
        .limit(scanLimit)
        .populate("vehicleId", "vehicleNumber")
        .populate("gpsDeviceId", "imei vehicleRegistrationNumber")
        .lean();

      const seen = new Set();
      const latest = [];

      for (const row of rows) {
        const key =
          (row.vehicleId && row.vehicleId._id && row.vehicleId._id.toString()) ||
          (row.gpsDeviceId && row.gpsDeviceId._id && row.gpsDeviceId._id.toString()) ||
          row.imei;

        if (!key || seen.has(key)) continue;
        seen.add(key);
        latest.push(row);
        if (latest.length >= maxRows) break;
      }

      return res.json({
        status: true,
        count: latest.length,
        data: latest,
      });
    } catch (error) {
      console.error("Health getLatestList error:", error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  },

  /**
   * Get latest health by IMEI (ORG SAFE)
   */
  getLatestByImei: async (req, res) => {
    try {
      const { imei } = req.params;
      const { orgScope } = req;

      const orgFilter =
        orgScope === "ALL" ? {} : { organizationId: { $in: orgScope } };

      const data = await HealthMonitoring.findOne({
        imei,
        ...orgFilter,
      })
        .sort({ timestamp: -1 })
        .lean();

      if (!data) {
        return res.status(404).json({
          status: false,
          message: "Health data not found for this IMEI",
        });
      }

      return res.json({
        status: true,
        data,
      });
    } catch (error) {
      console.error("Health getLatestByImei error:", error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  },

  /**
   * Get health history by IMEI (ORG SAFE)
   */
  getHistoryByImei: async (req, res) => {
    try {
      const { imei } = req.params;
      const { from, to, limit = 100 } = req.query;
      const { orgScope } = req;

      const query = { imei };

      if (orgScope !== "ALL") {
        query.organizationId = { $in: orgScope };
      }

      if (from || to) {
        query.timestamp = {};
        if (from) query.timestamp.$gte = new Date(from);
        if (to) query.timestamp.$lte = new Date(to);
      }

      const data = await HealthMonitoring.find(query)
        .sort({ timestamp: -1 })
        .limit(Number(limit))
        .lean();

      return res.json({
        status: true,
        count: data.length,
        data,
      });
    } catch (error) {
      console.error("Health getHistoryByImei error:", error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  },

  /**
   * Get latest health by Vehicle (ORG SAFE)
   */
  getLatestByVehicle: async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const { orgScope } = req;

      const query = { vehicleId };

      if (orgScope !== "ALL") {
        query.organizationId = { $in: orgScope };
      }

      const data = await HealthMonitoring.findOne(query)
        .sort({ timestamp: -1 })
        .lean();

      if (!data) {
        return res.status(404).json({
          status: false,
          message: "Health data not found for this vehicle",
        });
      }

      return res.json({
        status: true,
        data,
      });
    } catch (error) {
      console.error("Health getLatestByVehicle error:", error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  },

  /**
   * Get health history by Vehicle (ORG SAFE)
   */
  getHistoryByVehicle: async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const { from, to, limit = 200 } = req.query;
      const { orgScope } = req;

      const query = { vehicleId };

      if (orgScope !== "ALL") {
        query.organizationId = { $in: orgScope };
      }

      if (from || to) {
        query.timestamp = {};
        if (from) query.timestamp.$gte = new Date(from);
        if (to) query.timestamp.$lte = new Date(to);
      }

      const data = await HealthMonitoring.find(query)
        .sort({ timestamp: -1 })
        .limit(Math.max(1, Math.min(Number(limit) || 200, 2000)))
        .lean();

      return res.json({
        status: true,
        count: data.length,
        data,
      });
    } catch (error) {
      console.error("Health getHistoryByVehicle error:", error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  },
};

module.exports = HealthMonitoringController;
