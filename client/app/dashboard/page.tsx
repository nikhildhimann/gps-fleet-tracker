"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { StatusCards, VehicleStatusFilter } from "@/components/dashboard/status-cards"
import { ActionToolbar } from "@/components/dashboard/action-toolbar"
import { VehicleSidebar } from "@/components/dashboard/vehicle-sidebar"
import { MapWrapper } from "@/components/dashboard/map-wrapper"
import { VehicleDetails } from "@/components/dashboard/vehicle-details"
import { useVehiclePositions } from "@/lib/use-vehicle-positions"
import { type Vehicle } from "@/lib/vehicles"
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi"
import { useGetDriversQuery } from "@/redux/api/driversApi"
import { useGetNotificationsQuery } from "@/redux/api/notificationsApi"
import { useGetMeQuery } from "@/redux/api/usersApi"
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi"
import { useGetLiveVehiclesQuery } from "@/redux/api/gpsLiveApi"
import { useGetVehicleDailyStatsByDateQuery } from "@/redux/api/vehicleDailyStatsApi"
import { LayoutDashboard, ChevronDown } from "lucide-react"
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper"
import { useSocket } from "@/hooks/useSocket"
import { useAppDispatch, useAppSelector } from "@/redux/hooks"
import { setActiveTab, setSelectedVehicle as setReduxSelectedVehicle } from "@/redux/features/vehicleSlice"
import { useDashboardContext } from "@/components/dashboard/DashboardContext"
import { getVehicleStatus, RUNNING_SPEED_THRESHOLD } from "@/lib/vehicleStatusUtils"
import { GeofenceView } from "@/components/dashboard/modules/GeofenceView"
import { LicensingView } from "@/components/dashboard/modules/LicensingView"
import { AlertView } from "@/components/dashboard/modules/AlertView"
import { FuelView } from "@/components/dashboard/modules/FuelView"
import { TemperatureView } from "@/components/dashboard/modules/TemperatureView"
import { StatisticsView } from "@/components/dashboard/modules/analytics/StatisticsView"
import { TravelSummaryPage } from "@/components/dashboard/modules/analytics/TravelSummaryPage"
import { TripSummaryPage } from "@/components/dashboard/modules/analytics/TripSummaryPage"
import { VehicleStatusPage } from "@/components/dashboard/modules/analytics/VehicleStatusPage"
import { AlertSummaryPage } from "@/components/dashboard/modules/analytics/AlertSummaryPage"
import { DaywiseDistancePage } from "@/components/dashboard/modules/analytics/DaywiseDistancePage"
import { ACSummaryPage } from "@/components/dashboard/modules/analytics/ACSummaryPage"
import { AnalyticsHub } from "@/components/dashboard/modules/analytics/AnalyticsHub"
import { X } from "lucide-react"
import { ReportsModal } from "@/components/dashboard/modules/ReportsModal"
import { AppConfigView } from "@/components/dashboard/modules/AppConfigView"
import { SysConfigView } from "@/components/dashboard/modules/SysConfigView"

type LiveGpsItem = {
  vehicleId?: string | { _id?: string }
  gpsDeviceId?: string | { _id?: string }
  imei?: string
  _enrichmentOnly?: boolean   // ← ADD THIS
  latitude?: number
  longitude?: number
  currentSpeed?: number
  speed?: number
  ignitionStatus?: boolean
  ignition?: boolean
  movementStatus?: "running" | "idle" | "stopped" | "inactive"
  updatedAt?: string
  gpsTimestamp?: string
  currentLocation?:
  | string
  | {
    address?: string
    addressLine?: string
    city?: string
    state?: string
    country?: string
    pincode?: string | number
  }
  organizationId?: string | { _id?: string }
  mainPowerStatus?: boolean
  acStatus?: boolean
  internalBatteryVoltage?: number
  batteryLevel?: number
  numberOfSatellites?: number
  gsmSignalStrength?: number
  fuelPercentage?: number
  temperature?: string
  poi?: string
  poiId?: string | null
}

const LIVE_STALE_TIMEOUT_MS = 60 * 1000

const pickFirstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
  }
  return ""
}

const isCoordinateText = (value?: string): boolean => {
  if (!value) return false
  return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(value.trim())
}

const toLocationText = (value: unknown): string => {
  if (!value) return ""
  if (typeof value === "string") {
    const text = value.trim()
    return isCoordinateText(text) ? "" : text
  }
  if (typeof value === "object") {
    const loc = value as {
      address?: string
      addressLine?: string
      city?: string
      state?: string
      country?: string
      pincode?: string | number
    }
    const direct = pickFirstString(loc.address, loc.addressLine)
    if (direct) return isCoordinateText(direct) ? "" : direct
    const parts = [loc.city, loc.state, loc.country, loc.pincode ? String(loc.pincode) : ""].filter(Boolean)
    return parts.join(", ")
  }
  return ""
}

const serializeLocationValue = (value: unknown): string => {
  if (!value) return ""
  if (typeof value === "string") return value.trim()
  try {
    return JSON.stringify(value)
  } catch {
    return ""
  }
}

