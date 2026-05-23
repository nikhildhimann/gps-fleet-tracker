const { calculateDistance } = require("../../common/utils");

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toLocation(point) {
  return {
    address:
      typeof point.address === "string" && point.address.trim()
        ? point.address.trim()
        : `${point.latitude}, ${point.longitude}`,
    latitude: point.latitude ?? null,
    longitude: point.longitude ?? null,
  };
}

function getDurationSeconds(start, end) {
  if (!start || !end) return 0;
  return Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000),
  );
}

function calculatePathDistance(points) {
  let distance = 0;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];

    if (
      !isFiniteNumber(prev.latitude) ||
      !isFiniteNumber(prev.longitude) ||
      !isFiniteNumber(curr.latitude) ||
      !isFiniteNumber(curr.longitude)
    ) {
      continue;
    }

    const delta = calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude,
    );

    if (delta > 0 && delta <= 5) {
      distance += delta;
    }
  }

  return Number(distance.toFixed(2));
}

function calculateTripDistance(points) {
  const validOdometers = points
    .map((point) => point.odometer)
    .filter((value) => isFiniteNumber(value));

  let odoDistance = 0;
  if (validOdometers.length >= 2) {
    const startValue = validOdometers[0];
    const endValue = validOdometers[validOdometers.length - 1];
    if (endValue >= startValue) {
      odoDistance = Number((endValue - startValue).toFixed(2));
    }
  }

  const pathDistance = calculatePathDistance(points);

  // Use path distance if odometer is static (common in simulations or config errors)
  if (odoDistance <= 0 && pathDistance > 0) {
    return pathDistance;
  }

  return odoDistance || pathDistance;
}

function finalizeTrip(points, endedByIgnitionOff) {
  if (!points || points.length === 0) return null;

  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  let runningTime = 0;
  let idleTime = 0;
  let maxSpeed = 0;
  let alerts = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const delta = getDurationSeconds(prev.gpsTimestamp, curr.gpsTimestamp);

    if ((curr.speed || 0) > 5) {
      runningTime += delta;
    } else if (curr.ignitionStatus) {
      idleTime += delta;
    }

    if ((curr.speed || 0) > maxSpeed) maxSpeed = curr.speed || 0;

    // Detection logic
    if (curr.emergencyStatus) alerts++;
    if ((curr.speed || 0) > 60) alerts++; // Overspeed Threshold
  }

  const distance = calculateTripDistance(points);
  const duration = getDurationSeconds(startPoint.gpsTimestamp, endPoint.gpsTimestamp);

  return {
    startTime: startPoint.gpsTimestamp,
    endTime: endPoint.gpsTimestamp,
    startLocation: toLocation(startPoint),
    endLocation: toLocation(endPoint),
    startOdometer: startPoint.odometer || 0,
    endOdometer: endPoint.odometer || 0,
    distance,
    duration,
    runningTime,
    idleTime,
    stopTime: Math.max(0, duration - runningTime - idleTime), // Time not moving and engine off
    inactiveTime: 0,
    avgSpeed: runningTime > 0 ? Number((distance / (runningTime / 3600)).toFixed(2)) : 0,
    maxSpeed: Number(maxSpeed.toFixed(2)),
    alerts,
    pointCount: points.length,
    points, // internal trip history for expandable child
    endedByIgnitionOff,
  };
}

function calculateStatistics(dailyStats = []) {
  const totals = dailyStats.reduce(
    (acc, stat) => {
      acc.totalDistance += Number(stat.totalDistance || 0);
      acc.maxSpeed = Math.max(acc.maxSpeed, Number(stat.maxSpeed || 0));
      acc.runningTime += Number(stat.runningTime || 0);
      acc.idleTime += Number(stat.idleTime || 0);
      acc.ignitionOnCount += Number(stat.ignitionOnCount || 0);
      return acc;
    },
    {
      totalDistance: 0,
      maxSpeed: 0,
      runningTime: 0,
      idleTime: 0,
      ignitionOnCount: 0,
    },
  );

  const avgSpeed =
    totals.runningTime > 0
      ? Number((totals.totalDistance / (totals.runningTime / 3600)).toFixed(2))
      : 0;

  return {
    totalDistance: Number(totals.totalDistance.toFixed(2)),
    avgSpeed,
    maxSpeed: Number(totals.maxSpeed.toFixed(2)),
    runningTime: totals.runningTime,
    idleTime: totals.idleTime,
    ignitionOnCount: totals.ignitionOnCount,
  };
}

