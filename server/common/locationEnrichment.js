/**
 * locationEnrichment.js — Production-Grade GPS Location Enrichment
 *
 * ARCHITECTURE:
 *   - Address enrichment : reverse geocode → Redis cache (7 day TTL)
 *   - POI enrichment     : MongoDB $nearSphere → Redis cache (15 min found / 2 min blank)
 *   - Both run in parallel via Promise.all per enrichment task
 *   - Enrichment is async / fire-and-forget from GPS packet path
 *   - Deduplication: same org+vehicle+cell → single enrichment task (no duplicate DB hits)
 *   - Concurrency: max N simultaneous enrichment tasks (configurable)
 *
 * KEY PRODUCTION RULES:
 *   1. POI lookup triggers only when vehicle enters a new dedupe cell (not every packet)
 *   2. Blank POI cached for 2 min only → picks up newly added POIs quickly
 *   3. Found POI cached for 15 min → reduces DB load for stable positions
 *   4. POI search radius: 1000m default (realistic operational distance)
 *   5. Fallback query is hard-limited to 100 docs + logged as warning
 */

const redisClient = require("../config/redis");
const { calculateDistance } = require("./utils");
const POI = require("../Modules/poi/model");
const GpsLiveData = require("../Modules/gpsLiveData/model");
const GpsHistory = require("../Modules/gpsHistory/model");
const Vehicle = require("../Modules/vehicle/model");
const { getIo } = require("../socket");

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION — all tunable via environment variables
// ─────────────────────────────────────────────────────────────────────────────

const ADDRESS_CACHE_TTL_SECONDS = Number(
  process.env.LOCATION_ADDRESS_CACHE_TTL_SECONDS || 60 * 60 * 24 * 7, // 7 days
);

// Found POI → cache 15 min (vehicle likely staying near same POI)
const POI_CACHE_TTL_SECONDS = Number(
  process.env.LOCATION_POI_CACHE_TTL_SECONDS || 60 * 15,
);

// FIX #1: Blank POI → cache only 2 min
// WHY: If org admin adds a new depot/warehouse, vehicles should see it within 2 min,
//      not have to wait 15 min for stale blank cache to expire.
const POI_BLANK_CACHE_TTL_SECONDS = Number(
  process.env.LOCATION_POI_BLANK_CACHE_TTL_SECONDS || 60 * 2,
);

const ADDRESS_CACHE_DECIMALS = Math.min(
  6,
  Math.max(
    3,
    Number(
      process.env.LOCATION_ADDRESS_CACHE_DECIMALS ||
        process.env.LOCATION_CACHE_DECIMALS ||
        4,
    ),
  ),
);

// FIX #2 (already correct in your code): 5 decimals ≈ 1.1m precision
// Do NOT lower to 3 (≈110m) — urban areas have multiple POIs within 110m
const POI_CACHE_DECIMALS = Math.min(
  6,
  Math.max(
    3,
    Number(
      process.env.LOCATION_POI_CACHE_DECIMALS ||
        process.env.LOCATION_CACHE_DECIMALS ||
        5,
    ),
  ),
);

// FIX #3 (already correct in your code): 1000m max radius
// Do NOT use 5km — "nearest within 5km" is operationally misleading
const DEFAULT_POI_SEARCH_RADIUS_METERS = Number(
  process.env.LOCATION_POI_MAX_DISTANCE_METERS || 1000,
);

const GEOCODER_TIMEOUT_MS = Number(
  process.env.LOCATION_GEOCODER_TIMEOUT_MS || 4000,
);

const MAX_CONCURRENT_ENRICHMENT = Number(
  process.env.MAX_CONCURRENT_LOCATION_ENRICHMENT || 10,
);

const VEHICLE_LOCATION_CHANGE_MIN_METERS = Number(
  process.env.VEHICLE_LOCATION_CHANGE_MIN_METERS || 50,
);

const VEHICLE_LOCATION_MIN_UPDATE_INTERVAL_SECONDS = Number(
  process.env.VEHICLE_LOCATION_MIN_UPDATE_INTERVAL_SECONDS || 30,
);

// FIX #4: Fallback scan limit — prevents loading entire org POI collection into memory
// If org has 10,000 POIs and $nearSphere fails, limit fallback scan to this number.
const POI_FALLBACK_SCAN_LIMIT = Number(
  process.env.LOCATION_POI_FALLBACK_SCAN_LIMIT || 100,
);