const formatCoordinateText = (latitude?: number | null, longitude?: number | null): string => {
  if (typeof latitude !== "number" || typeof longitude !== "number") return ""
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return ""
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: vehData } = useGetVehiclesQuery({ page: 0, limit: 1000 })
  const { data: liveData } = useGetLiveVehiclesQuery(undefined, {
    pollingInterval: 10000,
    refetchOnMountOrArgChange: true,
    refetchOnReconnect: true,
  })
  const { data: notifData } = useGetNotificationsQuery(undefined, {
    pollingInterval: 60000,
    refetchOnMountOrArgChange: true,
  })
  const { data: driversData } = useGetDriversQuery({ page: 0, limit: 1000 }, {
    refetchOnMountOrArgChange: true,
  })
  const { data: meData } = useGetMeQuery(undefined)
  const { data: orgData } = useGetOrganizationsQuery({ page: 0, limit: 1000 })
  const dispatch = useAppDispatch()
  const { selectedVehicleId: reduxSelectedVehicleId, activeTab } = useAppSelector((state) => state.vehicle)
  const { selectedVehicle, setSelectedVehicle, bumpFocusKey } = useDashboardContext()

  const [liveByVehicleId, setLiveByVehicleId] = useState<Record<string, LiveGpsItem>>({})
  const [uiVehicles, setUiVehicles] = useState<Vehicle[]>([])
  const positions = useVehiclePositions(uiVehicles)
  const [isAuthed, setIsAuthed] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  const [mobileView, setMobileView] = useState<"list" | "map">("list")
  const [statusFilter, setStatusFilter] = useState<VehicleStatusFilter>("total")
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all")
  const [isOrgOpen, setIsOrgOpen] = useState(false)
  const [clockMs, setClockMs] = useState(() => Date.now())
  const [showReportsModal, setShowReportsModal] = useState(false)
  const user = meData?.data
  const rawOrgId = user?.organizationId?._id || user?.organizationId || ""
  const organizationIdParam = searchParams.get("organizationId")
  const assignedVehicleId = user?.assignedVehicleId?._id || user?.assignedVehicleId || ""
  const userOrgId = rawOrgId || organizationIdParam || null
  const organizations = useMemo(() => orgData?.organizations || orgData?.data || [], [orgData])
  const allVehicles = useMemo(() => vehData?.vehicles || vehData?.data || [], [vehData])
  const liveVehicles = useMemo(() => liveData?.vehicles || liveData?.data || [], [liveData])
  const alerts = useMemo(() => notifData?.data || [], [notifData])
  const drivers = useMemo(() => driversData?.drivers || driversData?.data || [], [driversData])
  const toRefId = useCallback((value: any) => {
    if (!value) return ""
    if (typeof value === "string") return value
    return value?._id || ""
  }, [])
  const driverById = useMemo(() => {
    const map = new Map<string, any>()
    drivers.forEach((driver: any) => {
      const id = toRefId(driver?._id)
      if (id) map.set(id, driver)
    })
    return map
  }, [drivers, toRefId])
  const driverByVehicleId = useMemo(() => {
    const map = new Map<string, any>()
    drivers.forEach((driver: any) => {
      const vehicleId = toRefId(driver?.assignedVehicleId)
      if (vehicleId) map.set(vehicleId, driver)
    })
    return map
  }, [drivers, toRefId])
  const notificationCount = useMemo(
    () => alerts.filter((item: any) => item?.acknowledged === false).length,
    [alerts],
  )

  const toVehicleId = (liveItem: LiveGpsItem) => {
    if (typeof liveItem.vehicleId === "string") return liveItem.vehicleId
    return liveItem.vehicleId?._id || null
  }
  const toGpsDeviceId = (liveItem: LiveGpsItem) => {
    if (typeof liveItem.gpsDeviceId === "string") return liveItem.gpsDeviceId
    return liveItem.gpsDeviceId?._id || null
  }
  const toOrganizationId = (liveItem: LiveGpsItem) => {
    if (typeof liveItem.organizationId === "string") return liveItem.organizationId
    return liveItem.organizationId?._id || null
  }
  const toLiveKey = (liveItem: LiveGpsItem) => {
    return toVehicleId(liveItem) || liveItem.imei || toGpsDeviceId(liveItem) || null
  }

