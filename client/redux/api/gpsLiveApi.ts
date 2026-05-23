import { baseApi } from "./baseApi";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// These mirror exactly what the backend sends in GpsLiveData documents
// and in gps_update socket payloads.
// ─────────────────────────────────────────────────────────────────────────────

export type LiveGpsNode = {
  _id?: string
  imei?: string
  vehicleId?: string | { _id: string }
  gpsDeviceId?: string | { _id: string }
  organizationId?: string | { _id: string }

  // Position
  latitude?: number
  longitude?: number

  // Motion
  currentSpeed?: number
  speed?: number
  heading?: number
  movementStatus?: "running" | "idle" | "stopped" | "inactive"
  ignitionStatus?: boolean
  ignition?: boolean

  // Location enrichment — both arrive async after GPS packet
  currentLocation?: string | {
    address?: string
    addressLine?: string
    city?: string
    state?: string
    country?: string
    pincode?: string | number
  }
  poi?: string      // POI name e.g. "Main Depot", "" if none found
  poiId?: string    // MongoDB ObjectId of matched POI, null if none

  // Timestamps
  gpsTimestamp?: string
  updatedAt?: string

  // Power
  mainPowerStatus?: boolean
  mainInputVoltage?: number
  internalBatteryVoltage?: number
  batteryLevel?: number

  // Network
  gsmSignalStrength?: number
  operatorName?: string

  // Sensors
  fuelPercentage?: number
  temperature?: string

  // Device
  acStatus?: boolean
  numberOfSatellites?: number
}

// Response shape from GET /gpsLiveData
export type GetLiveVehiclesResponse = {
  status: boolean
  vehicles?: LiveGpsNode[]
  data?: LiveGpsNode[]
  total?: number
}

// Response shape from GET /gpsLiveData/device/:deviceId
export type GetLiveVehicleByDeviceIdResponse = {
  status: boolean
  data?: LiveGpsNode
  vehicle?: LiveGpsNode
}

// ─────────────────────────────────────────────────────────────────────────────
// API SLICE
// ─────────────────────────────────────────────────────────────────────────────

export const gpsLiveApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // Returns all live vehicles for the org (polled every 10s in dashboard)
    getLiveVehicles: builder.query<GetLiveVehiclesResponse, void>({
      query: () => "/gpsLiveData",
      providesTags: ["Tracking"],
    }),

    // Returns single live record for a device (polled every 5s in map view)
    getLiveVehicleByDeviceId: builder.query<GetLiveVehicleByDeviceIdResponse, string | undefined>({
      query: (deviceId) => `/gpsLiveData/device/${deviceId}`,
      providesTags: ["Tracking"],
    }),

  }),
});

export const {
  useGetLiveVehiclesQuery,
  useGetLiveVehicleByDeviceIdQuery,
} = gpsLiveApi;