function buildTrips(historyPoints = []) {
  const STOP_THRESHOLD_SECONDS = 300; // 5 minutes

  const orderedPoints = [...historyPoints].sort(
    (a, b) => new Date(a.gpsTimestamp).getTime() - new Date(b.gpsTimestamp).getTime(),
  );

  const trips = [];
  let currentGroup = [];
  let lastEndTime = null;

  orderedPoints.forEach((point) => {
    const ignitionOn = Boolean(point.ignitionStatus);
    const speed = point.speed || 0;

    if (currentGroup.length > 0) {
      const lastPoint = currentGroup[currentGroup.length - 1];
      const gap = getDurationSeconds(lastPoint.gpsTimestamp, point.gpsTimestamp);

      // Find last ignition ON point to check how long it has been OFF
      let lastOnPoint = null;
      for (let i = currentGroup.length - 1; i >= 0; i--) {
        if (currentGroup[i].ignitionStatus) {
          lastOnPoint = currentGroup[i];
          break;
        }
      }
      const offDuration = lastOnPoint ? getDurationSeconds(lastOnPoint.gpsTimestamp, point.gpsTimestamp) : 0;

      // Logic to split trips:
      // 1. Large gap between data points (> 5 mins)
      // 2. Ignition OFF for > 5 mins
      // 3. Stopped/Idle with Ignition ON for > 5 mins
      const isGapTooLarge = gap > STOP_THRESHOLD_SECONDS;
      const isOffTooLong = !ignitionOn && offDuration > STOP_THRESHOLD_SECONDS;
      const isIdleTooLong = ignitionOn && gap > STOP_THRESHOLD_SECONDS && speed <= 5;

      if (isGapTooLarge || isOffTooLong || isIdleTooLong) {
        // Finalize what we have so far
        // If it was an ignition-off split, the trip ended with the previous point
        const trip = finalizeTrip(currentGroup, !lastPoint.ignitionStatus);
        if (trip) {
          if (lastEndTime) trip.inactiveTime = getDurationSeconds(lastEndTime, trip.startTime);
          trips.push(trip);
          lastEndTime = trip.endTime;
        }
        currentGroup = [];
      }
    }

    if (currentGroup.length === 0) {
      // Start a new trip only on Ignition ON or significant movement
      if (ignitionOn || speed > 5) {
        currentGroup = [point];
      }
    } else {
      currentGroup.push(point);
    }
  });

  // Handle final pending group
  if (currentGroup.length > 0) {
    const trip = finalizeTrip(currentGroup, false);
    if (trip) {
      if (lastEndTime) trip.inactiveTime = getDurationSeconds(lastEndTime, trip.startTime);
      trips.push(trip);
    }
  }

  const totalTripDistance = Number(
    trips.reduce((sum, trip) => sum + Number(trip.distance || 0), 0).toFixed(2),
  );

  const totalDuration = trips.reduce((sum, trip) => sum + trip.duration, 0);
  const totalRunning = trips.reduce((sum, trip) => sum + trip.runningTime, 0);
  const totalIdle = trips.reduce((sum, trip) => sum + trip.idleTime, 0);
  const totalStop = trips.reduce((sum, trip) => sum + trip.stopTime, 0);
  const totalInactive = trips.reduce((sum, trip) => sum + (trip.inactiveTime || 0), 0);

  const firstIgnitionOnPoint = orderedPoints.find(p => p.ignitionStatus);
  const lastIgnitionOffPoint = [...orderedPoints].reverse().find(p => p.ignitionStatus === false);

  return {
    trips,
    tripSummary: {
      tripCount: trips.length,
      totalTripDistance,
      totalDuration,
      totalRunning,
      totalIdle,
      totalStop,
      totalInactive,
      stopCount: trips.filter((trip) => trip.endedByIgnitionOff).length,
      averageTripDuration: trips.length > 0 ? Math.round(totalDuration / trips.length) : 0,
      firstIgnitionOn: firstIgnitionOnPoint ? {
        time: firstIgnitionOnPoint.gpsTimestamp,
        location: toLocation(firstIgnitionOnPoint)
      } : null,
      lastIgnitionOff: lastIgnitionOffPoint ? {
        time: lastIgnitionOffPoint.gpsTimestamp,
        location: toLocation(lastIgnitionOffPoint)
      } : null,
      avgSpeed: totalRunning > 0 ? Number((totalTripDistance / (totalRunning / 3600)).toFixed(2)) : 0,
      maxSpeed: trips.length > 0 ? Math.max(...trips.map(t => t.maxSpeed || 0)) : 0
    },
  };
}

function buildDaywiseDistance(groupedDays = []) {
  return groupedDays.map((day) => {
    const points = Array.isArray(day.points) ? day.points : [];
    const validOdometers = points
      .map((point) => point.odometer)
      .filter((value) => isFiniteNumber(value));

    let distance = 0;
    if (validOdometers.length >= 2) {
      const start = validOdometers[0];
      const end = validOdometers[validOdometers.length - 1];
      if (end >= start) {
        distance = end - start;
      }
    }

    if (!distance) {
      distance = calculatePathDistance(points);
    }

    return {
      date: day.date,
      distance: Number(distance.toFixed(2)),
    };
  });
}