const handleGpsUpdate = useCallback((update: LiveGpsItem) => {
  const key = toLiveKey(update)
  if (!key) return

  // CRITICAL: Enrichment-only packets must NEVER overwrite position data.
  // They carry stale coordinates (up to 30s old) which cause backward snapping.
  // Only merge address/poi fields and leave lat/lng/speed/status untouched.
  if (update._enrichmentOnly) {
    setLiveByVehicleId((prev) => {
      const existing = prev[key]
      if (!existing) return prev
      const prevPoi   = existing.poi   || ""
      const prevPoiId = existing.poiId || null
      const prevLoc   = serializeLocationValue(existing.currentLocation)
      const nextPoi   = update.poi   ?? prevPoi
      const nextPoiId = update.poiId ?? prevPoiId
      const nextLoc   = serializeLocationValue(update.currentLocation || existing.currentLocation)
      // Skip re-render if nothing changed
      if (prevPoi === nextPoi && prevPoiId === nextPoiId && prevLoc === nextLoc) {
        return prev
      }
      return {
        ...prev,
        [key]: {
          ...existing,
          currentLocation: update.currentLocation || existing.currentLocation,
          poi:   nextPoi,
          poiId: nextPoiId,
        },
      }
    })
    return
  }

setLiveByVehicleId((prev) => {
    const existing = prev[key] || {}

    // Null lat/lng ko ignore karo — purani valid position rakhho
    const safeLatitude =
      update.latitude != null ? update.latitude : existing.latitude
    const safeLongitude =
      update.longitude != null ? update.longitude : existing.longitude

    const nextValue = {
      ...existing,
      ...update,
      latitude: safeLatitude,
      longitude: safeLongitude,
    }
      const prevValue = prev[key]
      if (
        prevValue &&
        prevValue.updatedAt === nextValue.updatedAt &&
        prevValue.gpsTimestamp === nextValue.gpsTimestamp &&
        prevValue.latitude === nextValue.latitude &&
        prevValue.longitude === nextValue.longitude &&
        prevValue.currentSpeed === nextValue.currentSpeed &&
        prevValue.speed === nextValue.speed &&
        prevValue.movementStatus === nextValue.movementStatus &&
        prevValue.ignitionStatus === nextValue.ignitionStatus &&
        prevValue.ignition === nextValue.ignition &&
        serializeLocationValue(prevValue.currentLocation) === serializeLocationValue(nextValue.currentLocation) &&
        (prevValue.poi || "") === (nextValue.poi || "") &&
        (prevValue.poiId || null) === (nextValue.poiId || null)
      ) {
        return prev
      }
      return {
        ...prev,
        [key]: nextValue,
      }
    })
  }, [])

  const { socket } = useSocket("gps_update", handleGpsUpdate)

  useEffect(() => {
    if (!socket) return

    const orgIds = new Set<string>()
    liveVehicles.forEach((item: LiveGpsItem) => {
      const orgId = toOrganizationId(item)
      if (orgId) orgIds.add(orgId)
    })

    const joinRooms = () => {
      orgIds.forEach((orgId) => {
        socket.emit("join_organization", orgId)
      })
    }

    joinRooms()

    // Reconnect pe dobara join karo
    socket.on("connect", joinRooms)
    socket.on("__reconnected__", joinRooms)

    return () => {
      socket.off("connect", joinRooms)
      socket.off("__reconnected__", joinRooms)
      orgIds.forEach((orgId) => socket.emit("leave_organization", orgId))
    }
  }, [liveVehicles, socket])

  useEffect(() => {
    if (!liveVehicles.length) return

    setLiveByVehicleId((prev) => {
      const next = { ...prev }
      let changed = false
      liveVehicles.forEach((item: LiveGpsItem) => {
        const key = toLiveKey(item)
        if (!key) return

        const prevValue = prev[key]
        if (
          prevValue &&
          prevValue.updatedAt === item.updatedAt &&
          prevValue.gpsTimestamp === item.gpsTimestamp &&
          prevValue.latitude === item.latitude &&
          prevValue.longitude === item.longitude &&
          prevValue.currentSpeed === item.currentSpeed &&
          prevValue.speed === item.speed &&
          prevValue.movementStatus === item.movementStatus &&
          prevValue.ignitionStatus === item.ignitionStatus &&
          prevValue.ignition === item.ignition &&
          serializeLocationValue(prevValue.currentLocation) === serializeLocationValue(item.currentLocation) &&
          (prevValue.poi || "") === (item.poi || "") &&
          (prevValue.poiId || null) === (item.poiId || null)
        ) {
          return
        }

        next[key] = item
        changed = true
      })
      return changed ? next : prev
    })
  }, [liveVehicles])

  useEffect(() => {
    const token = getSecureItem("token")
    const userRole = getSecureItem("userRole")
    setUserRole(userRole)

    if (!token) {
      router.replace("/")
      return
    }

    // Allow manager, admin, and driver to access dashboard
    if (userRole && ["manager", "admin", "driver"].includes(userRole)) {
      setIsAuthed(true)
    } else {
      router.replace("/")
    }
  }, [router])

  // Handle click outside for custom dropdown
  useEffect(() => {
    if (!isOrgOpen) return
    const handler = () => setIsOrgOpen(false)
    window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [isOrgOpen])

  useEffect(() => {
    const interval = setInterval(() => {
      setClockMs(Date.now())
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (organizationIdParam) {
      setSelectedOrgId(organizationIdParam)
    } else if (userRole === "manager" && user?.organizationId?._id) {
      setSelectedOrgId(user.organizationId._id)
    }
  }, [organizationIdParam, userRole, user?.organizationId?._id])

  useEffect(() => {
    setUiVehicles((previous) => {
      const prevRouteMap = new Map(previous.map((item) => [item.id, item.route]))
      const prevLocationMap = new Map(previous.map((item) => [item.id, item.location || ""]))
      const seenIds = new Set<string>()

      const nextVehicles = (allVehicles as any[]).map((vehicle: any) => {
        const vehicleLiveKey = vehicle._id || vehicle.deviceImei || null
        const live = (vehicleLiveKey ? liveByVehicleId[vehicleLiveKey] : null) || null

        const lat = live?.latitude
        const lng = live?.longitude
        const hasLivePosition = typeof lat === "number" && typeof lng === "number"
        const hasVehiclePosition =
          typeof vehicle?.currentLocation?.latitude === "number" &&
          typeof vehicle?.currentLocation?.longitude === "number"

        const latestPoint = hasLivePosition
          ? { lat: lat as number, lng: lng as number }
          : hasVehiclePosition
            ? {
              lat: vehicle.currentLocation.latitude,
              lng: vehicle.currentLocation.longitude,
            }
            : null

        const oldRoute = prevRouteMap.get(vehicle._id) || []
        let route = oldRoute.length ? oldRoute : latestPoint ? [latestPoint] : [{ lat: 20.5937, lng: 78.9629 }]

        if (latestPoint) {
          const last = route[route.length - 1]
          const changed = !last || last.lat !== latestPoint.lat || last.lng !== latestPoint.lng
          if (changed) route = [...route, latestPoint].slice(-30)
        }

        const lastSeenSource = live?.updatedAt || live?.gpsTimestamp || vehicle.updatedAt || null
        const lastSeenMs = lastSeenSource ? new Date(lastSeenSource).getTime() : NaN
        const isStale = Number.isFinite(lastSeenMs) ? clockMs - lastSeenMs > LIVE_STALE_TIMEOUT_MS : true

        const runningStatus = String(live?.movementStatus || vehicle.runningStatus || "").toLowerCase()
        const lifecycleStatus = String(vehicle.status || "").toLowerCase()

        // Prioritize live ignition data, fallback to runningStatus logic only if no live data
        const ignition = Boolean(
          live?.ignitionStatus ??
          live?.ignition ??
          (live && (live.speed || live.currentSpeed || 0) > 0) ??
          (runningStatus === "running" || runningStatus === "idle")
        )
        const rawSpeed = Number(live?.currentSpeed ?? live?.speed ?? vehicle.currentSpeed ?? 0)
        const speed = isStale || !ignition ? 0 : Number.isFinite(rawSpeed) ? rawSpeed : 0

        let status: Vehicle["status"] = "nodata"
        // Only mark as inactive if we have no recent live data
        if (lifecycleStatus === "inactive" && isStale && !hasLivePosition) {
          status = "inactive"
        } else if (isStale && !hasLivePosition && !hasVehiclePosition) {
          status = "nodata"
        } else if (!ignition) {
          status = "stopped"
        } else if (speed >= RUNNING_SPEED_THRESHOLD) {
          status = "running"
        } else {
          status = "idle"
        }

        const power = Boolean(live?.mainPowerStatus ?? ignition)
        const ac = Boolean(live?.acStatus && ignition) // AC can only be ON when ignition is ON
        const coordinateLocation = hasLivePosition
          ? formatCoordinateText(lat as number, lng as number)
          : hasVehiclePosition
            ? formatCoordinateText(
              vehicle.currentLocation.latitude,
              vehicle.currentLocation.longitude,
            )
            : ""
        const hasResolvedPoi =
          (live ? Object.prototype.hasOwnProperty.call(live, "poi") : false) ||
          Object.prototype.hasOwnProperty.call(vehicle || {}, "poi")
        const resolvedPoi =
          pickFirstString(live?.poi, vehicle.poi) ||
          ((hasLivePosition || hasVehiclePosition) ? (hasResolvedPoi ? "-" : "Resolving POI...") : "-")
        const previousResolvedLocation = toLocationText(prevLocationMap.get(vehicle._id))
        const location =
          toLocationText(live?.currentLocation) ||
          toLocationText(vehicle?.currentLocation) ||
          previousResolvedLocation ||
          (hasLivePosition || hasVehiclePosition ? "Resolving address..." : "Unknown")
        const dateSource = live?.updatedAt || live?.gpsTimestamp || vehicle.updatedAt
        const date = dateSource
          ? new Date(dateSource).toLocaleString("en-GB").replace(",", "")
          : "N/A"
        const vehicleDriverId = toRefId(vehicle.driverId)
        const driverFromVehicleId = vehicleDriverId ? driverById.get(vehicleDriverId) : null
        const driverFromAssignedVehicle = driverByVehicleId.get(vehicle._id) || null
        const driverData =
          (vehicle.driverId && typeof vehicle.driverId === "object" ? vehicle.driverId : null) ||
          driverFromVehicleId ||
          driverFromAssignedVehicle
        const driverFirstName = pickFirstString(driverData?.firstName)
        const driverLastName = pickFirstString(driverData?.lastName)
        const driverName = pickFirstString(
          `${driverFirstName} ${driverLastName}`.trim(),
          driverData?.name,
          driverData?.fullName,
          vehicle?.driverName,
        )
        const driverPhone = pickFirstString(
          driverData?.phone,
          driverData?.mobile,
          driverData?.phoneNumber,
          driverData?.contactNumber,
          driverData?.telephone,
          driverData?.cellNumber,
          vehicle?.driverPhone,
          vehicle?.phone,
          vehicle?.contactNumber,
        )
        const driverEmail = pickFirstString(
          driverData?.email,
          driverData?.mail,
          driverData?.emailAddress,
          driverData?.emailId,
          vehicle?.driverEmail,
          vehicle?.email,
          vehicle?.emailAddress,
        )
        const driverLicense = pickFirstString(
          driverData?.licenseNumber,
          driverData?.licenseNo,
          driverData?.drivingLicenseNumber,
          driverData?.dlNumber,
          driverData?.drivingLicense,
          driverData?.license,
          vehicle?.licenseNumber,
          vehicle?.driverLicenseNumber,
          vehicle?.drivingLicense,
        )
        const driverAddress = pickFirstString(
          driverData?.address,
          driverData?.fullAddress,
          driverData?.residentialAddress,
          driverData?.homeAddress,
          driverData?.currentAddress,
          vehicle?.driverAddress,
          vehicle?.address,
          vehicle?.fullAddress
        ) || "N/A"
        const hasDriverDetails = Boolean(
          driverData ||
          vehicle?.driverName ||
          vehicle?.driverPhone ||
          vehicle?.driverEmail ||
          vehicle?.licenseNumber ||
          driverPhone !== "N/A" ||
          driverEmail !== "N/A" ||
          driverLicense !== "N/A" ||
          driverAddress !== "N/A"
        )

        const row = {
          id: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber || vehicle.registrationNumber || vehicle._id,
          organizationId: vehicle.organizationId?._id || vehicle.organizationId,
          driver: driverName || "Unassigned",
          driverDetails: {
            firstName: driverFirstName || "N/A",
            lastName: driverLastName || "N/A",
            phone: driverPhone || "N/A",
            email: driverEmail || "N/A",
            licenseNumber: driverLicense || "N/A",
            address: driverAddress || "N/A",
            hasData: hasDriverDetails
          },
          date,
          speed,
          status,
          ign: ignition,
          ac,
          pw: power,
          gps: hasLivePosition || hasVehiclePosition,
          location,
          poi: resolvedPoi,
          poiId: live?.poiId ?? (vehicle.poiId as string | null | undefined) ?? null,
          route,
          batteryVoltage: live?.internalBatteryVoltage ?? null,
          batteryPercent: live?.batteryLevel ?? null,
          satelliteCount: live?.numberOfSatellites ?? null,
          gsmSignal: live?.gsmSignalStrength ?? null,
          imei: vehicle.imei || vehicle.deviceImei,
          deviceImei: vehicle.deviceImei,
          registrationNumber: vehicle.registrationNumber || vehicle.vehicleNumber,
          make: vehicle.make,
          model: vehicle.model,
          color: vehicle.color,
          year: vehicle.year,
          vehicleType: vehicle.vehicleType,
          fuel: live?.fuelPercentage ?? null,
          temperature: live?.temperature ?? null,
          ais140Compliant: vehicle.ais140Compliant || false,
        } as Vehicle

        seenIds.add(row.id)
        return row
      })

      // Fallback rows from live packets when vehicle master/mapping is missing.
      Object.entries(liveByVehicleId).forEach(([key, live]) => {
        if (!live) return
        const vehicleId = toVehicleId(live)
        if (vehicleId && seenIds.has(vehicleId)) return
        if (!vehicleId && seenIds.has(key)) return

        const lat = live.latitude
        const lng = live.longitude
        const hasPoint = typeof lat === "number" && typeof lng === "number"
        if (!hasPoint) return

        const rowId = vehicleId || key
        const oldRoute = prevRouteMap.get(rowId) || []
        const latestPoint = { lat: lat as number, lng: lng as number }
        const last = oldRoute[oldRoute.length - 1]
        const changed = !last || last.lat !== latestPoint.lat || last.lng !== latestPoint.lng
        const route =
          oldRoute.length > 0
            ? changed
              ? [...oldRoute, latestPoint].slice(-30)
              : oldRoute
            : [latestPoint]

        const movement = String(live.movementStatus || "").toLowerCase()
        const liveTs = live.updatedAt || live.gpsTimestamp || null
        const liveMs = liveTs ? new Date(liveTs).getTime() : NaN
        const isStale = Number.isFinite(liveMs) ? clockMs - liveMs > LIVE_STALE_TIMEOUT_MS : true

        // Prioritize live ignition data, fallback to movement status only if no live data
        const ignition = Boolean(
          live.ignitionStatus ??
          live.ignition ??
          (live && (live.speed || live.currentSpeed || 0) > 0) ??
          (movement === "running" || movement === "idle")
        )
        const rawSpeed = Number(live.currentSpeed ?? live.speed ?? 0)
        const speed = isStale || !ignition ? 0 : Number.isFinite(rawSpeed) ? rawSpeed : 0
        let status: Vehicle["status"] = "nodata"
        // Only mark as inactive if we have no recent live data
        if (movement === "inactive" && isStale && !hasPoint) {
          status = "inactive"
        } else if (isStale && !hasPoint) {
          status = "nodata"
        } else if (!ignition) {
          status = "stopped"
        } else if (speed >= RUNNING_SPEED_THRESHOLD) {
          status = "running"
        } else {
          status = "idle"
        }

        nextVehicles.push({
          id: rowId,
          vehicleNumber: live.imei || rowId,
          organizationId: toOrganizationId(live) || undefined,
          driver: "Unassigned",
          driverDetails: {
            firstName: "N/A",
            lastName: "N/A",
            phone: "N/A",
            email: "N/A",
            licenseNumber: "N/A",
            address: "N/A",
            hasData: false
          },
          date:
            live.updatedAt || live.gpsTimestamp
              ? new Date((live.updatedAt || live.gpsTimestamp) as string).toLocaleString("en-GB").replace(",", "")
              : "N/A",
          speed,
          status,
          ign: ignition,
          ac: Boolean(live.acStatus && ignition), // AC can only be ON when ignition is ON
          pw: Boolean(live.mainPowerStatus ?? ignition),
          gps: true,
          location:
            toLocationText(live.currentLocation) ||
            toLocationText(prevLocationMap.get(rowId)) ||
            "Resolving address...",
          poi:
            pickFirstString(live.poi) ||
            (Object.prototype.hasOwnProperty.call(live, "poi") ? "-" : "Resolving POI..."),
          poiId: live?.poiId ?? null,
          route,
          batteryVoltage: live?.internalBatteryVoltage ?? null,

          batteryPercent: live?.batteryLevel ?? null,
          satelliteCount: live?.numberOfSatellites ?? null,
          gsmSignal: live?.gsmSignalStrength ?? null,
          fuel: live?.fuelPercentage ?? null,
          temperature: live?.temperature ?? null,
        })
      })

      const filtered = nextVehicles.filter((vehicle) => {
        if (userRole === "driver" && assignedVehicleId && vehicle.id !== assignedVehicleId) return false
        if (selectedOrgId !== "all" && selectedOrgId && vehicle.organizationId !== selectedOrgId) return false
        return true
      })

      const same =
        previous.length === filtered.length &&
        previous.every((prevVehicle, index) => {
          const nextVehicle = filtered[index]
          if (!nextVehicle) return false
          const prevLast = prevVehicle.route[prevVehicle.route.length - 1]
          const nextLast = nextVehicle.route[nextVehicle.route.length - 1]
          return (
            prevVehicle.id === nextVehicle.id &&
            prevVehicle.status === nextVehicle.status &&
            prevVehicle.speed === nextVehicle.speed &&
            prevVehicle.date === nextVehicle.date &&
            prevVehicle.gps === nextVehicle.gps &&
            prevVehicle.location === nextVehicle.location &&
            prevVehicle.poi === nextVehicle.poi &&
            prevLast?.lat === nextLast?.lat &&
            prevLast?.lng === nextLast?.lng &&
            prevVehicle.route.length === nextVehicle.route.length
          )
        })

      return same ? previous : filtered
    })
  }, [allVehicles, liveByVehicleId, userRole, assignedVehicleId, selectedOrgId, clockMs, driverById, driverByVehicleId, toRefId])

  const currentVehicleSelection = selectedVehicle || uiVehicles.find((vehicle) => vehicle.id === reduxSelectedVehicleId) || uiVehicles[0] || null
  const currentVehicleId = currentVehicleSelection?.id || null
  const todayDate = useMemo(() => {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }, [])
  const { data: dailyStatsRes } = useGetVehicleDailyStatsByDateQuery(
    {
      vehicleId: currentVehicleId || "",
      date: todayDate,
    },
    {
      skip: !currentVehicleId,
      refetchOnMountOrArgChange: true,
      pollingInterval: 30000,
    },
  )
  const dailyStats = dailyStatsRes?.data || null

  // Auto-select first vehicle on load so map centers immediately
  useEffect(() => {
    if (uiVehicles.length === 0) return
    if (reduxSelectedVehicleId || selectedVehicle) return
    const first = uiVehicles[0]
    dispatch(setReduxSelectedVehicle(first.id))
    setSelectedVehicle(first)
    bumpFocusKey()
  }, [uiVehicles, reduxSelectedVehicleId, selectedVehicle, dispatch, setSelectedVehicle, bumpFocusKey])

  // Keep context selection in sync when redux id changes (e.g., sidebar click)
  useEffect(() => {
    if (!reduxSelectedVehicleId) return
    const found = uiVehicles.find((v) => v.id === reduxSelectedVehicleId) || null
    setSelectedVehicle(found)
  }, [reduxSelectedVehicleId, uiVehicles, setSelectedVehicle])

  if (!isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f7f1] text-slate-500">
        Checking session...
      </div>
    )
  }

  const handleVehicleCreated = (created: any) => {
    const basePoint = { lat: 28.62, lng: 76.93 }
    const vehicleNumber =
      created?.vehicleNumber || created?.registrationNumber || `VEH-${Date.now()}`
    const driverName = created?.driverName || "Unassigned"
    const timestamp = new Date().toLocaleString("en-GB").replace(",", "")

    setUiVehicles((prev) => {
      const offset = (prev.length + 1) * 0.001
      const route = Array.from({ length: 5 }).map((_, index) => ({
        lat: basePoint.lat + offset + index * 0.0003,
        lng: basePoint.lng + offset + index * 0.0003,
      }))
      return [
        ...prev,
        {
          id: created?._id || vehicleNumber,
          vehicleNumber,
          driver: driverName,
          date: timestamp,
          speed: 0,
          status: "stopped",
          ign: false,
          ac: false,
          pw: false,
          gps: false,
          location: "Unknown",
          poi: "-",
          route,
        },
      ]
    })
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#f3f7f1] font-sans text-slate-900">
      <Header
        vehicleSummary={{
          label: currentVehicleSelection?.vehicleNumber || "Vehicle",
          speed: currentVehicleSelection?.speed || 0,
        }}
      />

      {userRole === "admin" && (
        <div className="border-b border-[#d8e6d2] bg-[#f7fbf5] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-[#d8e6d2] bg-white px-4 py-2 text-xs font-semibold text-slate-700">
              Organizations: <span className="text-[#2f8d35]">{organizations.length}</span>
            </div>
            <div className="rounded-2xl border border-[#d8e6d2] bg-white px-4 py-2 text-xs font-semibold text-slate-700">
              Vehicles: <span className="text-[#2f8d35]">{allVehicles.length}</span>
            </div>
            <div className="ml-auto flex-1 max-w-xs relative" onClick={(e) => e.stopPropagation()}>
              <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Select Organization</label>
              <div className="relative">
                <button
                  onClick={() => setIsOrgOpen(!isOrgOpen)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#d8e6d2] bg-white px-4 py-3 text-xs font-bold text-slate-700 transition-all hover:border-[#38a63c]/30 hover:bg-[#f7fbf5] active:scale-[0.98]"
                >
                  <LayoutDashboard size={14} className={isOrgOpen ? "text-[#38a63c]" : "text-slate-400"} />
                  <span className="flex-1 text-left truncate">
                    {selectedOrgId === "all" ? "All Organizations" : organizations.find((o: any) => o._id === selectedOrgId)?.name || "Organization"}
                  </span>
                  <ChevronDown size={14} className={`text-slate-500 transition-transform duration-200 ${isOrgOpen ? "rotate-180 text-[#38a63c]" : ""}`} />
                </button>

                {isOrgOpen && (
                  <div className="absolute top-full right-0 z-50 mt-2 max-h-60 w-full min-w-[200px] overflow-y-auto rounded-2xl border border-[#d8e6d2] bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-1.5">
                      <button
                        onClick={() => { setSelectedOrgId("all"); setIsOrgOpen(false); }}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${selectedOrgId === "all" ? "bg-[#ecf8ea] text-[#2f8d35]" : "text-slate-600 hover:bg-[#f5faf3]"}`}
                      >
                        All Organizations
                      </button>
                      <div className="my-1 h-px bg-[#edf3e8]" />
                      {organizations.map((org: any) => (
                        <button
                          key={org._id}
                          onClick={() => { setSelectedOrgId(org._id); setIsOrgOpen(false); }}
                          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${selectedOrgId === org._id ? "bg-[#ecf8ea] text-[#2f8d35]" : "text-slate-600 hover:bg-[#f5faf3]"}`}
                        >
                          {org.name || "Organization"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {userRole === "driver" && (
        <div className="border-b border-[#d8e6d2] bg-[#f7fbf5] px-4 py-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
            <div className="rounded-full border border-[#d8e6d2] bg-white px-3 py-1 font-semibold">
              Driver: {user?.firstName || "Driver"} {user?.lastName || ""}
            </div>
            <div className="rounded-full border border-[#d8e6d2] bg-white px-3 py-1">
              {user?.email || "no-email"}
            </div>
            <div className="rounded-full border border-[#38a63c]/30 bg-[#ecf8ea] px-3 py-1 text-[#2f8d35]">
              Vehicle: {user?.assignedVehicleId?.vehicleNumber || uiVehicles[0]?.vehicleNumber || "Unassigned"}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Tracking" && (
        <div className="shrink-0 border-b border-[#d8e6d2] bg-[#f3f7f1]">
          <StatusCards
            vehicles={uiVehicles}
            activeFilter={statusFilter}
            onFilterChange={(filter) => {
              setStatusFilter(filter)
              dispatch(setReduxSelectedVehicle(null))
              setSelectedVehicle(null)
            }}
          />
          {/* Mobile View Switcher */}
          <div className="flex border-t border-[#dbe7d4] lg:hidden">
            <button
              onClick={() => setMobileView("list")}
              className={`flex-1 py-3 text-xs font-bold transition-colors ${mobileView === "list" ? "border-b-2 border-[#38a63c] bg-[#ecf8ea] text-[#2f8d35]" : "text-slate-500 hover:bg-[#f7fbf5]"}`}
            >
              LIST VIEW
            </button>
            <button
              onClick={() => setMobileView("map")}
              className={`flex-1 py-3 text-xs font-bold transition-colors ${mobileView === "map" ? "border-b-2 border-[#38a63c] bg-[#ecf8ea] text-[#2f8d35]" : "text-slate-500 hover:bg-[#f7fbf5]"}`}
            >
              MAP VIEW
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === "Tracking" ? (
          <>
            <div className="grid flex-1 min-h-[650px] grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:overflow-hidden">
              {/* Sidebar Area (Left ~40%) */}
              <div className={`${mobileView === "list" ? "flex" : "hidden"} lg:flex lg:col-span-5 xl:col-span-4 flex-col min-h-[460px] overflow-hidden rounded-[28px] border border-[#d8e6d2] bg-white shadow-sm lg:h-full`}>
                <VehicleSidebar
                  vehicles={uiVehicles}
                  selectedId={reduxSelectedVehicleId || currentVehicleId}
                  onSelect={(id) => {
                    const nextId = id
                    dispatch(setReduxSelectedVehicle(nextId))
                    const found = uiVehicles.find((v) => v.id === nextId) || null
                    setSelectedVehicle(found)
                    bumpFocusKey()
                    if (window.innerWidth < 1024) setMobileView("map")
                  }}
                  isFullWidth={true}
                  statusFilter={statusFilter}
                />
              </div>

              {/* Map Area (Right ~60%) */}
              <div className={`${mobileView === "map" ? "flex" : "hidden md:flex"} lg:flex lg:col-span-7 xl:col-span-8 flex-col min-h-[620px] overflow-hidden rounded-[28px] border border-[#d8e6d2] bg-white shadow-sm lg:h-full lg:min-h-[700px]`}>
                <ActionToolbar compact onReportsClick={() => setShowReportsModal(true)} />
                <div className="flex-1 min-h-0">
                  <MapWrapper />
                </div>
              </div>
            </div>

            {currentVehicleSelection && (
              <div className="border-t border-[#d8e6d2] bg-[#f3f7f1] p-4 z-40">
                <div className="grid grid-cols-1 gap-2">
                  <div className="min-h-0 overflow-x-auto">
                    <VehicleDetails
                      vehicleId={currentVehicleId}
                      positions={positions}
                      vehicles={uiVehicles}
                      selectedVehicleObj={currentVehicleSelection}
                      dailyStats={dailyStats}
                      alerts={alerts}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-auto bg-white">
            <div className="relative h-full flex flex-col">
              {/* Report Header (matching Figma Image 2 but integrated) */}
              <div className="flex items-center justify-between border-b border-[#d8e6d2] px-6 py-2 bg-[#fcfdfc]">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2f8d35]">{activeTab}</p>
                <button
                  onClick={() => dispatch(setActiveTab("Tracking"))}
                  className="rounded-full bg-white border border-[#d8e6d2] p-1.5 text-slate-400 shadow-sm transition-colors hover:bg-[#edf3e8] hover:text-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                {activeTab === "Geofences" && <GeofenceView />}
                {activeTab === "Licensing" && <LicensingView />}
                {activeTab === "Alerts" && <AlertView />}
                {activeTab === "Fuel" && <FuelView />}
                {activeTab === "Temperature" && <TemperatureView />}
                {activeTab === "Intelligence Hub" && <AnalyticsHub />}
                {activeTab === "Analytics" && <StatisticsView />}
                {activeTab === "Statistics" && <StatisticsView />}
                {activeTab === "App Config" && <AppConfigView />}
                {activeTab === "Sys Config" && <SysConfigView />}
                {activeTab === "Daywise Distance" && <DaywiseDistancePage organizations={organizations} vehicles={allVehicles} userRole={userRole} userOrgId={userOrgId} />}
                {activeTab === "Travel Summary" && <TravelSummaryPage organizations={organizations} vehicles={allVehicles} userRole={userRole} userOrgId={userOrgId} />}
                {activeTab === "Trip Summary" && <TripSummaryPage organizations={organizations} vehicles={allVehicles} userRole={userRole} userOrgId={userOrgId} />}
                {activeTab === "Vehicle Status" && <VehicleStatusPage organizations={organizations} vehicles={uiVehicles} userRole={userRole} userOrgId={userOrgId} />}
                {activeTab === "Alert Summary" && <AlertSummaryPage organizations={organizations} vehicles={allVehicles} userRole={userRole} userOrgId={userOrgId} />}
                {activeTab === "AC Summary" && <ACSummaryPage organizations={organizations} vehicles={allVehicles} userRole={userRole} userOrgId={userOrgId} />}
                {["Tour", "User Rights"].includes(activeTab) && (
                  <div className="flex h-64 flex-col items-center justify-center italic text-slate-500">
                    <LayoutDashboard className="mb-4 h-12 w-12 opacity-20" />
                    {activeTab} module is coming soon...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reports Modal */}
      <ReportsModal 
        isOpen={showReportsModal} 
        onClose={() => setShowReportsModal(false)} 
      />
    </div>
  )
}
