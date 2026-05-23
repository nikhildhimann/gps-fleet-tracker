"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Clock,
  Gauge,
  Loader2,
  MapPin,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  User,
  Phone,
  Mail,
  FileText,
  X,
  ZoomIn,
} from "lucide-react";
import { MapContainer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import type { LatLngExpression, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import { toast } from "sonner";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";
import { useGetVehicleHistoryQuery } from "@/redux/api/gpsHistoryApi";
import { useGetVehicleDriverMappingsQuery } from "@/redux/api/vehicleDriverMappingApi";
import { Button } from "@/components/ui/button";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import MapTileLayer from "@/components/admin/Map/MapTileLayer";

type HistoryPoint = {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  ignition: boolean;
  address: string;
  alertType: string;
  heading: number;
};

type LatLng = { lat: number; lng: number };

type VehicleOption = {
  _id: string;
  vehicleNumber?: string;
  registrationNumber?: string;
  plateNumber?: string;
  name?: string;
  model?: string;
  make?: string;
  vehicleType?: string;
  imei?: string;
  deviceImei?: string;
  status?: string;
  organizationId?: string | { _id?: string; name?: string };
  driverId?: string | {
    _id?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    licenseNumber?: string;
    address?: string;
  };
};

type RawHistoryPoint = {
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  lon?: number | string;
  gpsTimestamp?: string;
  receivedAt?: string;
  timestamp?: string;
  speed?: number | string;
  ignitionStatus?: boolean;
  ignition?: boolean;
  address?: string;
  alertType?: string;
  alertIdentifier?: string;
  alertId?: number | string;
  packetType?: string;
  emergencyStatus?: boolean;
  tamperAlert?: string;
  heading?: number | string;
  course?: number | string;
};

const formatSeconds = (sec?: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

type VehicleDriverMapping = {
  vehicleId?:
  | string
  | {
    _id?: string;
  };
  driverId?:
  | string
  | {
    _id?: string;
    firstName?: string;
    lastName?: string;
  };
};

const ALERT_SPEED_THRESHOLD_KMH = 80;
const INDIA_DEFAULT_CENTER: LatLngExpression = [20.5937, 78.9629];

const clampIndex = (index: number, length: number) => {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceMeters = (a: LatLng, b: LatLng) => {
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return earthRadius * c;
};

const normalizeCoordinatePair = (lat: number, lng: number): LatLng | null => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Fix lat/lng swapped payloads (common data issue in mixed integrations)
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    const swapped = { lat: lng, lng: lat };
    if (Math.abs(swapped.lat) <= 90 && Math.abs(swapped.lng) <= 180) return swapped;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

const getVehicleId = (value: VehicleDriverMapping["vehicleId"]) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return typeof value._id === "string" ? value._id : "";
};

const formatDriverName = (driver: VehicleDriverMapping["driverId"] | VehicleOption["driverId"]) => {
  if (!driver) return "";
  if (typeof driver === "string") return "";
  const first = typeof driver.firstName === "string" ? driver.firstName.trim() : "";
  const last = typeof driver.lastName === "string" ? driver.lastName.trim() : "";
  return `${first} ${last}`.trim();
};

const inferAlertType = (item: RawHistoryPoint) => {
  if (typeof item.alertType === "string" && item.alertType.trim()) return item.alertType.trim();
  if (typeof item.alertIdentifier === "string" && item.alertIdentifier.trim()) return item.alertIdentifier.trim();

  if (typeof item.packetType === "string" && item.packetType.trim() && item.packetType !== "NR") {
    return item.packetType.trim();
  }

  if (item.alertId !== undefined && item.alertId !== null && String(item.alertId).trim()) {
    return String(item.alertId).trim();
  }

  if (item.emergencyStatus) return "emergency";
  if (item.tamperAlert) return "tamper";

  const speed = Number(item.speed ?? 0);
  if (Number.isFinite(speed) && speed > ALERT_SPEED_THRESHOLD_KMH) return "overspeed";

  return "";
};

const isValidLatLng = (lat: any, lng: any): boolean => {
  return typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng);
};

function MapInstanceAccessor({ onMap }: { onMap: (map: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    if (map) onMap(map);
  }, [map, onMap]);
  return null;
}

export default function ProfessionalHistoryPage() {
  const [vehicleId, setVehicleId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(true);
  const [shouldFetch, setShouldFetch] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [followVehicle, setFollowVehicle] = useState(false);
  const [activePreset, setActivePreset] = useState<"" | "yesterday" | "lastweek" | "lastmonth">("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [animatedPos, setAnimatedPos] = useState<LatLng | null>(null);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);

  const leafletMapRef = useRef<LeafletMap | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastIndexRef = useRef(0);

  const { data: vehiclesResponse, error: vehiclesError } = useGetVehiclesQuery(
    { page: 0, limit: 1000 },
    { refetchOnMountOrArgChange: true },
  );

  const { data: mappingResponse } = useGetVehicleDriverMappingsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const {
    data: historyResponse,
    error: historyError,
    isLoading: isHistoryLoading,
    isFetching,
  } = useGetVehicleHistoryQuery(
    {
      vehicleId,
      from: showAllHistory ? undefined : dateFrom || undefined,
      to: showAllHistory ? undefined : dateTo || undefined,
      page: 0,
      limit: 20000,
    },
    { skip: !vehicleId || !shouldFetch, refetchOnMountOrArgChange: true },
  );

  const vehicles = useMemo<VehicleOption[]>(() => {
    const raw = vehiclesResponse && "data" in vehiclesResponse ? vehiclesResponse.data : undefined;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((v) => {
        if (!v || typeof v !== "object") return null;
        const vehicle = v as Record<string, unknown>;
        const id = typeof vehicle._id === "string" ? vehicle._id : "";
        if (!id) return null;
        return {
          _id: id,
          vehicleNumber: typeof vehicle.vehicleNumber === "string" ? vehicle.vehicleNumber : undefined,
          registrationNumber: typeof vehicle.registrationNumber === "string" ? vehicle.registrationNumber : undefined,
          plateNumber: typeof vehicle.plateNumber === "string" ? vehicle.plateNumber : undefined,
          name: typeof vehicle.name === "string" ? vehicle.name : undefined,
          model: typeof vehicle.model === "string" ? vehicle.model : undefined,
          make: typeof vehicle.make === "string" ? vehicle.make : undefined,
          vehicleType: typeof vehicle.vehicleType === "string" ? vehicle.vehicleType : undefined,
          imei: typeof vehicle.imei === "string" ? vehicle.imei : undefined,
          deviceImei: typeof vehicle.deviceImei === "string" ? vehicle.deviceImei : undefined,
          status: typeof vehicle.status === "string" ? vehicle.status : undefined,
          organizationId:
            typeof vehicle.organizationId === "string" || (vehicle.organizationId && typeof vehicle.organizationId === "object")
              ? vehicle.organizationId
              : undefined,
          driverId:
            typeof vehicle.driverId === "string" || (vehicle.driverId && typeof vehicle.driverId === "object")
              ? vehicle.driverId
              : null,
        };
      })
      .filter((v) => v !== null)
      .map((v) => v as VehicleOption);
  }, [vehiclesResponse]);

  const vehicleDriverMappings = useMemo<VehicleDriverMapping[]>(() => {
    const raw = mappingResponse && "data" in mappingResponse ? mappingResponse.data : undefined;
    if (!Array.isArray(raw)) return [];
    return raw as VehicleDriverMapping[];
  }, [mappingResponse]);

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle._id === vehicleId) ?? null, [vehicles, vehicleId]);

  const selectedVehicleOrgName = useMemo(() => {
    if (!selectedVehicle?.organizationId) return "N/A";
    if (typeof selectedVehicle.organizationId === "string") return selectedVehicle.organizationId;
    return selectedVehicle.organizationId.name || selectedVehicle.organizationId._id || "N/A";
  }, [selectedVehicle]);

  const selectedVehicleLabel = useMemo(
    () =>
      selectedVehicle?.vehicleNumber ||
      selectedVehicle?.registrationNumber ||
      selectedVehicle?.plateNumber ||
      selectedVehicle?.name ||
      selectedVehicle?._id ||
      "Unknown Vehicle",
    [selectedVehicle],
  );

  const driverName = useMemo(() => {
    const fromVehicle = formatDriverName(selectedVehicle?.driverId);
    if (fromVehicle) return fromVehicle;

    const mapping = vehicleDriverMappings.find((item) => getVehicleId(item.vehicleId) === vehicleId);
    const fromMapping = formatDriverName(mapping?.driverId);
    return fromMapping || "Unassigned";
  }, [selectedVehicle, vehicleDriverMappings, vehicleId]);

  const rawHistory = useMemo<RawHistoryPoint[]>(() => {
    const raw = historyResponse && "data" in historyResponse ? historyResponse.data : undefined;
    if (!Array.isArray(raw)) return [];
    return raw as RawHistoryPoint[];
  }, [historyResponse]);

  const points = useMemo<HistoryPoint[]>(() => {
    if (rawHistory.length === 0) return [];

    const normalized = rawHistory
      .map((item) => {
        const latRaw = item.latitude ?? item.lat;
        const lngRaw = item.longitude ?? item.lng ?? item.lon;
        const parsedLat = typeof latRaw === "string" ? Number.parseFloat(latRaw) : Number(latRaw);
        const parsedLng = typeof lngRaw === "string" ? Number.parseFloat(lngRaw) : Number(lngRaw);
        const timestamp = item.gpsTimestamp ?? item.receivedAt ?? item.timestamp;
        const normalizedCoords = normalizeCoordinatePair(parsedLat, parsedLng);

        if (!normalizedCoords || !timestamp) {
          return null;
        }

        return {
          lat: normalizedCoords.lat,
          lng: normalizedCoords.lng,
          timestamp: String(timestamp),
          speed: Number(item.speed ?? 0),
          ignition: Boolean(item.ignitionStatus ?? item.ignition),
          address: String(item.address ?? ""),
          alertType: inferAlertType(item),
          heading: Number(item.heading ?? item.course ?? 0),
        };
      })
      .filter((item: HistoryPoint | null): item is HistoryPoint => item !== null);

    if (normalized.length <= 1) {
      return normalized.map((point) => ({
        ...point,
        address: point.address || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
      }));
    }

    const sorted = normalized
      .slice()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return sorted.map((point) => ({
      ...point,
      address: point.address || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
    }));
  }, [rawHistory]);

  // Unique sorted calendar-day strings in local time ("YYYY-MM-DD" via en-CA locale).
  const days = useMemo<string[]>(() => {
    if (points.length === 0) return [];
    const set = new Set(points.map((p) => new Date(p.timestamp).toLocaleDateString("en-CA")));
    return Array.from(set).sort();
  }, [points]);

  // Points filtered to the selected day (or all points when no day is selected).
  const activeDayPoints = useMemo<HistoryPoint[]>(() => {
    if (!selectedDay) return points;
    return points.filter((p) => new Date(p.timestamp).toLocaleDateString("en-CA") === selectedDay);
  }, [points, selectedDay]);

  const currentPoint = activeDayPoints[clampIndex(currentIndex, activeDayPoints.length)] ?? null;

  const routePositions = useMemo<LatLngExpression[]>(
    () => activeDayPoints.map((p) => [p.lat, p.lng] as LatLngExpression),
    [activeDayPoints],
  );

  const timelineValue = useMemo(() => {
    if (activeDayPoints.length <= 1) return 0;
    return (clampIndex(currentIndex, activeDayPoints.length) / (activeDayPoints.length - 1)) * 100;
  }, [currentIndex, activeDayPoints.length]);

  const currentTime = currentPoint?.timestamp ?? "";

  const maxSpeed = useMemo(() => {
    if (activeDayPoints.length === 0) return 0;
    return Math.max(...activeDayPoints.map((p) => p.speed));
  }, [activeDayPoints]);

  const avgSpeed = useMemo(() => {
    if (activeDayPoints.length === 0) return 0;
    return activeDayPoints.reduce((sum, p) => sum + p.speed, 0) / activeDayPoints.length;
  }, [activeDayPoints]);

  const alertCount = useMemo(() => activeDayPoints.filter((point) => Boolean(point.alertType)).length, [activeDayPoints]);

  const timelineStats = useMemo(() => {
    if (activeDayPoints.length < 2) {
      return {
        travelledKm: 0,
        currentDistanceKm: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        drivingSec: 0,
        idleSec: 0,
        stopSec: 0,
        stops: 0,
        overspeed: 0,
        harsh: 0,
      };
    }
    let travelled = 0;
    let driving = 0;
    let idle = 0;
    let stop = 0;
    let stops = 0;
    let streak = 0;
    let overspeed = 0;
    let harsh = 0;
    let maxSpeedLocal = 0;

    for (let i = 1; i < activeDayPoints.length; i++) {
      const prev = activeDayPoints[i - 1];
      const cur = activeDayPoints[i];
      const dt = Math.max(0, new Date(cur.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
      const dist = getDistanceMeters(prev, cur);
      travelled += dist;
      maxSpeedLocal = Math.max(maxSpeedLocal, cur.speed);
      if (cur.speed > 2) driving += dt;
      else if (cur.speed === 0 && cur.ignition) idle += dt;
      else if (cur.speed === 0) stop += dt;

      if (cur.speed === 0) streak += 1;
      else {
        if (streak >= 3) stops += 1;
        streak = 0;
      }
      const alert = (cur.alertType || "").toLowerCase();
      if (alert.includes("over")) overspeed += 1;
      if (alert.includes("harsh")) harsh += 1;
    }
    if (streak >= 3) stops += 1;

    const currentDistance = getDistanceMeters(activeDayPoints[0], activeDayPoints[activeDayPoints.length - 1]);
    return {
      travelledKm: travelled / 1000,
      currentDistanceKm: currentDistance / 1000,
      avgSpeed,
      maxSpeed: maxSpeedLocal,
      drivingSec: driving,
      idleSec: idle,
      stopSec: stop,
      stops,
      overspeed,
      harsh,
    };
  }, [activeDayPoints, avgSpeed]);

  const timelineWindow = useMemo(() => {
    if (!activeDayPoints.length) return { start: "N/A", end: "N/A" };
    return {
      start: new Date(activeDayPoints[0].timestamp).toLocaleString(),
      end: new Date(activeDayPoints[activeDayPoints.length - 1].timestamp).toLocaleString(),
    };
  }, [activeDayPoints]);

  const telemetryCards = [
    { label: "Travelled Distance", value: `${timelineStats.travelledKm.toFixed(2)} km` },
    { label: "Current Distance", value: `${timelineStats.currentDistanceKm.toFixed(2)} km` },
    { label: "Average Speed", value: `${timelineStats.avgSpeed.toFixed(1)} km/h` },
    { label: "Driving Duration", value: formatSeconds(timelineStats.drivingSec) },
    { label: "Idle Duration", value: formatSeconds(timelineStats.idleSec) },
    { label: "Stoppage Duration", value: formatSeconds(timelineStats.stopSec) },
    { label: "Stops", value: `${timelineStats.stops}` },
    { label: "Overspeed", value: `${timelineStats.overspeed}` },
  ];

  const mapCenter = useMemo<LatLngExpression>(() => {
    if (!vehicleId) return INDIA_DEFAULT_CENTER;
    if (animatedPos) return [animatedPos.lat, animatedPos.lng];
    if (currentPoint) return [currentPoint.lat, currentPoint.lng];
    if (points[0]) return [points[0].lat, points[0].lng];
    return INDIA_DEFAULT_CENTER;
  }, [animatedPos, currentPoint, points, vehicleId]);

  useEffect(() => {
    if (activeDayPoints.length === 0) return;

    if (currentIndex === 0 || lastIndexRef.current >= activeDayPoints.length) {
      const start = activeDayPoints[0];
      const raf = requestAnimationFrame(() => {
        setAnimatedPos({ lat: start.lat, lng: start.lng });
      });
      lastIndexRef.current = 0;
      return () => cancelAnimationFrame(raf);
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const fromIndex = clampIndex(lastIndexRef.current, activeDayPoints.length);
    const toIndex = clampIndex(currentIndex, activeDayPoints.length);
    const from = activeDayPoints[fromIndex];
    const to = activeDayPoints[toIndex];

    const duration = Math.max(120, 450 / playbackSpeed);
    const startedAt = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      const t = Math.min(elapsed / duration, 1);
      const lat = from.lat + (to.lat - from.lat) * t;
      const lng = from.lng + (to.lng - from.lng) * t;

      if (isValidLatLng(lat, lng)) {
        setAnimatedPos({ lat, lng });

        if (followVehicle && leafletMapRef.current) {
          try {
            leafletMapRef.current.panTo([lat, lng], { animate: true, duration: 0.1 });
          } catch (e) {
            console.error("Leaflet panTo error:", e);
          }
        }
      }

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    lastIndexRef.current = toIndex;

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [currentIndex, followVehicle, playbackSpeed, activeDayPoints]);

  useEffect(() => {
    if (!isPlaying || activeDayPoints.length <= 1) return;

    const frameInterval = Math.max(40, Math.round(500 / playbackSpeed));
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= activeDayPoints.length) {
          setIsPlaying(false);
          return activeDayPoints.length - 1;
        }
        return next;
      });
    }, frameInterval);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, activeDayPoints.length]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (vehicleId) return;
    const frame = requestAnimationFrame(() => {
      setIsPlaying(false);
      setCurrentIndex(0);
      setAnimatedPos(null);
      lastIndexRef.current = 0;
    });

    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.setView(INDIA_DEFAULT_CENTER, 5, { animate: true });
      } catch (e) {
        console.error("Leaflet setView error:", e);
      }
    }

    return () => cancelAnimationFrame(frame);
  }, [vehicleId]);

  useEffect(() => {
    if (!vehicleId || points.length === 0) return;
    // Reset day selection when a fresh set of history data is loaded
    setSelectedDay(null);

    const latestIndex = points.length - 1;
    const latestPoint = points[latestIndex];
    const frame = requestAnimationFrame(() => {
      setIsPlaying(false);
      setCurrentIndex(latestIndex);
      lastIndexRef.current = latestIndex;
      setAnimatedPos({ lat: latestPoint.lat, lng: latestPoint.lng });
    });

    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.setView([latestPoint.lat, latestPoint.lng], 15, { animate: true });
      } catch (e) {
        console.error("Leaflet setView error:", e);
      }
    }

    return () => cancelAnimationFrame(frame);
  }, [vehicleId, points]);

  // When the selected day changes, reset playback to the start of that day's range.
  useEffect(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
    lastIndexRef.current = 0;
    if (activeDayPoints.length > 0) {
      setAnimatedPos({ lat: activeDayPoints[0].lat, lng: activeDayPoints[0].lng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  // Auto-fit map bounds to the active day's route when the day changes.
  useEffect(() => {
    if (!leafletMapRef.current || activeDayPoints.length === 0 || !selectedDay) return;
    const bounds = activeDayPoints.map((p) => [p.lat, p.lng] as [number, number]);
    try {
      leafletMapRef.current.fitBounds(bounds, { padding: [30, 30] });
    } catch (e) {
      console.error("Leaflet fitBounds error:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();

    if (!vehicleId) {
      toast.error("Please select a vehicle");
      return;
    }

    if (!showAllHistory && (!dateFrom || !dateTo)) {
      toast.error("Please select both From and To date/time");
      return;
    }

    if (!showAllHistory && dateFrom && dateTo && new Date(dateTo) <= new Date(dateFrom)) {
      toast.error("End date must be after start date");
      return;
    }

    setCurrentIndex(0);
    setIsPlaying(false);
    lastIndexRef.current = 0;
    setShouldFetch(true);
  };

  const handleQuickDate = (range: "yesterday" | "lastweek" | "lastmonth") => {
    const now = new Date();
    const from = new Date(now);

    if (range === "yesterday") from.setDate(now.getDate() - 1);
    if (range === "lastweek") from.setDate(now.getDate() - 7);
    if (range === "lastmonth") from.setDate(now.getDate() - 30);

    setShowAllHistory(false);
    setDateFrom(from.toISOString().slice(0, 16));
    setDateTo(now.toISOString().slice(0, 16));
    setShouldFetch(false);
    setActivePreset(range);
  };

  const handlePlay = () => {
    if (activeDayPoints.length > 1) setIsPlaying(true);
  };

  const handlePause = () => setIsPlaying(false);

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    lastIndexRef.current = 0;
    if (activeDayPoints[0]) {
      setAnimatedPos({ lat: activeDayPoints[0].lat, lng: activeDayPoints[0].lng });
    }
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => clampIndex(prev + 1, activeDayPoints.length));
  };

  const handlePrevious = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => clampIndex(prev - 1, activeDayPoints.length));
  };

  const handleTimelineChange = (value: number) => {
    if (activeDayPoints.length === 0) return;
    const nextIndex = clampIndex(Math.floor((value / 100) * activeDayPoints.length), activeDayPoints.length);
    setIsPlaying(false);
    setCurrentIndex(nextIndex);
  };

  const zoomToRoute = () => {
    if (!leafletMapRef.current || activeDayPoints.length === 0) return;
    const bounds = activeDayPoints.map((p) => [p.lat, p.lng] as [number, number]);
    try {
      leafletMapRef.current.fitBounds(bounds, { padding: [30, 30] });
    } catch (e) {
      console.error("Leaflet fitBounds error:", e);
    }
  };

  const getVehicleDisplayName = (vehicle: VehicleOption) => {
    return vehicle.vehicleNumber || vehicle.registrationNumber || vehicle.plateNumber || vehicle.name || vehicle._id;
  };

  const isLoading = isHistoryLoading || isFetching;
  const hasError = Boolean(vehiclesError || historyError);
  const hasLoadedSearch = Boolean(vehicleId && shouldFetch);
  const hasHistoryResults = points.length > 0;
  const noHistoryResults = hasLoadedSearch && !isLoading && !hasError && !hasHistoryResults;

  // Pre-compute per-day route positions for the faint background polylines.
  const otherDayPositions = useMemo(() => {
    if (!selectedDay || days.length <= 1) return [];
    return days
      .filter((d) => d !== selectedDay)
      .map((d) => ({
        day: d,
        positions: points
          .filter((p) => new Date(p.timestamp).toLocaleDateString("en-CA") === d)
          .map((p) => [p.lat, p.lng] as LatLngExpression),
      }))
      .filter((item) => item.positions.length > 1);
  }, [selectedDay, days, points]);

  return (
    <ApiErrorBoundary hasError={hasError}>
      <div className="min-h-screen bg-white p-3 text-gray-900 sm:p-4">
        <div className="rounded-2xl border border-gray-200 bg-white px-3 py-4 shadow-sm sm:px-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">Professional History</p>
              <h1 className="text-xl font-black text-gray-900">Vehicle Playback</h1>
            </div>
            <div className="text-sm font-semibold text-gray-700">
              {!hasLoadedSearch
                ? "Search to load"
                : activeDayPoints.length > 0
                  ? `${currentIndex + 1}/${activeDayPoints.length}`
                  : "0 points"}
              {selectedDay && <span className="ml-2 text-[10px] text-blue-600 font-black uppercase tracking-widest">{new Date(selectedDay + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>}
            </div>
          </div>

          <form onSubmit={handleSearch} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600">Vehicle</label>
              <select
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                value={vehicleId}
                onChange={(event) => {
                  setVehicleId(event.target.value);
                  setCurrentIndex(0);
                  setIsPlaying(false);
                  setAnimatedPos(null);
                  lastIndexRef.current = 0;
                  setShouldFetch(false);
                }}
              >
                <option value="">Select Vehicle...</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle._id} value={vehicle._id}>
                    {getVehicleDisplayName(vehicle)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600">From</label>
              <input
                type="datetime-local"
                required={!showAllHistory}
                disabled={showAllHistory}
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setShouldFetch(false);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600">To</label>
              <input
                type="datetime-local"
                required={!showAllHistory}
                disabled={showAllHistory}
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setShouldFetch(false);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
              />
            </div>

            <div className="flex flex-wrap items-end gap-2 xl:flex-nowrap">
              <Button
                type="button"
                variant="outline"
                className={showAllHistory ? "border-green-500 bg-green-50 text-green-700" : ""}
                onClick={() => {
                  const next = !showAllHistory;
                  setShowAllHistory(next);
                  setShouldFetch(false);
                }}
              >
                <Calendar size={14} className="mr-1" />
                {showAllHistory ? "All" : "Range"}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
                Load
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2 xl:flex-nowrap">
              {(["yesterday", "lastweek"] as const).map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  className={
                    activePreset === preset
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"
                  }
                  onClick={() => handleQuickDate(preset)}
                >
                  {preset === "yesterday" ? "Yesterday" : "Last Week"}
                </Button>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <Button
                type="button"
                size="sm"
                className={
                  activePreset === "lastmonth"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"
                }
                onClick={() => handleQuickDate("lastmonth")}
              >
                Last Month
              </Button>
            </div>
          </form>
        </div>

        <div className={`mt-4 grid items-start grid-cols-1 gap-6 ${hasLoadedSearch ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {!hasLoadedSearch ? (
              <div className="flex min-h-[calc(100vh-260px)] items-center justify-center px-4 py-10">
                <div className="max-w-md rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                  <Search className="mx-auto mb-3 text-gray-400" size={24} />
                  <h2 className="text-lg font-black text-gray-900">Search for a vehicle</h2>
                  <p className="mt-2 text-sm font-medium text-gray-600">
                    Select a vehicle, choose the required date range, and click Load to view playback, route, and telemetry details.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* ── Day strip ─────────────────────────────────────────────── */}
                {days.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 px-4 py-2 scrollbar-none">
                    <button
                      onClick={() => setSelectedDay(null)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${!selectedDay
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      All days
                    </button>
                    {days.map((day) => {
                      const label = new Date(day + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                      return (
                        <button
                          key={day}
                          onClick={() => setSelectedDay(day)}
                          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${selectedDay === day
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-3 sm:px-4">
                  <Button size="sm" onClick={handlePrevious} disabled={currentIndex <= 0 || activeDayPoints.length === 0}>
                    <SkipBack size={14} />
                  </Button>
                  <Button size="sm" onClick={isPlaying ? handlePause : handlePlay} disabled={activeDayPoints.length <= 1}>
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </Button>
                  <Button size="sm" onClick={handleStop} disabled={activeDayPoints.length === 0}>
                    <RotateCcw size={14} />
                  </Button>
                  <Button size="sm" onClick={handleNext} disabled={currentIndex >= activeDayPoints.length - 1 || activeDayPoints.length === 0}>
                    <SkipForward size={14} />
                  </Button>

                  <select
                    className="min-w-[5rem] rounded border border-gray-300 px-2 py-1 text-sm"
                    value={playbackSpeed}
                    onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={5}>5x</option>
                    <option value={10}>10x</option>
                  </select>

                  <Button size="sm" variant={followVehicle ? "default" : "outline"} onClick={() => setFollowVehicle((prev) => !prev)}>
                    <Navigation size={14} className="mr-1" />
                    Follow
                  </Button>

                  <Button size="sm" variant="outline" onClick={zoomToRoute} disabled={points.length === 0}>
                    <ZoomIn size={14} className="mr-1" />
                    Zoom to route
                  </Button>
                </div>

                <div className="px-4 py-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={timelineValue}
                    onChange={(event) => handleTimelineChange(Number(event.target.value))}
                    disabled={activeDayPoints.length === 0}
                    className="w-full"
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    {currentTime ? new Date(currentTime).toLocaleString() : "No timestamp"}
                  </div>
                </div>

                <div className="p-4">
                  <div className="relative h-full overflow-hidden rounded-lg border border-gray-300 bg-gray-100">
                    <MapContainer
                      center={mapCenter}
                      zoom={vehicleId ? 12 : 5}
                      className="h-[52vh] min-h-[320px] w-full sm:min-h-[420px]"
                      scrollWheelZoom={true}
                    >
                      <MapInstanceAccessor onMap={(map) => { leafletMapRef.current = map; }} />
                      <MapTileLayer satellite={false} />

                      {/* Faint grey routes for non-selected days */}
                      {otherDayPositions.map((item) => (
                        <Polyline key={item.day} positions={item.positions} pathOptions={{ color: "#d1d5db", weight: 2, opacity: 0.55 }} />
                      ))}

                      {/* Active route (selected day or full range) */}
                      {routePositions.length > 1 && <Polyline positions={routePositions} pathOptions={{ color: "#2563eb", weight: 4 }} />}

                      {points[0] && isValidLatLng(points[0].lat, points[0].lng) && (
                        <Marker position={[points[0].lat, points[0].lng]}><Popup>Route Start</Popup></Marker>
                      )}
                      {points.length > 1 && isValidLatLng(points[points.length - 1].lat, points[points.length - 1].lng) && (
                        <Marker position={[points[points.length - 1].lat, points[points.length - 1].lng]}>
                          <Popup>Route End</Popup>
                        </Marker>
                      )}

                      {(animatedPos || currentPoint) && (
                        <Marker
                          position={[
                            animatedPos?.lat ?? currentPoint!.lat,
                            animatedPos?.lng ?? currentPoint!.lng
                          ]}
                        >
                          <Popup>
                            <div className="text-xs">
                              <div>{new Date(currentTime).toLocaleString()}</div>
                              <div>Speed: {(currentPoint?.speed ?? 0).toFixed(1)} km/h</div>
                            </div>
                          </Popup>
                        </Marker>
                      )}
                    </MapContainer>

                    {noHistoryResults && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                        <div className="text-center text-sm text-gray-700">
                          <MapPin className="mx-auto mb-2" size={20} />
                          No record found for this vehicle in the selected period.
                        </div>
                      </div>
                    )}
                    {points.length > 0 && activeDayPoints.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                        <div className="text-center text-sm text-gray-700">
                          <MapPin className="mx-auto mb-2" size={20} />
                          No GPS data for the selected day.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-4">
                  {noHistoryResults && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                      No record found for the selected vehicle in this period.
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {telemetryCards.map((card) => (
                      <div key={card.label} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-semibold">{card.label}</p>
                        <p className="text-lg font-bold text-gray-900">{card.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {hasLoadedSearch && (
            <aside className="self-start space-y-4 text-gray-900 xl:sticky xl:top-6">
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Vehicle Overview</p>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{selectedVehicleLabel}</h3>
                      <p className="text-xs font-semibold text-slate-500">{selectedVehicle?.make || ""} {selectedVehicle?.model || ""}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">
                      {selectedVehicle?.status || "unknown"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vehicle Type</p>
                      <p className="font-semibold text-slate-900">{selectedVehicle?.vehicleType || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">IMEI</p>
                      <p className="font-semibold text-slate-900 break-all">{selectedVehicle?.imei || selectedVehicle?.deviceImei || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Registration</p>
                      <p className="font-semibold text-slate-900">{selectedVehicle?.registrationNumber || selectedVehicle?.plateNumber || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Organization</p>
                      <p className="font-semibold text-slate-900">{selectedVehicleOrgName}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">Playback Snapshot</h3>
                    <button
                      onClick={() => setIsDriverModalOpen(true)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      Driver details
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-700">
                        <span>Time</span>
                        <Clock size={12} />
                      </div>
                      <div className="text-sm font-semibold">{currentTime ? new Date(currentTime).toLocaleTimeString() : "--:--:--"}</div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-700">
                        <span>Speed</span>
                        <Gauge size={12} />
                      </div>
                      <div className="text-sm font-semibold">{(currentPoint?.speed ?? 0).toFixed(1)} km/h</div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-700">
                        <span>Driver</span>
                        <Navigation size={12} />
                      </div>
                      <div className="text-sm font-semibold">{driverName}</div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-700">
                        <span>Location</span>
                        <MapPin size={12} />
                      </div>
                      <div className="text-xs leading-5 text-gray-900">{currentPoint?.address || "Unknown location"}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">Journey Window</h3>
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Start</p>
                      <p className="font-semibold text-slate-900">{timelineWindow.start}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">End</p>
                      <p className="font-semibold text-slate-900">{timelineWindow.end}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Points</p>
                        <p className="font-semibold text-slate-900">{points.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Alerts</p>
                        <p className="font-semibold text-slate-900">{alertCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Max Speed</p>
                        <p className="font-semibold text-slate-900">{maxSpeed.toFixed(1)} km/h</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Stops</p>
                        <p className="font-semibold text-slate-900">{timelineStats.stops}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Driver Modal */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/30 p-2 sm:items-center sm:p-4" onClick={() => setIsDriverModalOpen(false)}>
          <div className="max-h-[min(100dvh-1rem,90vh)] w-full max-w-sm overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/20 p-2">
                  <User size={20} className="text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest truncate">Driver Profile</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight truncate">{selectedVehicle?.vehicleNumber || 'Unknown Vehicle'}</p>
                </div>
              </div>
              <button onClick={() => setIsDriverModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Full Name</span>
                <div className="text-base font-black text-gray-900">{driverName}</div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 border border-gray-200">
                  <Phone size={16} className="text-emerald-400" />
                  <div>
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Phone Number</div>
                    <div className="text-xs font-bold text-gray-700">
                      {typeof selectedVehicle?.driverId === 'object' && 'phone' in selectedVehicle.driverId ? selectedVehicle.driverId.phone : "N/A"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 border border-gray-200">
                  <Mail size={16} className="text-blue-400" />
                  <div>
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Email Address</div>
                    <div className="text-xs font-bold text-gray-700">
                      {typeof selectedVehicle?.driverId === 'object' && 'email' in selectedVehicle.driverId ? selectedVehicle.driverId.email : "N/A"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 border border-gray-200">
                  <FileText size={16} className="text-amber-400" />
                  <div>
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">License Number</div>
                    <div className="text-xs font-bold text-gray-700">
                      {typeof selectedVehicle?.driverId === 'object' && 'licenseNumber' in selectedVehicle.driverId ? selectedVehicle.driverId.licenseNumber : "N/A"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 border border-gray-200">
                  <MapPin size={16} className="text-red-400 mt-0.5" />
                  <div>
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Address</div>
                    <div className="text-xs font-bold text-gray-700 leading-tight">
                      {typeof selectedVehicle?.driverId === 'object' && 'address' in selectedVehicle.driverId ? selectedVehicle.driverId.address : "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={() => setIsDriverModalOpen(false)} className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-black text-white uppercase tracking-widest transition-transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/20">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </ApiErrorBoundary>
  );
}
