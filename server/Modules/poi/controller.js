const POI = require("./model");
const Validator = require("../../helpers/validators");
const paginate = require("../../helpers/limitoffset");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — must match locationEnrichment.js defaults
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_POI_RADIUS_METERS = Number(
  process.env.LOCATION_POI_MAX_DISTANCE_METERS || 1000,
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const validatePOIData = async (data) => {
  const rules = {
    organizationId: "required",
    name: "required",
    type: "required",
  };
  const validator = new Validator(data, rules);
  await validator.validate();
};

/**
 * Resolve organizationId from request based on role.
 * Centralised so all handlers use consistent logic.
 */
function resolveOrgId(req) {
  if (req.user.role === "superadmin") {
    return req.body.organizationId || req.orgId || null;
  }

  if (
    req.body.organizationId &&
    req.orgScope !== "ALL" &&
    req.orgScope.some(
      (id) => id.toString() === req.body.organizationId.toString(),
    )
  ) {
    return req.body.organizationId;
  }

  return req.orgId || null;
}

/**
 * Build org scope filter for read operations.
 */
function orgScopeFilter(req) {
  if (req.user.role === "superadmin" || req.orgScope === "ALL") return {};
  return { organizationId: { $in: req.orgScope } };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE — single POI
// ─────────────────────────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    await validatePOIData(req.body);

    const organizationId = resolveOrgId(req);
    if (!organizationId) {
      return res.status(400).json({ status: false, message: "organizationId is required" });
    }

    // Validate coordinates before hitting Mongoose schema validator
    const { name, description, type, locationType, locationCoordinates, radius, tags } =
      req.body;

    if (
      !Array.isArray(locationCoordinates) ||
      locationCoordinates.length !== 2 ||
      !Number.isFinite(Number(locationCoordinates[0])) ||
      !Number.isFinite(Number(locationCoordinates[1]))
    ) {
      return res.status(400).json({
        status: false,
        message:
          "locationCoordinates must be [longitude, latitude] — e.g. [76.7794, 30.7333]",
      });
    }

    // Normalise to numbers (frontend may send strings)
    const coords = [Number(locationCoordinates[0]), Number(locationCoordinates[1])];

    const poi = await POI.create({
      organizationId,
      name: name.trim(),
      description: description || "",
      type,
      locationType: locationType || "Point",
      locationCoordinates: coords,
      radius: Number(radius) || DEFAULT_POI_RADIUS_METERS,  // ← consistent default
      tags: tags || [],
      isActive: true,
    });

    return res.status(201).json({ status: true, message: "POI created", data: poi });
  } catch (error) {
    console.error("Create POI error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BULK CREATE — seed multiple org-specific POIs in one request
// POST /pois/bulk
//
// Body: { organizationId, pois: [{ name, type, locationCoordinates, radius? }] }
//
// Production use: seed depots, warehouses, fuel stations, toll gates for an org.
// ─────────────────────────────────────────────────────────────────────────────
exports.bulkCreate = async (req, res) => {
  try {
    const organizationId = resolveOrgId(req);
    if (!organizationId) {
      return res.status(400).json({ status: false, message: "organizationId is required" });
    }

    const { pois } = req.body;
    if (!Array.isArray(pois) || pois.length === 0) {
      return res.status(400).json({ status: false, message: "pois array is required and must not be empty" });
    }

    if (pois.length > 500) {
      return res.status(400).json({ status: false, message: "Maximum 500 POIs per bulk request" });
    }

    const errors = [];
    const validDocs = [];

    pois.forEach((poi, index) => {
      const { name, type, locationCoordinates, radius, description, tags } = poi;

      if (!name || !type) {
        errors.push({ index, reason: "name and type are required" });
        return;
      }

      if (
        !Array.isArray(locationCoordinates) ||
        locationCoordinates.length !== 2 ||
        !Number.isFinite(Number(locationCoordinates[0])) ||
        !Number.isFinite(Number(locationCoordinates[1]))
      ) {
        errors.push({ index, reason: "locationCoordinates must be [longitude, latitude]" });
        return;
      }

      validDocs.push({
        organizationId,
        name: String(name).trim(),
        description: description || "",
        type: String(type).trim(),
        locationType: "Point",
        locationCoordinates: [Number(locationCoordinates[0]), Number(locationCoordinates[1])],
        radius: Number(radius) || DEFAULT_POI_RADIUS_METERS,
        tags: Array.isArray(tags) ? tags : [],
        isActive: true,
      });
    });

    let inserted = [];
    if (validDocs.length > 0) {
      // ordered: false → continues on partial duplicates
      inserted = await POI.insertMany(validDocs, { ordered: false }).catch((err) => {
        // insertMany with ordered:false throws on partial failure but still inserts valid ones
        if (err.insertedDocs) return err.insertedDocs;
        throw err;
      });
    }

    return res.status(201).json({
      status: true,
      message: `${inserted.length} POIs created, ${errors.length} skipped`,
      inserted: inserted.length,
      skipped: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Bulk create POI error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NEARBY — test/debug endpoint to verify POI lookup for any coordinate
// GET /pois/nearby?lat=30.7333&lng=76.7794&radius=1000
//
// This is what you use to debug "why is POI blank for vehicle X".
// Also useful for frontend map to show POIs near a point.
// ─────────────────────────────────────────────────────────────────────────────
exports.nearby = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius) || DEFAULT_POI_RADIUS_METERS;
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        status: false,
        message: "lat and lng query params are required and must be valid numbers",
      });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        status: false,
        message: "lat must be -90 to 90, lng must be -180 to 180",
      });
    }

    const scopeFilter = orgScopeFilter(req);

    let pois;
    try {
      // Primary: geospatial index query
      pois = await POI.find({
        ...scopeFilter,
        isActive: true,
        locationCoordinates: {
          $nearSphere: {
            $geometry: { type: "Point", coordinates: [lng, lat] },
            $maxDistance: radius,
          },
        },
      })
        .select("name type radius locationCoordinates organizationId description")
        .limit(limit)
        .lean();
    } catch (geoError) {
      // 2dsphere index may not exist yet — surface the error clearly
      return res.status(500).json({
        status: false,
        message: "Geospatial query failed — ensure 2dsphere index exists on locationCoordinates",
        error: geoError.message,
        fix: "Run: db.pois.createIndex({ organizationId: 1, locationCoordinates: '2dsphere' })",
      });
    }

    return res.status(200).json({
      status: true,
      query: { lat, lng, radius, scopeFilter },
      count: pois.length,
      data: pois,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INDEX STATUS — verify 2dsphere index exists
// GET /pois/index-status
//
// Use this to confirm DB is production-ready before going live.
// ─────────────────────────────────────────────────────────────────────────────
exports.indexStatus = async (req, res) => {
  try {
    // Only superadmin should access this
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ status: false, message: "Superadmin only" });
    }

    const indexes = await POI.collection.indexes();
    const has2dsphere = indexes.some((idx) => {
      const keys = Object.values(idx.key || {});
      return keys.includes("2dsphere");
    });

    const totalCount = await POI.countDocuments();

    // Count per org (useful to verify seed ran correctly)
    const orgCounts = await POI.aggregate([
      { $group: { _id: "$organizationId", count: { $sum: 1 } } },
      { $limit: 20 },
    ]);

    return res.status(200).json({
      status: true,
      has2dsphereIndex: has2dsphere,
      totalPOIs: totalCount,
      indexList: indexes.map((i) => ({ name: i.name, key: i.key })),
      orgBreakdown: orgCounts,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL — paginated list
// ─────────────────────────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { page, limit, search, type } = req.query;

    const filter = { ...orgScopeFilter(req) };
    if (type) filter.type = type;

    const result = await paginate(
      POI,
      filter,
      page,
      limit,
      ["organizationId"],
      ["name", "type", "description"],
      search,
    );

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET BY ID
// ─────────────────────────────────────────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const poi = await POI.findOne({ _id: req.params.id, ...orgScopeFilter(req) }).populate(
      "organizationId",
    );

    if (!poi) {
      return res.status(404).json({ status: false, message: "POI not found or access denied" });
    }

    return res.status(200).json({ status: true, data: poi });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const poi = await POI.findOne({ _id: req.params.id, ...orgScopeFilter(req) });
    if (!poi) {
      return res.status(404).json({ status: false, message: "POI not found or access denied" });
    }

    // If coordinates are being updated, validate them
    if (req.body.locationCoordinates !== undefined) {
      const coords = req.body.locationCoordinates;
      if (
        !Array.isArray(coords) ||
        coords.length !== 2 ||
        !Number.isFinite(Number(coords[0])) ||
        !Number.isFinite(Number(coords[1]))
      ) {
        return res.status(400).json({
          status: false,
          message: "locationCoordinates must be [longitude, latitude]",
        });
      }
      req.body.locationCoordinates = [Number(coords[0]), Number(coords[1])];
    }

    const updated = await POI.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate(
      "organizationId",
    );

    return res.status(200).json({ status: true, message: "Updated successfully", data: updated });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE (soft preferred — sets isActive: false)
// ─────────────────────────────────────────────────────────────────────────────
exports.delete = async (req, res) => {
  try {
    const poi = await POI.findOne({ _id: req.params.id, ...orgScopeFilter(req) });
    if (!poi) {
      return res.status(404).json({ status: false, message: "POI not found or access denied" });
    }

    await poi.deleteOne();
    return res.status(200).json({ status: true, message: "Deleted successfully" });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};