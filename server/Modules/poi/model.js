const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// POI SCHEMA
//
// locationCoordinates stores as a legacy coordinate pair [longitude, latitude].
// MongoDB 2dsphere index supports this format directly — no GeoJSON wrapper needed.
// Longitude FIRST (GeoJSON convention), Latitude SECOND.
//
// Example valid value: [76.7794, 30.7333]  ← Chandigarh
// ─────────────────────────────────────────────────────────────────────────────
const poiSchema = {
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: {
    type: String,
    default: "",
  },

  // Category: "depot", "warehouse", "fuel_station", "toll", "customer_site", etc.
  type: {
    type: String,
    required: true,
    trim: true,
  },

  // Optional sub-classification: "Point", "Zone", etc.
  locationType: {
    type: String,
    default: "Point",
  },

  // ⚠️ MUST be [longitude, latitude] — longitude first (GeoJSON + 2dsphere convention)
  // Validated at application layer in controller before saving.
  locationCoordinates: {
    type: [Number],       // Array of exactly 2 numbers
    required: true,
    validate: {
      validator: function (coords) {
        if (!Array.isArray(coords) || coords.length !== 2) return false;
        const [lng, lat] = coords;
        return (
          typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180 &&
          typeof lat === "number" && Number.isFinite(lat) && lat >= -90  && lat <= 90
        );
      },
      message:
        "locationCoordinates must be [longitude, latitude] with valid ranges " +
        "(lng: -180 to 180, lat: -90 to 90)",
    },
  },

  // Match radius in meters. Used in enrichment to override DEFAULT_POI_SEARCH_RADIUS_METERS.
  // Production recommendation: set per-POI. Depot/warehouse = 200m. City landmark = 500m.
  radius: {
    type: Number,
    default: 1000,          // matches DEFAULT_POI_SEARCH_RADIUS_METERS in locationEnrichment.js
    min: 50,
    max: 50000,
  },

  tags: {
    type: [String],
    default: [],
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
};

const instance = new ajModel("POI", poiSchema);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
//
// 1. Compound 2dsphere: enables fast $nearSphere queries scoped per org.
//    This is the PRIMARY query path in queryNearestPoi().
//    Without this, every GPS packet falls back to 200-document scan.
//
// 2. { organizationId, isActive }: speeds up getAll() and nearby() filters.
//
// Run this once in production to ensure indexes exist:
//   node -e "require('./server/Modules/poi/model')" 
//   (ajModel likely calls ensureIndexes on load)
// ─────────────────────────────────────────────────────────────────────────────
instance.index({ organizationId: 1, locationCoordinates: "2dsphere" });
instance.index({ organizationId: 1, isActive: 1 });

module.exports = instance.getModel();