const GOOGLE_GEOCODING_API_KEY =
  process.env.GOOGLE_GEOCODING_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  "";
const REVERSE_GEOCODE_PROVIDER = (
  process.env.REVERSE_GEOCODE_PROVIDER ||
  (GOOGLE_GEOCODING_API_KEY ? "google" : "nominatim")
).toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY STATE — queue + deduplication
// ─────────────────────────────────────────────────────────────────────────────

const pendingAddressResolutions = new Map();
const pendingPoiResolutions = new Map();
const enrichmentQueue = [];
const pendingEnrichmentKeys = new Set();
let activeEnrichmentTasks = 0;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function roundCoordinate(value, decimals) {
  return Number(value).toFixed(decimals);
}

function buildCellKey(latitude, longitude, decimals) {
  return `${roundCoordinate(latitude, decimals)},${roundCoordinate(longitude, decimals)}`;
}

function buildAddressCacheKey(latitude, longitude) {
  return `location:address:${buildCellKey(latitude, longitude, ADDRESS_CACHE_DECIMALS)}`;
}

function buildPoiCacheKey(organizationId, latitude, longitude) {
  return `location:poi:${organizationId || "global"}:${buildCellKey(latitude, longitude, POI_CACHE_DECIMALS)}`;
}

/**
 * Enrichment dedupe key: org + vehicle + address-precision cell.
 *
 * Using ADDRESS_CACHE_DECIMALS (4 = ~11m cell) for deduplication, not
 * POI_CACHE_DECIMALS (5 = ~1.1m), because:
 *   - Both address AND poi run together per enrichment task
 *   - 11m cell is fine for deduplication — vehicle must move >11m to re-trigger
 *   - More aggressive dedup = fewer DB hits = better production throughput
 */
function buildEnrichmentDedupeKey(context) {
  if (!context) return null;

  const orgId =
    typeof context.organizationId === "object" && context.organizationId?._id
      ? context.organizationId._id
      : context.organizationId;
  const vehicleId =
    typeof context.vehicleId === "object" && context.vehicleId?._id
      ? context.vehicleId._id
      : context.vehicleId;
  const latitude = Number(context.latitude);
  const longitude = Number(context.longitude);

  if (
    !orgId ||
    !vehicleId ||
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude)
  ) {
    return null;
  }

  return `${orgId}:${vehicleId}:${buildCellKey(latitude, longitude, ADDRESS_CACHE_DECIMALS)}`;
}

