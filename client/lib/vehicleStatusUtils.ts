/**
 * Vehicle Status Classification Utilities
 * 
 * This module provides centralized logic for determining vehicle status
 * based on speed, ignition, and other telemetry data.
 */

// Speed threshold for considering vehicle as "running" (km/h)
// Vehicles moving at 0.5 km/h or more are considered to be running
export const RUNNING_SPEED_THRESHOLD = 0.5;

// Speed threshold for considering vehicle as "stopped" (km/h)
// Vehicles with speed less than 0.5 km/h are considered stopped/idle
export const STOPPED_SPEED_THRESHOLD = 0.5;

export type VehicleStatus = "running" | "idle" | "stopped" | "inactive" | "nodata";

export interface VehicleStatusParams {
  speed: number;
  ignition: boolean;
  isStale: boolean;
  hasPosition: boolean;
  movementStatus?: string;
  lifecycleStatus?: string;
}

/**
 * Determines vehicle status based on telemetry data
 * 
 * @param params Vehicle status parameters
 * @returns Vehicle status classification
 */
export function getVehicleStatus(params: VehicleStatusParams): VehicleStatus {
  const {
    speed,
    ignition,
    isStale,
    hasPosition,
    movementStatus,
    lifecycleStatus
  } = params;

  // Check for inactive status first
  if (lifecycleStatus === "inactive" || movementStatus === "inactive") {
    return "inactive";
  }

  // Check for no data
  if (isStale && !hasPosition) {
    return "nodata";
  }

  // Check for stopped status
  if (!ignition || movementStatus === "stopped") {
    return "stopped";
  }

  // Check for running status (speed >= 0.5 km/h)
  if (speed >= RUNNING_SPEED_THRESHOLD) {
    return "running";
  }

  // Default to idle if ignition is on but speed is very low
  return "idle";
}

/**
 * Checks if vehicle is considered running based on speed
 * 
 * @param speed Vehicle speed in km/h
 * @returns true if vehicle is running
 */
export function isVehicleRunning(speed: number): boolean {
  return speed >= RUNNING_SPEED_THRESHOLD;
}

/**
 * Checks if vehicle is considered stopped based on speed
 * 
 * @param speed Vehicle speed in km/h
 * @returns true if vehicle is stopped
 */
export function isVehicleStopped(speed: number): boolean {
  return speed < STOPPED_SPEED_THRESHOLD;
}

/**
 * Gets a human-readable description of the speed classification
 * 
 * @param speed Vehicle speed in km/h
 * @returns Speed classification description
 */
export function getSpeedClassification(speed: number): string {
  if (speed >= RUNNING_SPEED_THRESHOLD) {
    return `Running - ${speed.toFixed(1)} km/h`;
  } else if (speed > 0) {
    return `Moving Slowly - ${speed.toFixed(1)} km/h`;
  } else {
    return "Stopped";
  }
}
