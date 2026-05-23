const GpsLiveData = require("./model");
const GpsHistory = require("../gpsHistory/model");
const GpsDevice = require("../gpsDevice/model");
const VehicleDeviceMapping = require("../deviceMapping/model");
const redisClient = require("../../config/redis");
const { getIo } = require("../../socket");
const VehicleDailyStats = require("../vehicleDailyStats/model");
const Alert = require("../alerts/model");
const Organization = require("../organizations/model");
const EmergencyEvent = require("../emergencyEvents/model");
const { calculateDistance, mapAlertType } = require("../../common/utils");
const { scheduleLocationEnrichment } = require("../../common/locationEnrichment");
const { createNotificationFromAlert } = require("../notifications/producers");

const Service = {
  /**
   * Unified GPS data processor
   * Source: TCP / HTTP / MQTT
   */
  processGpsData: async (data, overrides = {}) => {
    try {
      /* ------------------------------------------------------------------ */
      /* 1️⃣ NORMALIZE INPUT                                                  */
      /* ------------------------------------------------------------------ */

      const imei = data.imei;
      const latitude = data.latitude ?? data.lat ?? null;
      const longitude = data.longitude ?? data.lng ?? null;
      const speed = parseFloat(data.currentSpeed ?? data.speed ?? 0);
      const ignition = !!(data.ignitionStatus ?? data.ignition);

      if (!imei || latitude === null || longitude === null) {
        return {
          success: false,
          message: "Missing required fields (imei, latitude, longitude)",
          status: 400,
        };
      }

      let { organizationId, vehicleId } = data;

      if (overrides.organizationId) organizationId = overrides.organizationId;
      if (overrides.vehicleId) vehicleId = overrides.vehicleId;

      /* ------------------------------------------------------------------ */
      /* 2️⃣ DEVICE + MAPPING RESOLUTION (REDIS FIRST)                        */
      /* ------------------------------------------------------------------ */
      let gpsDeviceId;

      const cacheKey = `device_meta:${imei}`;
      let cacheHit = false;

      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          gpsDeviceId = parsed._id;
          organizationId = parsed.organizationId;
          vehicleId = parsed.vehicleId;
          cacheHit = true;
        }
      } catch (redisErr) {
        console.warn("Redis read failed, falling back to DB:", redisErr.message);
      }

      if (!cacheHit) {
        const device = await GpsDevice.findOne({ imei });
        if (!device) {
          return { success: false, message: "Device not found", status: 404 };
        }

        gpsDeviceId = device._id;
        organizationId = device.organizationId;

        const mapping = await VehicleDeviceMapping.findOne({
          gpsDeviceId,
          unassignedAt: null,
        });

        vehicleId = mapping?.vehicleId || null;

        try {
          await redisClient.setex(cacheKey, 60, JSON.stringify({
            _id: gpsDeviceId,
            organizationId,
            vehicleId,
          }));
        } catch (redisErr) {
          console.warn("Redis write failed:", redisErr.message);
        }
      }

      if (!organizationId) {
        return { success: false, message: "No organizationId for device", status: 400 };
      }

      const timestamp = new Date();
      const parsedGpsTimestamp = data.gpsTimestamp
        ? new Date(data.gpsTimestamp)
        : null;
      const packetTimestamp =
        parsedGpsTimestamp && !Number.isNaN(parsedGpsTimestamp.getTime())
          ? parsedGpsTimestamp
          : timestamp;

      /* ------------------------------------------------------------------ */
      /* 3️⃣ MOVEMENT STATUS (STANDARDIZED)                                   */
      /* ------------------------------------------------------------------ */

      let movementStatus = "inactive";
      if (ignition) {
        if (speed > 5) movementStatus = "running";
        else if (speed > 0) movementStatus = "idle";
        else movementStatus = "stopped";
      }

      /* ------------------------------------------------------------------ */
      /* 4️⃣ SOCKET.IO BROADCAST                                               */
      /* ------------------------------------------------------------------ */

      let io;
      try {
        io = getIo();
      } catch {
        io = null;
      }

      const socketPayload = {
        imei,
        organizationId,
        vehicleId,
        gpsDeviceId,
        latitude,
        longitude,
        speed,
        ignition,
        movementStatus,
        gpsTimestamp: packetTimestamp,
        mainPowerStatus: data.mainPowerStatus ?? null,
        acStatus: data.acStatus ?? null,
        internalBatteryVoltage: data.internalBatteryVoltage ?? null,
        batteryLevel: data.batteryLevel ?? null,
        numberOfSatellites: data.numberOfSatellites ?? null,
        gsmSignalStrength: data.gsmSignalStrength ?? null,
        fuelPercentage: data.fuelPercentage ?? null,
        temperature: data.temperature ?? null,
        updatedAt: timestamp,
      };

      if (io) {
        io.to(`device_${imei}`).emit("gps_update", socketPayload);
        io.to(`org_${organizationId}`).emit("gps_update", socketPayload);
      }

      /* ------------------------------------------------------------------ */
      /* 5️⃣ UPDATE LIVE DATA                                                  */
      /* ------------------------------------------------------------------ */

      const prev = await GpsLiveData.findOne({ gpsDeviceId });

      const liveUpdate = {
        imei,
        organizationId,
        vehicleId,
        gpsDeviceId,
        latitude,
        longitude,
        currentSpeed: speed,
        ignitionStatus: ignition,
        movementStatus,
        updatedAt: timestamp,

        // Additional fields from parser
        latitudeDirection: data.latitudeDirection ?? null,
        longitudeDirection: data.longitudeDirection ?? null,
        heading: data.heading ?? null,
        numberOfSatellites: data.numberOfSatellites ?? null,
        currentMileage: data.currentMileage ?? null,
        gpsDate: data.gpsDate ?? null,
        gpsTime: data.gpsTime ?? null,
        packetType: data.packetType ?? "NR",
        altitude: data.altitude ?? null,
        pdop: data.pdop ?? null,
        hdop: data.hdop ?? null,
        digitalInputStatus: data.digitalInputStatus ?? null,

        // Status fields
        emergencyStatus: data.emergencyStatus ?? false,
        tamperAlert: data.tamperAlert ?? "C",
        acStatus: data.acStatus ?? false,

        // Power fields
        mainPowerStatus: data.mainPowerStatus ?? null,
        mainInputVoltage: data.mainInputVoltage ?? null,
        internalBatteryVoltage: data.internalBatteryVoltage ?? null,
        batteryLevel: data.batteryLevel ?? null,

        // Network fields
        gsmSignalStrength: data.gsmSignalStrength ?? null,
        operatorName: data.operatorName ?? null,
        mcc: data.mcc ?? null,

        // Sensor fields
        fuelPercentage: data.fuelPercentage ?? null,
        temperature: data.temperature ?? null,
      };

      if (ignition && !(prev && prev.ignitionStatus)) {
        liveUpdate.lastIgnitionOn = timestamp;
      }
      if (!ignition && prev && prev.ignitionStatus) {
        liveUpdate.lastIgnitionOff = timestamp;
      }

      await GpsLiveData.findOneAndUpdate(
        { gpsDeviceId },
        { $set: { ...liveUpdate, gpsTimestamp: packetTimestamp } },
        { upsert: true, new: true },
      );

      /* ------------------------------------------------------------------ */
      /* 6️⃣ GPS HISTORY (THROTTLED)                                           */
      /* ------------------------------------------------------------------ */

       const historyKey = `gps_history:${imei}`;
      let lastSavedRaw = null;
      try {
        lastSavedRaw = await redisClient.get(historyKey);
      } catch (redisErr) {
        console.warn("Redis read (history) failed:", redisErr.message);
      }
      const packetMs = packetTimestamp.getTime();
      const heading = data.heading ?? null;

      // Determine if this packet should be saved
      let shouldSave = false;

      if (!lastSavedRaw) {
        // No previous save — always save the first packet
        shouldSave = true;
      } else {
        const lastSaved = JSON.parse(lastSavedRaw);
        const timeDelta = packetMs - (lastSaved.t || 0);

        if (timeDelta >= 4000) {
          // Base 4-second throttle window elapsed
          shouldSave = true;
        } else if (timeDelta > 0) {
          // Within 4s — check intelligent override conditions

          // Override 1: Speed change > 10 km/h
          if (
            typeof lastSaved.speed === "number" &&
            Math.abs(speed - lastSaved.speed) > 10
          ) {
            shouldSave = true;
          }

          // Override 2: Heading change > 15° (sharp turn detection)
          if (
            !shouldSave &&
            heading !== null &&
            typeof lastSaved.heading === "number"
          ) {
            let headingDelta = Math.abs(heading - lastSaved.heading);
            if (headingDelta > 180) headingDelta = 360 - headingDelta;
            if (headingDelta > 15) shouldSave = true;
          }

          // Override 3: Ignition state changed
          if (!shouldSave && lastSaved.ignition !== ignition) {
            shouldSave = true;
          }

          // Override 4: Distance from last saved point > 20 meters (0.02 km)
          if (
            !shouldSave &&
            typeof lastSaved.lat === "number" &&
            typeof lastSaved.lng === "number"
          ) {
            const distKm = calculateDistance(
              lastSaved.lat,
              lastSaved.lng,
              latitude,
              longitude,
            );
            // Save if > 20m, but ignore GPS jumps > 5km
            if (distKm > 0.02 && distKm <= 5) {
              shouldSave = true;
            }
          }
        }
        // timeDelta <= 0 means duplicate or out-of-order — skip
      }

      let historyDoc = null;

      if (shouldSave) {
        try {
          historyDoc = await GpsHistory.create({
            organizationId,
            vehicleId,
            gpsDeviceId,
            imei,
            latitude,
            longitude,
            speed,
            gpsTimestamp: packetTimestamp,

            // Additional fields
            heading,
            altitude: data.altitude ?? null,
            numberOfSatellites: data.numberOfSatellites ?? null,
            packetType: data.packetType ?? null,
            ignitionStatus: ignition,
            acStatus: !!data.acStatus,
            emergencyStatus: data.emergencyStatus ?? false,
            tamperAlert: data.tamperAlert ?? null,
            mainPowerStatus: data.mainPowerStatus ?? null,
            mainInputVoltage: data.mainInputVoltage ?? null,
            internalBatteryVoltage: data.internalBatteryVoltage ?? null,
            odometer: data.currentMileage ?? null,
            gsmSignalStrength: data.gsmSignalStrength ?? null,
            operatorName: data.operatorName ?? null,
            frameNumber: data.frameNumber ?? null,
            digitalInputStatus: data.digitalInputStatus ?? null,
          });

          // Store last-saved packet metadata in Redis for override comparisons
          await redisClient.setex(
            historyKey,
            3600,
            JSON.stringify({
              t: packetMs,
              speed,
              heading,
              ignition,
              lat: latitude,
              lng: longitude,
            }),
          );
        } catch (histErr) {
          // Silently skip duplicate-key errors (E11000) from unique index
          if (histErr.code !== 11000) throw histErr;
        }
      }

      /* ------------------------------------------------------------------ */
      /* 7️⃣ VEHICLE DAILY STATS (ATOMIC UPSERT WITH DISTANCE CALCULATION)     */
      /* ------------------------------------------------------------------ */

      // 7a — Normalize date to UTC midnight
      if (vehicleId) {
        // 7a — Normalize date to UTC midnight
        const statsDate = new Date(packetTimestamp);
        statsDate.setUTCHours(0, 0, 0, 0);

        // 7b — Calculate distance from previous live position (haversine)
        let distanceIncrement = 0;
        if (prev && prev.latitude != null && prev.longitude != null) {
          distanceIncrement = calculateDistance(
            prev.latitude,
            prev.longitude,
            latitude,
            longitude,
          );
          // Ignore unrealistic jumps (>5 km between two successive packets)
          if (distanceIncrement > 5) {
            distanceIncrement = 0;
          }
        }

        // 7c — Elapsed seconds between GPS timestamps (NOT wall clock time).
        // WHY: Simulator sends packets 200ms apart in real time but GPS timestamps
        // are 5–30s apart. Using wall clock = 0.2s elapsed = wrong times.
        // Using GPS timestamp delta = correct simulated elapsed time.
        let elapsedSeconds = 0;
        if (prev && prev.gpsTimestamp) {
          const prevGpsMs = new Date(prev.gpsTimestamp).getTime();
          const thisGpsMs = packetTimestamp.getTime();
          const deltaMs = thisGpsMs - prevGpsMs;
          if (deltaMs > 0) {
            elapsedSeconds = Math.min(300, Math.round(deltaMs / 1000));
          }
        }

        // 7d — Build atomic update operators
        const statsInc = {
          totalDistance: distanceIncrement,
          speedSampleCount: 1,
        };

        // Time increments (real elapsed seconds based on ignition + speed)
        if (ignition && speed > 0) {
          statsInc.runningTime = elapsedSeconds;
        } else if (ignition && speed === 0) {
          statsInc.idleTime = elapsedSeconds;
        }

        // Ignition transition: false → true  →  increment ignitionOnCount
        const prevIgnition = prev ? !!prev.ignitionStatus : false;
        if (!prevIgnition && ignition) {
          statsInc.ignitionOnCount = 1;
        }

        const odometer = data.currentMileage ?? null;

        const statsUpdate = {
          $inc: statsInc,
          $max: { maxSpeed: speed },
          $setOnInsert: {
            organizationId,
            gpsDeviceId,
            imei,
            startOdometer: odometer,
          },
          $set: {
            endOdometer: odometer,
            lastCalculatedAt: timestamp,
          },
        };

        // Ignition transition: true → false  →  set lastIgnitionOff
        if (prevIgnition && !ignition) {
          statsUpdate.$set.lastIgnitionOff = timestamp;
        }

        // 7e — Atomic findOneAndUpdate with upsert (respects compound unique index)
        const updatedStats = await VehicleDailyStats.findOneAndUpdate(
          { vehicleId, date: statsDate },
          statsUpdate,
          { upsert: true, new: true },
        );

        // 7f — Guard firstIgnitionOn: only set once (when still null), never overwrite
        if (!prevIgnition && ignition && !updatedStats.firstIgnitionOn) {
          await VehicleDailyStats.updateOne(
            { _id: updatedStats._id, firstIgnitionOn: null },
            { $set: { firstIgnitionOn: timestamp } },
          );
        }

        // 7g — Compute avgSpeed from accumulated totals (distance-based, km/h)
        if (updatedStats.runningTime > 60 && updatedStats.totalDistance > 0) {
          // runningTime must be > 60 seconds to avoid division artifacts
          const calculatedAvg = Number(
            (
              updatedStats.totalDistance /
              (updatedStats.runningTime / 3600)
            ).toFixed(2),
          );
          // Hard cap at 250 km/h — any value above is a calculation artifact
          const avgSpeed = calculatedAvg > 250 ? 0 : calculatedAvg;
          await VehicleDailyStats.updateOne(
            { _id: updatedStats._id },
            { $set: { avgSpeed } },
          );
        }

        /* ------------------------------------------------------------------ */
        /* 8️⃣ ALERTS (OVERSPEED / BATTERY / IGNITION) + ALERT COUNTS            */
        /* ------------------------------------------------------------------ */

        try {
          const orgCacheKey = `org_settings:${organizationId}`;
          let orgSettings = await redisClient.get(orgCacheKey);

          if (!orgSettings) {
            const org = await Organization.findById(organizationId)
              .select("settings")
              .lean();
            orgSettings = org?.settings || {};
            await redisClient.setex(orgCacheKey, 60, JSON.stringify(orgSettings));
          } else {
            orgSettings = JSON.parse(orgSettings);
          }

          const SPEED_LIMIT = orgSettings.speedLimit ?? 80;
          const LOW_BATTERY = orgSettings.lowBatteryThreshold ?? 20;

          // Helper function to create alert and increment count

          const createAlertAndCount = async (alertType, message, severity = "warning") => {
            const alertMapping = mapAlertType(alertType);
            const alert = await Alert.create({
              organizationId,
              gpsDeviceId,
              vehicleId,
              imei,
              alertId: alertMapping.alertId,
              alertName: alertMapping.alertName,
              packetType: alertMapping.packetType,
              severity,
              latitude,
              longitude,
              locationCoordinates: [longitude, latitude],
              gpsTimestamp: packetTimestamp,
              speed,
              heading: data.heading ?? null,
              ignitionStatus: ignition,
              mainPowerStatus: data.mainPowerStatus ?? null,
              mainInputVoltage: data.mainInputVoltage ?? null,
              internalBatteryVoltage: data.internalBatteryVoltage ?? null,
              gsmSignalStrength: data.gsmSignalStrength ?? null,
              operatorName: data.operatorName ?? null,
              odometer: data.currentMileage ?? null,
            });
            void createNotificationFromAlert(alert, { orgScope: "ALL" });

            const countField = `alertCounts.${alertType}Count`;
            await VehicleDailyStats.updateOne(
              { vehicleId, date: statsDate },
              { $inc: { [countField]: 1 } },
            );
          };

          // STEP 2: Overspeed — check speed FIRST, then cooldown
          if (speed > SPEED_LIMIT) {
            const overspeedKey = `alert_cooldown:overspeed:${vehicleId}`;
            let alreadyAlerting = false;
            try { alreadyAlerting = !!(await redisClient.get(overspeedKey)); } catch { }
            if (!alreadyAlerting) {
              try { await redisClient.setex(overspeedKey, 300, "1"); } catch { }
              await createAlertAndCount("overspeed", `Speed ${speed} km/h exceeded ${SPEED_LIMIT}`, "warning");
            }
          }

          // STEP 3: Low battery — check level FIRST, then cooldown
          if (typeof data.batteryLevel === "number" && data.batteryLevel <= LOW_BATTERY) {
            const batteryKey = `alert_cooldown:battery:${vehicleId}`;
            let batteryAlerted = false;
            try { batteryAlerted = !!(await redisClient.get(batteryKey)); } catch { }
            if (!batteryAlerted) {
              try { await redisClient.setex(batteryKey, 600, "1"); } catch { }
              await createAlertAndCount("low_battery", `Battery low: ${data.batteryLevel}%`, "warning");
            }
          }

          // STEP 4: Ignition transitions — no cooldown needed, these are one-time events
          if (ignition && !(prev && prev.ignitionStatus)) {
            await createAlertAndCount("ignition_on", "Vehicle ignition turned ON", "info");
          } else if (!ignition && prev && prev.ignitionStatus) {
            await createAlertAndCount("ignition_off", "Vehicle ignition turned OFF", "info");
          }
        } catch (e) {
          console.error("Alert error:", e);
        }

        /* ------------------------------------------------------------------ */
        /* 9️⃣ EMERGENCY EVENTS (EA PACKETS)                                     */
        /* ------------------------------------------------------------------ */

        try {
          if (data.emergencyStatus === true || data.packetType === "EA") {
            // Check if there's already an active emergency for this vehicle
            const existingEmergency = await EmergencyEvent.findOne({
              vehicleId,
              status: "active",
            }).sort({ gpsTimestamp: -1 });

            if (!existingEmergency) {
              // Create new emergency event
              await EmergencyEvent.create({
                organizationId,
                vehicleId,
                gpsDeviceId,
                imei,
                eventType: "emergency_on",
                latitude,
                longitude,
                locationCoordinates: [longitude, latitude],
                gpsTimestamp: packetTimestamp,
                speed,
                heading: data.heading ?? null,
                altitude: data.altitude ?? null,
                ignitionStatus: ignition,
                mainPowerStatus: data.mainPowerStatus ?? null,
                mainInputVoltage: data.mainInputVoltage ?? null,
                internalBatteryVoltage: data.internalBatteryVoltage ?? null,
                gsmSignalStrength: data.gsmSignalStrength ?? null,
                operatorName: data.operatorName ?? null,
                odometer: data.currentMileage ?? null,
                status: "active",
              });

              // Increment emergency count in daily stats
              await VehicleDailyStats.updateOne(
                { vehicleId, date: statsDate },
                { $inc: { "alertCounts.emergencyCount": 1 } },
              );

              console.log(`🚨 Emergency event created for vehicle ${vehicleId}`);
            }
          }
        } catch (e) {
          console.error("Emergency event error:", e);
        }
        if (historyDoc?._id) {
          console.log(`[ENRICH] vehicle=${vehicleId} lat=${latitude} lng=${longitude}`);
          scheduleLocationEnrichment({
            organizationId,
            vehicleId,
            gpsDeviceId,
            imei,
            latitude,
            longitude,
            packetTimestamp,
            historyId: historyDoc._id,
            syncVehicleLocation: true,
          })
        }
      }

      return { success: true, message: "GPS data processed", status: 200 };
    } catch (error) {
      console.error("Service Error:", error);
      return {
        success: false,
        message: error.message,
        status: 500,
      };
    }
  },
};

module.exports = Service;