function summarizeAlerts(alerts = [], emergencyEvents = [], latestAlerts = []) {
  const alertCountsByType = alerts.reduce((acc, alert) => {
    const key = alert.alertName || `Alert-${alert.alertId || "unknown"}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const overspeedCount = alerts.filter(
    (alert) => alert.alertId === 17 || alert.alertName === "Overspeed",
  ).length;

  const lowBatteryCount = alerts.filter(
    (alert) => alert.alertId === 4 || alert.alertName === "Low Battery",
  ).length;

  return {
    latestAlerts: latestAlerts.map((alert) => ({
      id: alert._id,
      alertId: alert.alertId,
      alertName: alert.alertName,
      severity: alert.severity || "info",
      gpsTimestamp: alert.gpsTimestamp,
    })),
    alertCountsByType,
    overspeedCount,
    lowBatteryCount,
    emergencyCount: emergencyEvents.length,
  };
}

function buildACSummary(historyPoints = []) {
  const orderedPoints = [...historyPoints].sort(
    (a, b) => new Date(a.gpsTimestamp).getTime() - new Date(b.gpsTimestamp).getTime(),
  );

  const acEvents = [];
  let currentEvent = null;

  for (let i = 0; i < orderedPoints.length; i++) {
    const point = orderedPoints[i];
    const acOn = Boolean(point.acStatus);

    if (currentEvent === null) {
      currentEvent = {
        status: acOn ? "ON" : "OFF",
        startTime: point.gpsTimestamp,
        startLocation: toLocation(point),
        startOdometer: point.odometer || 0,
        points: [point],
      };
    } else if (currentEvent.status !== (acOn ? "ON" : "OFF")) {
      const lastPoint = currentEvent.points[currentEvent.points.length - 1];
      currentEvent.endTime = lastPoint.gpsTimestamp;
      currentEvent.endLocation = toLocation(lastPoint);
      currentEvent.endOdometer = lastPoint.odometer || 0;
      currentEvent.duration = getDurationSeconds(
        currentEvent.startTime,
        currentEvent.endTime,
      );
      currentEvent.distance = calculateTripDistance(currentEvent.points);

      acEvents.push(currentEvent);

      currentEvent = {
        status: acOn ? "ON" : "OFF",
        startTime: point.gpsTimestamp,
        startLocation: toLocation(point),
        startOdometer: point.odometer || 0,
        points: [point],
      };
    } else {
      currentEvent.points.push(point);
    }
  }

  if (currentEvent) {
    const lastPoint = currentEvent.points[currentEvent.points.length - 1];
    currentEvent.endTime = lastPoint.gpsTimestamp;
    currentEvent.endLocation = toLocation(lastPoint);
    currentEvent.endOdometer = lastPoint.odometer || 0;
    currentEvent.duration = getDurationSeconds(
      currentEvent.startTime,
      currentEvent.endTime,
    );
    currentEvent.distance = calculateTripDistance(currentEvent.points);
    acEvents.push(currentEvent);
  }

  let acOnDistance = 0;
  let acOnDuration = 0;
  let acOnCount = 0;
  let acOffDistance = 0;
  let acOffDuration = 0;
  let acOffCount = 0;
  let runningTime = 0;
  let idleTime = 0;

  acEvents.forEach((event) => {
    if (event.status === "ON") {
      acOnDistance += event.distance;
      acOnDuration += event.duration;
      acOnCount++;
    } else {
      acOffDistance += event.distance;
      acOffDuration += event.duration;
      acOffCount++;
    }
  });

  for (let i = 1; i < orderedPoints.length; i++) {
    const prev = orderedPoints[i - 1];
    const curr = orderedPoints[i];
    const delta = getDurationSeconds(prev.gpsTimestamp, curr.gpsTimestamp);
    if ((curr.speed || 0) > 5) runningTime += delta;
    else if (curr.ignitionStatus) idleTime += delta;
  }

  const lastPoint = orderedPoints[orderedPoints.length - 1];
  const nowStatus = lastPoint ? (
    (lastPoint.speed || 0) > 5 ? "Running" :
      lastPoint.ignitionStatus ? "Idle" : "Stop"
  ) : "Unknown";

  return {
    events: acEvents.map((e) => {
      const clean = { ...e };
      const eventPoints = e.points || [];
      clean.avgSpeed = eventPoints.length > 0
        ? Number((eventPoints.reduce((s, p) => s + (p.speed || 0), 0) / eventPoints.length).toFixed(1))
        : 0;
      delete clean.points;
      return clean;
    }),
    summary: {
      acOnDistance: Number(acOnDistance.toFixed(2)),
      acOnDuration,
      acOnCount,
      acOffDistance: Number(acOffDistance.toFixed(2)),
      acOffDuration,
      acOffCount,
      runningTime,
      idleTime,
      avgSpeed: orderedPoints.length > 0
        ? Number((orderedPoints.reduce((s, p) => s + (p.speed || 0), 0) / orderedPoints.length).toFixed(1))
        : 0,
    },
    nowStatus,
  };
}

module.exports = {
  calculateStatistics,
  buildTrips,
  buildDaywiseDistance,
  summarizeAlerts,
  buildACSummary,
};