function normalizeAddress(rawAddress) {
  if (!rawAddress || typeof rawAddress !== "string") return "";
  return rawAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function isCoordinateLikeAddress(value) {
  if (!value || typeof value !== "string") return false;
  return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(value.trim());
}

function normalizePoiText(value) {
  if (!value || typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized && !isCoordinateLikeAddress(normalized) ? normalized : "";
}

function findFirstPoiText(values = []) {
  for (const value of values) {
    const normalized = normalizePoiText(value);
    if (normalized) return normalized;
  }
  return "";
}

function deriveFallbackPoi(addressParts, formattedAddress) {
  const poiName = findFirstPoiText([
    addressParts?.road,
    addressParts?.suburb,
    addressParts?.neighbourhood,
    addressParts?.neighborhood,
    addressParts?.village,
    addressParts?.locality,
    addressParts?.city,
    addressParts?.town,
  ]);

  const fallbackName =
    poiName || findFirstPoiText([normalizeAddress(formattedAddress).split(",")[0]]);

  if (!fallbackName) return null;

  return {
    poiId: null,
    poiName: fallbackName,
    poiType: "fallback",
  };
}

function buildGeocodePayload(address, addressParts = {}) {
  const normalizedAddress = normalizeAddress(address);

  return {
    address:
      normalizedAddress && !isCoordinateLikeAddress(normalizedAddress)
        ? normalizedAddress
        : null,
    fallbackPoi: deriveFallbackPoi(addressParts, normalizedAddress),
  };
}

function getGoogleAddressComponent(addressComponents, acceptedTypes = []) {
  if (!Array.isArray(addressComponents) || acceptedTypes.length === 0) {
    return "";
  }

  for (const type of acceptedTypes) {
    const component = addressComponents.find((item) =>
      Array.isArray(item?.types) ? item.types.includes(type) : false,
    );
    const value = normalizePoiText(component?.long_name || component?.short_name);
    if (value) return value;
  }

  return "";
}

function normalizeCachedGeocodePayload(cached) {
  if (cached === null || typeof cached !== "object") return null;

  const address = normalizeAddress(cached.address || "");
  const fallbackPoiName = findFirstPoiText([
    cached?.fallbackPoi?.poiName,
    cached?.fallbackPoiName,
    address.split(",")[0],
  ]);

  return {
    address: address && !isCoordinateLikeAddress(address) ? address : null,
    fallbackPoi: fallbackPoiName
      ? {
          poiId: null,
          poiName: fallbackPoiName,
          poiType: "fallback",
        }
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REDIS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function readJsonCache(key) {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("Location cache read error:", error?.message || error);
    return null;
  }
}

async function writeJsonCache(key, ttlSeconds, value) {
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error("Location cache write error:", error?.message || error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REVERSE GEOCODING
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = GEOCODER_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Geocoder request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function reverseGeocodeWithGoogle(latitude, longitude) {
  if (!GOOGLE_GEOCODING_API_KEY) return null;

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    key: GOOGLE_GEOCODING_API_KEY,
  });

  const response = await fetchWithTimeout(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`Google geocoding failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  const result = data?.results?.[0];

  return buildGeocodePayload(result?.formatted_address, {
    road: getGoogleAddressComponent(result?.address_components, ["route"]),
    suburb: getGoogleAddressComponent(result?.address_components, [
      "sublocality_level_1",
      "sublocality",
      "sublocality_level_2",
    ]),
    neighbourhood: getGoogleAddressComponent(result?.address_components, [
      "neighborhood",
    ]),
    village: getGoogleAddressComponent(result?.address_components, [
      "administrative_area_level_4",
    ]),
    locality: getGoogleAddressComponent(result?.address_components, [
      "locality",
    ]),
    city: getGoogleAddressComponent(result?.address_components, [
      "postal_town",
      "administrative_area_level_2",
    ]),
    town: getGoogleAddressComponent(result?.address_components, [
      "administrative_area_level_3",
    ]),
  });
}


async function reverseGeocodeWithLocationIQ(latitude, longitude) {
  const key = process.env.LOCATIONIQ_API_KEY;
  console.log(`[LOCATIONIQ] key=${!!key} keyLen=${key?.trim().length} lat=${latitude} lng=${longitude}`);
  if (!key) return null;

  const params = new URLSearchParams({
    key,
    lat: String(latitude),
    lon: String(longitude),
    format: "json",
    zoom: "16",
    addressdetails: "1",
    normalizeaddress: "1",
  });

  const response = await fetchWithTimeout(
    `https://us1.locationiq.com/v1/reverse?${params.toString()}`,
    {
      headers: {
        "Accept-Language": "en",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`LocationIQ failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  const payload = buildGeocodePayload(data?.display_name, {
    road: data?.address?.road,
    suburb: data?.address?.suburb,
    neighbourhood: data?.address?.neighbourhood || data?.address?.neighborhood,
    village: data?.address?.village || data?.address?.hamlet,
    locality: data?.address?.locality,
    city: data?.address?.city,
    town: data?.address?.town,
  });
  console.log(
    `[LOCATIONIQ_RESULT] status=${response.status} display_name="${data?.display_name}" result="${payload?.address || ""}" error="${data?.error || "none"}"`,
  );
  return payload;
}

async function reverseGeocodeWithNominatim(latitude, longitude) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    zoom: "16",
    addressdetails: "1",
  });

  const response = await fetchWithTimeout(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    {
      headers: {
        "User-Agent":
          process.env.REVERSE_GEOCODE_USER_AGENT ||
          "gps-tracker-location-enrichment/1.0",
        "Accept-Language": process.env.REVERSE_GEOCODE_LANGUAGE || "en",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Nominatim failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  return buildGeocodePayload(data?.display_name, {
    road: data?.address?.road,
    suburb: data?.address?.suburb,
    neighbourhood: data?.address?.neighbourhood || data?.address?.neighborhood,
    village: data?.address?.village || data?.address?.hamlet,
    locality: data?.address?.locality,
    city: data?.address?.city,
    town: data?.address?.town,
  });
}

async function reverseGeocode(latitude, longitude) {
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return null;

  const providers = [];

  if (REVERSE_GEOCODE_PROVIDER === "google" && GOOGLE_GEOCODING_API_KEY) {
    providers.push(() => reverseGeocodeWithGoogle(latitude, longitude));
  }
  if (process.env.LOCATIONIQ_API_KEY) {
    providers.push(() => reverseGeocodeWithLocationIQ(latitude, longitude));
  }
  providers.push(() => reverseGeocodeWithNominatim(latitude, longitude));

  for (const resolveAddress of providers) {
    try {
      const payload = await resolveAddress();
      if (payload?.address && !isCoordinateLikeAddress(payload.address)) {
        return payload;
      }
    } catch (error) {
      console.error("Reverse geocoding error:", error?.message || error);
    }
  }

  return null;
}

async function resolveReverseGeocodeWithCache(latitude, longitude) {
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return null;

  const cacheKey = buildAddressCacheKey(latitude, longitude);
  const cached = await readJsonCache(cacheKey);

  if (cached !== null) {
    const normalizedCached = normalizeCachedGeocodePayload(cached);
    if (normalizedCached?.address) {
      return normalizedCached;
    }
  }

  if (pendingAddressResolutions.has(cacheKey)) {
    return pendingAddressResolutions.get(cacheKey);
  }

  const pendingPromise = (async () => {
    const geocodePayload = await reverseGeocode(latitude, longitude);
    const ttl = geocodePayload?.address ? ADDRESS_CACHE_TTL_SECONDS : 30;

    await writeJsonCache(cacheKey, ttl, {
      address: geocodePayload?.address || "",
      fallbackPoiName: geocodePayload?.fallbackPoi?.poiName || "",
    });
    return geocodePayload;
  })()
    .catch((error) => {
      console.error("Address resolution error:", error?.message || error);
      return null;
    })
    .finally(() => {
      pendingAddressResolutions.delete(cacheKey);
    });

  pendingAddressResolutions.set(cacheKey, pendingPromise);
  return pendingPromise;
}

async function resolveAddressWithCache(latitude, longitude) {
  const geocodePayload = await resolveReverseGeocodeWithCache(
    latitude,
    longitude,
  );
  return geocodePayload?.address || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POI LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and normalize a POI candidate from DB.
 * Returns null if POI is outside effective radius.
 */
function normalizePoiCandidate(poi, latitude, longitude) {
  if (
    !Array.isArray(poi?.locationCoordinates) ||
    poi.locationCoordinates.length < 2
  ) {
    return null;
  }

  const poiLongitude = Number(poi.locationCoordinates[0]);
  const poiLatitude = Number(poi.locationCoordinates[1]);
  if (!isFiniteNumber(poiLatitude) || !isFiniteNumber(poiLongitude)) {
    return null;
  }

  const distanceMeters =
    calculateDistance(latitude, longitude, poiLatitude, poiLongitude) * 1000;
  const radiusMeters = Number(poi.radius || 0) || 0;
  const effectiveRadius =
    radiusMeters > 0 ? radiusMeters : DEFAULT_POI_SEARCH_RADIUS_METERS;

  if (distanceMeters > effectiveRadius) {
    return null;
  }

  return {
    poiId: String(poi._id),
    poiName: typeof poi.name === "string" ? poi.name.trim() : "",
    poiType: typeof poi.type === "string" ? poi.type.trim() : "",
    distanceMeters: Math.round(distanceMeters),
    radiusMeters: effectiveRadius,
  };
}

/**
 * Query nearest POI for an org at given coordinates.
 *
 * Primary path: $nearSphere with 2dsphere index (fast, index-driven)
 * Fallback path: scan up to POI_FALLBACK_SCAN_LIMIT docs (slow, logs warning)
 *
 * FIX #6: Fallback scan limit reduced from 200 → configurable (default 100)
 * and emits a console.warn so you know when index is missing in production.
 */
async function queryNearestPoi(organizationId, latitude, longitude) {
  if (!organizationId) return null;

  const baseFilter = {
    organizationId,
    isActive: true,
    locationCoordinates: { $exists: true, $type: "array" },
  };

  try {
    // PRIMARY PATH: geospatial index — O(log n), fast at any scale
    const geoCandidates = await POI.find({
      ...baseFilter,
      locationCoordinates: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: DEFAULT_POI_SEARCH_RADIUS_METERS,
        },
      },
    })
      .select("name type radius locationCoordinates")
      .limit(10)
      .lean();

    const normalized = geoCandidates
      .map((poi) => normalizePoiCandidate(poi, latitude, longitude))
      .filter(Boolean);

    const result = normalized[0] || null;

    // FIX #7: Structured POI lookup logging
    // This is how you debug "why is POI blank" in production.
    if (process.env.POI_DEBUG_LOGGING === "true") {
      console.log(
        `[POI_LOOKUP] org=${organizationId} lat=${latitude} lng=${longitude} ` +
          `radius=${DEFAULT_POI_SEARCH_RADIUS_METERS}m ` +
          `candidates=${geoCandidates.length} ` +
          `result=${result?.poiName || "NONE"} ` +
          `distance=${result?.distanceMeters ?? "-"}m`,
      );
    }

    return result;
  } catch (geoError) {
    // FALLBACK PATH: 2dsphere index missing or coordinates malformed
    // This should NOT happen in production — fix your index if you see this warning.
    console.warn(
      `[POI_LOOKUP] ⚠️  Geospatial query failed for org=${organizationId} — ` +
        `falling back to linear scan (limit=${POI_FALLBACK_SCAN_LIMIT}). ` +
        `Fix: ensure 2dsphere index exists on locationCoordinates. ` +
        `Error: ${geoError.message}`,
    );

    const candidates = await POI.find(baseFilter)
      .select("name type radius locationCoordinates")
      .limit(POI_FALLBACK_SCAN_LIMIT) // FIX: was hardcoded 200, now configurable
      .lean();

    return (
      candidates
        .map((poi) => normalizePoiCandidate(poi, latitude, longitude))
        .filter(Boolean)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null
    );
  }
}

/**
 * Resolve POI with Redis caching.
 *
 * FIX #1 APPLIED HERE: Blank POI → 2 min TTL. Found POI → 15 min TTL.
 *
 * Cache schema:
 *   - Found: { poiId: "abc123", poiName: "Main Depot", poiType: "depot", ... }
 *   - Blank:  { poiId: null, poiName: "" }
 *
 * The blank sentinel is cached with short TTL so new POIs are picked up quickly.
 */
async function resolvePoiWithCache(organizationId, latitude, longitude) {
  if (
    !organizationId ||
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude)
  ) {
    return null;
  }

  const cacheKey = buildPoiCacheKey(organizationId, latitude, longitude);
  const cached = await readJsonCache(cacheKey);

  if (cached !== null) {
    const cachedPoiName = normalizePoiText(cached.poiName);
    if (cached.poiId || cachedPoiName) {
      return {
        ...cached,
        poiId: cached.poiId || null,
        poiName: cachedPoiName,
      };
    }
    return null;
  }

  if (pendingPoiResolutions.has(cacheKey)) {
    return pendingPoiResolutions.get(cacheKey);
  }

  const pendingPromise = (async () => {
    const dbPoi = await queryNearestPoi(organizationId, latitude, longitude);
    const fallbackPoi = dbPoi
      ? null
      : (await resolveReverseGeocodeWithCache(latitude, longitude))
          ?.fallbackPoi || null;
    const poi = dbPoi || fallbackPoi;

    // FIX #1: Use different TTLs for found vs blank
    const ttl = poi ? POI_CACHE_TTL_SECONDS : POI_BLANK_CACHE_TTL_SECONDS;
    await writeJsonCache(cacheKey, ttl, poi || { poiId: null, poiName: "" });

    return poi;
  })()
    .catch((error) => {
      console.error("POI resolution error:", error?.message || error);
      return null;
    })
    .finally(() => {
      pendingPoiResolutions.delete(cacheKey);
    });

  pendingPoiResolutions.set(cacheKey, pendingPromise);
  return pendingPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE LOCATION UPDATE GATE
// ─────────────────────────────────────────────────────────────────────────────

async function shouldUpdateVehicleLocation(
  vehicleId,
  latitude,
  longitude,
  packetTimestamp,
  syncVehicleLocation,
) {
  if (!vehicleId) return false;

  const vehicle = await Vehicle.findById(vehicleId)
    .select("lastUpdated currentLocation.latitude currentLocation.longitude")
    .lean();

  if (!vehicle) return false;
  if (syncVehicleLocation) return true;

  const lastUpdatedMs = vehicle.lastUpdated
    ? new Date(vehicle.lastUpdated).getTime()
    : null;
  const packetTimestampMs = packetTimestamp
    ? new Date(packetTimestamp).getTime()
    : null;

  if (
    !lastUpdatedMs ||
    !packetTimestampMs ||
    Number.isNaN(lastUpdatedMs) ||
    Number.isNaN(packetTimestampMs)
  ) {
    return true;
  }

  if (
    isFiniteNumber(vehicle?.currentLocation?.latitude) &&
    isFiniteNumber(vehicle?.currentLocation?.longitude)
  ) {
    const movementMeters =
      calculateDistance(
        latitude,
        longitude,
        vehicle.currentLocation.latitude,
        vehicle.currentLocation.longitude,
      ) * 1000;

    if (movementMeters > VEHICLE_LOCATION_CHANGE_MIN_METERS) return true;
  }

  return (
    packetTimestampMs - lastUpdatedMs >=
    VEHICLE_LOCATION_MIN_UPDATE_INTERVAL_SECONDS * 1000
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE — write enriched data to DB + socket broadcast
// ─────────────────────────────────────────────────────────────────────────────

async function persistLocationEnrichment({
  organizationId,
  vehicleId,
  gpsDeviceId,
  imei,
  latitude,
  longitude,
  packetTimestamp,
  historyId,
  syncVehicleLocation,
  address,
  poi,
}) {
  const updates = [];
  const packetTimestampDate = packetTimestamp ? new Date(packetTimestamp) : null;
  const packetTimestampMs =
    packetTimestampDate && !Number.isNaN(packetTimestampDate.getTime())
      ? packetTimestampDate.getTime()
      : null;

  let liveUpdateIndex = -1;
  let liveUpdated = false;
  const resolvedAddress =
    address && !isCoordinateLikeAddress(address) ? address : null;

  // Build live data update
  const liveUpdate = {};
  if (resolvedAddress) liveUpdate.currentLocation = resolvedAddress;
  if (poi !== undefined) {
    liveUpdate.poi = poi?.poiName || "";
    liveUpdate.poiId = poi?.poiId || null;
  }

    if (gpsDeviceId && Object.keys(liveUpdate).length > 0) {
    liveUpdateIndex = updates.length;
    updates.push(
      GpsLiveData.updateOne(
        { gpsDeviceId },  // No timestamp gate for enrichment data
        { $set: liveUpdate },
      ),
    );
  }

  // Build history update
  const historyUpdate = {};
  if (resolvedAddress) historyUpdate.address = resolvedAddress;
  if (poi !== undefined) {
    historyUpdate.poi = poi?.poiName || "";
    historyUpdate.poiId = poi?.poiId || null;
  }

  if (historyId && Object.keys(historyUpdate).length > 0) {
    updates.push(
      GpsHistory.updateOne({ _id: historyId }, { $set: historyUpdate }),
    );
  }

  // Always update address and poi on Vehicle — no distance gate needed
  // Address/poi are enrichment data, not position data
  if (vehicleId && (resolvedAddress || poi !== undefined)) {
    const enrichmentOnlyUpdate = {};
    if (resolvedAddress) {
      enrichmentOnlyUpdate["currentLocation.address"] = resolvedAddress;
    }
    if (poi !== undefined) {
      enrichmentOnlyUpdate.poi = poi?.poiName || "";
      enrichmentOnlyUpdate.poiId = poi?.poiId || null;
    }
    if (Object.keys(enrichmentOnlyUpdate).length > 0) {
      updates.push(
        Vehicle.updateOne(
          { _id: vehicleId },
          { $set: enrichmentOnlyUpdate },
        ),
      );
    }
  }

  // Position update — gated by shouldUpdateVehicleLocation
  if (
    vehicleId &&
    (await shouldUpdateVehicleLocation(
      vehicleId,
      latitude,
      longitude,
      packetTimestamp,
      syncVehicleLocation,
    ))
  ) {
    updates.push(
      Vehicle.updateOne(
        {
          _id: vehicleId,
          $or: [
            { lastUpdated: { $exists: false } },
            { lastUpdated: null },
            { lastUpdated: { $lte: packetTimestamp } },
          ],
        },
        {
          $set: {
            "currentLocation.latitude": latitude,
            "currentLocation.longitude": longitude,
            "currentLocation.coordinates": [longitude, latitude],
            lastUpdated: packetTimestamp,
          },
        },
      ),
    );
  }

  if (updates.length > 0) {
    const results = await Promise.all(updates);
    if (liveUpdateIndex >= 0) {
      const liveResult = results[liveUpdateIndex];
      liveUpdated = Boolean(liveResult && liveResult.matchedCount > 0);
    }
  }

  // Socket broadcast — always send after enrichment completes so UI shows POI immediately
  try {
    const io = getIo();
    if (io) {
    const socketPayload = {
  imei,
  organizationId,
  vehicleId,
  gpsDeviceId,
  gpsTimestamp: packetTimestamp,
  currentLocation: resolvedAddress || undefined,
  poi: poi?.poiName || "",
  poiId: poi?.poiId || null,
  updatedAt: new Date(),
  _enrichmentOnly: true, // signals frontend: update address/poi only, not position
};

      io.to(`device_${imei}`).emit("gps_update", socketPayload);
      io.to(`org_${organizationId}`).emit("gps_update", socketPayload);
    }
  } catch {
    // Socket server may not be available during tests/startup.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENRICHMENT CORE
// ─────────────────────────────────────────────────────────────────────────────

async function enrichLocationContext(context) {
  const latitude = Number(context.latitude);
  const longitude = Number(context.longitude);
  console.log(`[ENRICHMENT] Running: lat=${latitude} lng=${longitude} org=${context.organizationId} vehicle=${context.vehicleId}`);
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return null;

  // Address and POI resolve in parallel — neither blocks the other
  const [address, poi] = await Promise.all([
    resolveAddressWithCache(latitude, longitude),
    resolvePoiWithCache(context.organizationId, latitude, longitude),
  ]);

  await persistLocationEnrichment({
    ...context,
    latitude,
    longitude,
    address,
    poi,
  });

  return { address, poi };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE MANAGEMENT
//
// scheduleLocationEnrichment is called from GPS packet processing (hot path).
// It must be synchronous and fast — no awaiting here.
//
// HOW DEDUPLICATION PREVENTS "EVERY PACKET" LOOKUP:
//   - Dedupe key = org + vehicle + 4-decimal cell (~11m grid)
//   - If vehicle sends 10 packets/sec but stays in same 11m cell,
//     only 1 enrichment task runs — the rest are deduped out
//   - Vehicle must move >11m to trigger a new enrichment
//   - This gives you geographic-cell-based deduplication, not time-based
// ─────────────────────────────────────────────────────────────────────────────

// Minimum time between enrichments for same cell (prevents cache-hit spam)
const ENRICHMENT_DEDUPE_MIN_MS = Number(
  process.env.ENRICHMENT_DEDUPE_MIN_MS || 30000  // 30 seconds
);

// Track last enrichment time per dedupe key
const lastEnrichmentTime = new Map();

function scheduleLocationEnrichment(context) {
  if (!context) return;

  const dedupeKey = buildEnrichmentDedupeKey(context);
  if (dedupeKey) {
    // Block if already queued/running
    if (pendingEnrichmentKeys.has(dedupeKey)) return;

    // Block if enriched recently (prevents spam when vehicle is parked)
    const lastTime = lastEnrichmentTime.get(dedupeKey);
    if (lastTime && Date.now() - lastTime < ENRICHMENT_DEDUPE_MIN_MS) return;

    pendingEnrichmentKeys.add(dedupeKey);
    lastEnrichmentTime.set(dedupeKey, Date.now());
    context._enrichmentKey = dedupeKey;
  }

  enrichmentQueue.push(context);
  drainEnrichmentQueue();
}

function drainEnrichmentQueue() {
  while (
    activeEnrichmentTasks < MAX_CONCURRENT_ENRICHMENT &&
    enrichmentQueue.length > 0
  ) {
    const context = enrichmentQueue.shift();
    activeEnrichmentTasks += 1;

    setImmediate(() => {
      enrichLocationContext(context)
        .catch((error) => {
          console.error("Location enrichment error:", error?.message || error);
        })
        .finally(() => {
          // Clean up dedupe key so next cell entry triggers enrichment
          const key = context?._enrichmentKey || buildEnrichmentDedupeKey(context);
          if (key) pendingEnrichmentKeys.delete(key);

                    activeEnrichmentTasks = Math.max(0, activeEnrichmentTasks - 1);

          // Clean up old dedupe time entries (older than 5 min)
          const cutoff = Date.now() - 300000;
          for (const [k, t] of lastEnrichmentTime.entries()) {
            if (t < cutoff) lastEnrichmentTime.delete(k);
          }

          drainEnrichmentQueue();
        });
    });
  }
}

module.exports = {
  scheduleLocationEnrichment,
  enrichLocationContext,
  resolveAddressWithCache,
};
