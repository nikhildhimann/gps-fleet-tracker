"use client";

import React, { useEffect, useRef, useState, useMemo, useTransition } from "react";
import {
    X, Play, Pause, SkipBack, SkipForward, Clock, Gauge,
    Navigation, MapPin, Loader2, Maximize, ZoomIn, Info, Activity,
    RotateCcw, User, Phone, Mail, FileText, Zap, Square, Moon, CornerUpRight
} from "lucide-react";
import { useGetGpsHistoryQuery } from "@/redux/api/gpsHistoryApi";
import { MapContainer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import { MapTileLayer } from "../admin/Map/MapTileLayer";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import { Button } from "@/components/ui/button";

interface HistoryPoint {
    lat: number;
    lng: number;
    timestamp: string;
    speed: number;
    ignition: boolean;
    address: string;
    heading: number;
    odometer?: number;
    geometryIndex?: number;
}

interface SnappedRouteData {
    snappedPoints: HistoryPoint[];
    roadGeometry: [number, number][];
}

interface TripPlaybackRange {
    from: string;
    to: string;
    dayKey?: string | null;
    tripKey?: string | null;
}

interface TripDayGroup {
    key: string;
    dateLabel?: string;
    dayName?: string;
    tripCount?: number;
    trips: Array<{
        startTime: string;
        endTime: string;
        driverName?: string;
        distance?: number;
        runningTime?: number;
        idleTime?: number;
        stopTime?: number;
        inactiveTime?: number;
        avgSpeed?: number;
        maxSpeed?: number;
        alerts?: number;
        startLocation?: { address?: string; latitude?: number; longitude?: number };
        endLocation?: { address?: string; latitude?: number; longitude?: number };
        startOdometer?: number;
        endOdometer?: number;
    }>;
}

interface TravelPlaybackInlineProps {
    vehicleId: string;
    vehicleNumber: string;
    from: string;
    to: string;
    onClose: () => void;
    metadata?: any;
    initialDay?: string;
    isTripPlayback?: boolean;
    tripDayGroups?: TripDayGroup[];
    initialTripRange?: TripPlaybackRange | null;
}

const isCoordinateText = (value?: string) => {
    if (!value) return false;
    return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(value.trim());
};

const formatAddressText = (value?: string) => {
    const address = typeof value === "string" ? value.trim() : "";
    if (!address || isCoordinateText(address)) return "Resolving address...";
    return address;
};

function MapInstanceAccessor({ onMap }: { onMap: (map: L.Map) => void }) {
    const map = useMap();
    useEffect(() => {
        if (map) onMap(map);
    }, [map, onMap]);
    return null;
}

const snapHistoryPointsToRoads = async (rawPoints: HistoryPoint[]): Promise<SnappedRouteData> => {
    if (rawPoints.length < 2) {
        return {
            snappedPoints: rawPoints,
            roadGeometry: rawPoints.map((p) => [p.lat, p.lng]),
        };
    }

    const chunkSize = 40;
    const chunks: HistoryPoint[][] = [];
    for (let index = 0; index < rawPoints.length; index += chunkSize) {
        chunks.push(rawPoints.slice(index, index + chunkSize + 1));
    }

    const allSnapped: HistoryPoint[] = [];
    const fullRoadPath: [number, number][] = [];
    const appendChunkFallback = (chunkPoints: HistoryPoint[]) => {
        allSnapped.push(...chunkPoints);
        chunkPoints.forEach((point) => fullRoadPath.push([point.lat, point.lng]));
    };
    const appendChunkGeometryFallback = (chunkPoints: HistoryPoint[]) => {
        chunkPoints.forEach((point) => fullRoadPath.push([point.lat, point.lng]));
    };

    for (const chunk of chunks) {
        const coords = chunk.map((p) => `${p.lng},${p.lat}`).join(";");
        const url = `https://router.project-osrm.org/match/v1/driving/${coords}?overview=full&geometries=geojson&annotations=true`;
        let data: any = null;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                appendChunkFallback(chunk);
                continue;
            }

            data = await response.json();
        } catch {
            appendChunkFallback(chunk);
            continue;
        }

        if (data.code === "Ok") {
            const chunkGeometryStart = fullRoadPath.length;
            const chunkMatchings = Array.isArray(data.matchings) ? data.matchings : [];
            const matchingOffsets: number[] = [];
            const chunkRoadGeometry: [number, number][] = [];

            chunkMatchings.forEach((matching: any) => {
                matchingOffsets.push(chunkRoadGeometry.length);
                const coordinates = Array.isArray(matching?.geometry?.coordinates)
                    ? matching.geometry.coordinates
                    : [];

                coordinates.forEach((coordinate: [number, number]) => {
                    const nextPoint: [number, number] = [coordinate[1], coordinate[0]];
                    const prevPoint = chunkRoadGeometry[chunkRoadGeometry.length - 1];
                    if (!prevPoint || prevPoint[0] !== nextPoint[0] || prevPoint[1] !== nextPoint[1]) {
                        chunkRoadGeometry.push(nextPoint);
                    }
                });
            });

            if (Array.isArray(data.tracepoints) && data.tracepoints.length > 0) {
                chunk.forEach((point, index) => {
                    const tracePoint = data.tracepoints[index];
                    if (tracePoint?.location) {
                        let geometryIndex: number | undefined;

                        if (
                            typeof tracePoint.matchings_index === "number" &&
                            typeof tracePoint.waypoint_index === "number"
                        ) {
                            const matchingOffset = matchingOffsets[tracePoint.matchings_index];
                            if (typeof matchingOffset === "number") {
                                geometryIndex = chunkGeometryStart + matchingOffset + tracePoint.waypoint_index;
                            }
                        } else if (typeof tracePoint.waypoint_index === "number") {
                            geometryIndex = chunkGeometryStart + tracePoint.waypoint_index;
                        }

                        allSnapped.push({
                            ...point,
                            lat: tracePoint.location[1],
                            lng: tracePoint.location[0],
                            geometryIndex,
                        });
                    } else {
                        allSnapped.push(point);
                    }
                });
            } else {
                allSnapped.push(...chunk);
            }

            if (chunkRoadGeometry.length > 0) {
                fullRoadPath.push(...chunkRoadGeometry);
            } else {
                appendChunkGeometryFallback(chunk);
            }
        } else {
            appendChunkFallback(chunk);
        }
    }

    return {
        snappedPoints: allSnapped.filter(
            (point, index, self) => index === self.findIndex((candidate) => candidate.timestamp === point.timestamp),
        ),
        roadGeometry: fullRoadPath.filter(
            (point, index, self) => index === 0 || point[0] !== self[index - 1][0] || point[1] !== self[index - 1][1],
        ),
    };
};

const buildTripOptionKey = (trip: { startTime: string; endTime: string }, index: number) =>
    `${trip.startTime}|${trip.endTime}|${index}`;

const TravelPlaybackInline: React.FC<TravelPlaybackInlineProps> = ({
    vehicleId,
    vehicleNumber,
    from,
    to,
    onClose,
    metadata,
    initialDay,
    tripDayGroups = [],
    initialTripRange = null,
}) => {
    const [isPendingSelection, startSelectionTransition] = useTransition();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [followVehicle, setFollowVehicle] = useState(true);
    const [selectedDay, setSelectedDay] = useState<string | null>(initialTripRange?.dayKey || initialDay || null);
    const [displayedDay, setDisplayedDay] = useState<string | null>(initialTripRange?.dayKey || initialDay || null);
    const [selectionMode, setSelectionMode] = useState<"full" | "day" | "trip">(
        initialTripRange ? "trip" : initialDay ? "day" : "full",
    );
    const [selectedTripKey, setSelectedTripKey] = useState<string | null>(initialTripRange?.tripKey || null);
    const [animatedPos, setAnimatedPos] = useState<{ lat: number; lng: number; heading: number } | null>(null);
    const [isSwitchingDay, setIsSwitchingDay] = useState(false);

    const leafletMapRef = useRef<L.Map | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastIndexRef = useRef(0);
    const animatedPosRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
    const lastFollowPanAtRef = useRef(0);
    const snapCacheRef = useRef<Map<string, SnappedRouteData>>(new Map());
    const switchRequestRef = useRef(0);

    useEffect(() => {
        // Reset state for new playback session (new range or vehicle)
        setCurrentIndex(0);
        setIsPlaying(false);
        setAnimatedPos(null);
        setIsSwitchingDay(false);
        setDisplayedDay(initialTripRange?.dayKey || initialDay || null);
        setSnappedPoints([]);
        setRoadGeometry([]);
        setIsSnapping(false);
        switchRequestRef.current += 1;
        if (lastIndexRef.current !== undefined) lastIndexRef.current = 0;

        if (initialTripRange) {
            setSelectedDay(initialTripRange.dayKey || initialDay || null);
            setSelectedTripKey(initialTripRange.tripKey || null);
            setSelectionMode("trip");
        } else if (initialDay) {
            setSelectedDay(initialDay);
            setSelectedTripKey(null);
            setSelectionMode("day");
        } else {
            setSelectedDay(null);
            setSelectedTripKey(null);
            setSelectionMode("full");
        }
    }, [initialDay, initialTripRange, from, to, vehicleId]);

    const [visibleStatuses, setVisibleStatuses] = useState<Set<string>>(
        new Set(['start', 'stopped', 'idle', 'inactive', 'uturn', 'arrows', 'turns'])
    );

    const toggleStatus = (status: string) => {
        const next = new Set(visibleStatuses);
        if (next.has(status)) next.delete(status);
        else next.add(status);
        setVisibleStatuses(next);
    };

    const mapFilterButtons = [
        {
            key: 'start',
            label: 'Start',
            icon: Play,
            activeClass: 'bg-[#2f8d35]/90 border-[#2f8d35] text-white',
        },
        {
            key: 'arrows',
            label: 'Running',
            icon: Zap,
            activeClass: 'bg-green-600/90 border-green-500 text-white',
        },
        {
            key: 'idle',
            label: 'Idle',
            icon: Clock,
            activeClass: 'bg-orange-500/90 border-orange-400 text-white',
        },
        {
            key: 'stopped',
            label: 'Stop',
            icon: Square,
            activeClass: 'bg-red-600/90 border-red-500 text-white',
        },
        {
            key: 'inactive',
            label: 'Inactive',
            icon: Moon,
            activeClass: 'bg-slate-700/90 border-slate-600 text-white',
        },
        {
            key: 'uturn',
            label: 'U-Turn',
            icon: RotateCcw,
            activeClass: 'bg-orange-500/90 border-orange-400 text-white',
        },
        {
            key: 'turns',
            label: 'Turns',
            icon: CornerUpRight,
            activeClass: 'bg-blue-600/90 border-blue-500 text-white',
        },
    ] as const;

    const { data: historyResponse, isFetching, isLoading } = useGetGpsHistoryQuery(
        { vehicleId, from, to },
        { skip: !vehicleId, refetchOnMountOrArgChange: true }
    );

    const points = useMemo<HistoryPoint[]>(() => {
        const raw = historyResponse?.data?.points || [];
        return raw.map((p: any) => ({
            lat: p.latitude || p.lat,
            lng: p.longitude || p.lng,
            timestamp: p.gpsTimestamp || p.timestamp,
            speed: p.speed || 0,
            ignition: p.ignitionStatus ?? p.ignition,
            address: typeof p.address === "string" ? p.address : "",
            heading: p.heading || 0,
            odometer: p.odometer
        })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [historyResponse]);

    // Grouping by days
    const days = useMemo<string[]>(() => {
        if (points.length === 0) return [];
        const set = new Set(points.map((p) => new Date(p.timestamp).toLocaleDateString("en-CA")));
        return Array.from(set).sort();
    }, [points]);

    const [snappedPoints, setSnappedPoints] = useState<HistoryPoint[]>([])
    const [roadGeometry, setRoadGeometry] = useState<[number, number][]>([])
    const [isSnapping, setIsSnapping] = useState(false)

    const pointsByDay = useMemo(() => {
        const grouped = new Map<string, HistoryPoint[]>();
        points.forEach((point) => {
            const dayKey = new Date(point.timestamp).toLocaleDateString("en-CA");
            const existing = grouped.get(dayKey) || [];
            existing.push(point);
            grouped.set(dayKey, existing);
        });
        return grouped;
    }, [points]);

    const targetRawDayPoints = useMemo<HistoryPoint[]>(() => {
        if (!selectedDay) return points;
        return pointsByDay.get(selectedDay) || [];
    }, [points, pointsByDay, selectedDay]);

    const displayedRawDayPoints = useMemo<HistoryPoint[]>(() => {
        if (!displayedDay) return points;
        return pointsByDay.get(displayedDay) || [];
    }, [points, pointsByDay, displayedDay]);

    const tripGroupsByDay = useMemo(() => {
        return new Map(tripDayGroups.map((group) => [group.key, group]));
    }, [tripDayGroups]);

    const selectedDayGroup = useMemo(() => {
        if (!selectedDay) return null;
        return tripGroupsByDay.get(selectedDay) || null;
    }, [selectedDay, tripGroupsByDay]);

    const selectedDayTripOptions = useMemo(() => {
        if (!selectedDayGroup?.trips?.length) return [];
        return selectedDayGroup.trips.map((trip, index) => ({
            key: buildTripOptionKey(trip, index),
            label: `Trip ${index + 1} — ${new Date(trip.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} to ${new Date(trip.endTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`,
            trip,
        }));
    }, [selectedDayGroup]);

    const selectedTripOption = useMemo(() => {
        if (!selectedTripKey) return null;
        return selectedDayTripOptions.find((option) => option.key === selectedTripKey) || null;
    }, [selectedTripKey, selectedDayTripOptions]);

    useEffect(() => {
        if (selectionMode === "trip" && selectedTripKey && !selectedTripOption) {
            setSelectedTripKey(null);
            setSelectionMode(selectedDay ? "day" : "full");
        }
    }, [selectionMode, selectedTripKey, selectedTripOption, selectedDay]);

    useEffect(() => {
        if (!vehicleId) {
            setSnappedPoints([]);
            setRoadGeometry([]);
            setDisplayedDay(selectedDay);
            setIsSnapping(false);
            setIsSwitchingDay(false);
            return;
        }

        const cacheKey = `${vehicleId}|${from}|${to}|${selectedDay || "__all__"}`;
        const cachedRoute = snapCacheRef.current.get(cacheKey);
        const nextRawPoints = targetRawDayPoints;

        if (cachedRoute) {
            setDisplayedDay(selectedDay);
            setSnappedPoints(cachedRoute.snappedPoints);
            setRoadGeometry(cachedRoute.roadGeometry);
            setIsSnapping(false);
            setIsSwitchingDay(false);
            return;
        }

        const requestId = Date.now();
        switchRequestRef.current = requestId;
        setIsSwitchingDay(displayedDay !== selectedDay);

        if (nextRawPoints.length < 2) {
            const immediateResult = {
                snappedPoints: nextRawPoints,
                roadGeometry: nextRawPoints.map((point) => [point.lat, point.lng] as [number, number]),
            };
            snapCacheRef.current.set(cacheKey, immediateResult);
            setDisplayedDay(selectedDay);
            setSnappedPoints(immediateResult.snappedPoints);
            setRoadGeometry(immediateResult.roadGeometry);
            setIsSnapping(false);
            setIsSwitchingDay(false);
            return;
        }

        let cancelled = false;
        setIsSnapping(true);

        const loadSnappedRoute = async () => {
            try {
                const snappedRoute = await snapHistoryPointsToRoads(nextRawPoints);
                if (cancelled || switchRequestRef.current !== requestId) return;

                snapCacheRef.current.set(cacheKey, snappedRoute);
                setDisplayedDay(selectedDay);
                setSnappedPoints(snappedRoute.snappedPoints);
                setRoadGeometry(snappedRoute.roadGeometry);
            } catch (error) {
                console.error("Snapping failed:", error);
                if (cancelled || switchRequestRef.current !== requestId) return;

                const fallbackRoute = {
                    snappedPoints: nextRawPoints,
                    roadGeometry: nextRawPoints.map((point) => [point.lat, point.lng] as [number, number]),
                };
                snapCacheRef.current.set(cacheKey, fallbackRoute);
                setDisplayedDay(selectedDay);
                setSnappedPoints(fallbackRoute.snappedPoints);
                setRoadGeometry(fallbackRoute.roadGeometry);
            } finally {
                if (!cancelled && switchRequestRef.current === requestId) {
                    setIsSnapping(false);
                    setIsSwitchingDay(false);
                }
            }
        };

        void loadSnappedRoute();

        return () => {
            cancelled = true;
        };
    }, [vehicleId, from, to, selectedDay, targetRawDayPoints, displayedDay]);


     // Build a dense road-following path by walking roadGeometry and
// interpolating timestamps/speed from snappedPoints.
// This makes the vehicle follow the polyline exactly during playback.
   const roadFollowingPath = useMemo<HistoryPoint[]>(() => {
      if (roadGeometry.length < 2 || snappedPoints.length < 2) {
        return snappedPoints.length > 0 ? snappedPoints : displayedRawDayPoints;
      }

      const findNearestGeoIdx = (lat: number, lng: number, startFrom: number): number => {
        let best = startFrom;
        let bestDist = Infinity;
        const limit = Math.min(roadGeometry.length, startFrom + 300);
        for (let i = startFrom; i < limit; i++) {
          const dlat = roadGeometry[i][0] - lat;
          const dlng = roadGeometry[i][1] - lng;
          const dist = dlat * dlat + dlng * dlng;
          if (dist < bestDist) { bestDist = dist; best = i; }
        }
        return best;
      };

      const result: HistoryPoint[] = [];
      let geoSearchStart = 0;

      for (let i = 0; i < snappedPoints.length - 1; i++) {
        const fromPt = snappedPoints[i];
        const toPt   = snappedPoints[i + 1];

        const fromGeoIdx = typeof fromPt.geometryIndex === "number"
          ? Math.max(geoSearchStart, fromPt.geometryIndex)
          : findNearestGeoIdx(fromPt.lat, fromPt.lng, geoSearchStart);
        const toGeoIdx   = typeof toPt.geometryIndex === "number"
          ? Math.max(fromGeoIdx, toPt.geometryIndex)
          : findNearestGeoIdx(toPt.lat, toPt.lng, fromGeoIdx);
        geoSearchStart   = fromGeoIdx;

        const segment = roadGeometry.slice(fromGeoIdx, toGeoIdx + 1);
        if (segment.length === 0) { result.push(fromPt); continue; }

        const fromMs = new Date(fromPt.timestamp).getTime();
        const toMs   = new Date(toPt.timestamp).getTime();
        const total  = segment.length;

        segment.forEach((coord, idx) => {
          const t = total <= 1 ? 0 : idx / (total - 1);
          result.push({
            lat:       coord[0],
            lng:       coord[1],
            timestamp: new Date(fromMs + (toMs - fromMs) * t).toISOString(),
            speed:     fromPt.speed + (toPt.speed - fromPt.speed) * t,
            ignition:  fromPt.ignition,
            address:   fromPt.address,
            heading:   fromPt.heading,
            odometer:  fromPt.odometer,
          });
        });
      }

      const last = snappedPoints[snappedPoints.length - 1];
      if (last) result.push(last);

      return result.filter((p, i, arr) =>
        i === 0 || p.lat !== arr[i - 1].lat || p.lng !== arr[i - 1].lng
      );
    }, [roadGeometry, snappedPoints, displayedRawDayPoints]);

    const basePlaybackPoints = roadFollowingPath.length > 0
      ? roadFollowingPath
      : (snappedPoints.length > 0 ? snappedPoints : displayedRawDayPoints);

    const activeDayPoints = useMemo(() => {
        if (selectionMode !== "trip" || !selectedTripOption?.trip) {
            return basePlaybackPoints;
        }

        const tripStart = new Date(selectedTripOption.trip.startTime).getTime();
        const tripEnd = new Date(selectedTripOption.trip.endTime).getTime();

        return basePlaybackPoints.filter((point) => {
            const pointTime = new Date(point.timestamp).getTime();
            return pointTime >= tripStart && pointTime <= tripEnd;
        });
    }, [basePlaybackPoints, selectionMode, selectedTripOption]);

    const currentPoint = activeDayPoints[Math.min(currentIndex, activeDayPoints.length - 1)] ?? null;

    const routePositions = useMemo<[number, number][]>(
        () => activeDayPoints.map((p) => [p.lat, p.lng]),
        [activeDayPoints]
    );
    const displayedRoutePositions = useMemo<[number, number][]>(
        () => (routePositions.length > 0 ? routePositions : roadGeometry),
        [routePositions, roadGeometry],
    );

    const timelineValue = useMemo(() => {
        if (activeDayPoints.length <= 1) return 0;
        return (currentIndex / (activeDayPoints.length - 1)) * 100;
    }, [currentIndex, activeDayPoints.length]);

    const followMapIfNeeded = (
        lat: number,
        lng: number,
        options?: { force?: boolean; throttleMs?: number },
    ) => {
        if (!followVehicle || !leafletMapRef.current) return;

        const map = leafletMapRef.current;
        const force = options?.force ?? false;
        const throttleMs = options?.throttleMs ?? 250;

        if (force) {
            lastFollowPanAtRef.current = performance.now();
            map.panTo([lat, lng], {
                animate: true,
                duration: 0.35,
                easeLinearity: 0.25,
                noMoveStart: true,
            });
            return;
        }

        const point = L.latLng(lat, lng);
        const isNearViewportEdge = !map.getBounds().pad(-0.35).contains(point);
        const now = performance.now();

        if (isNearViewportEdge && now - lastFollowPanAtRef.current >= throttleMs) {
            lastFollowPanAtRef.current = now;
            map.panTo([lat, lng], {
                animate: true,
                duration: 0.25,
                easeLinearity: 0.2,
                noMoveStart: true,
            });
        }
    };

    // Handle Animation & Slider Smoothing
    useEffect(() => {
        if (activeDayPoints.length === 0) return;

        const toPoint = activeDayPoints[currentIndex];

        // 🟢 INSTANT SNAPPING FOR SLIDER JUMPS (Smooth like video)
        if (!isPlaying) {
            // Cancel any pending animations
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            const fromPoint = currentIndex > 0 ? activeDayPoints[currentIndex - 1] : toPoint;
            const snapHeading = currentIndex > 0
                ? (Math.atan2(toPoint.lng - fromPoint.lng, toPoint.lat - fromPoint.lat) * (180 / Math.PI) + 360) % 360
                : (toPoint.heading || 0);

            const snappedPosition = { lat: toPoint.lat, lng: toPoint.lng, heading: snapHeading };
            animatedPosRef.current = snappedPosition;
            setAnimatedPos(snappedPosition);
            lastIndexRef.current = currentIndex;
            followMapIfNeeded(toPoint.lat, toPoint.lng);
            return;
        }

        // 🟠 CINEMATIC ANIMATION FOR PLAYBACK (Standard smooth movement)
        if (currentIndex === 0 || lastIndexRef.current >= activeDayPoints.length) {
            const startPoint = activeDayPoints[0];
            const initialHeading = activeDayPoints.length > 1
                ? (Math.atan2(activeDayPoints[1].lng - startPoint.lng, activeDayPoints[1].lat - startPoint.lat) * (180 / Math.PI)) % 360
                : (startPoint.heading || 0);
            const initialPosition = { lat: startPoint.lat, lng: startPoint.lng, heading: initialHeading };
            animatedPosRef.current = initialPosition;
            setAnimatedPos(initialPosition);
            lastIndexRef.current = 0;
            return;
        }

        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        const fromPoint = animatedPosRef.current || activeDayPoints[lastIndexRef.current];

        // Ensure constant physical speed on screen
        const dist = Math.sqrt(Math.pow(toPoint.lat - fromPoint.lat, 2) + Math.pow(toPoint.lng - fromPoint.lng, 2));
        const baseDuration = Math.max(100, 400 / playbackSpeed);
        const duration = baseDuration * Math.min(3, Math.max(0.4, dist * 6000));

        // ALWAYS calculate heading from path for visual consistency
        const targetHeading = (Math.atan2(toPoint.lng - fromPoint.lng, toPoint.lat - fromPoint.lat) * (180 / Math.PI) + 360) % 360;

        const startedAt = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startedAt;
            const t = Math.min(elapsed / duration, 1);

            // Cubic Ease-in-out for ultimate smoothness
            const easedT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            const lat = fromPoint.lat + (toPoint.lat - fromPoint.lat) * easedT;
            const lng = fromPoint.lng + (toPoint.lng - fromPoint.lng) * easedT;

            // Smoothly rotate the marker using shortest path
            const startH = animatedPosRef.current?.heading ?? targetHeading;
            let diff = targetHeading - startH;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;
            const h = startH + diff * easedT;

            const nextPosition = { lat, lng, heading: h };
            animatedPosRef.current = nextPosition;
            setAnimatedPos(nextPosition);
            followMapIfNeeded(lat, lng);

            if (t < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);
        lastIndexRef.current = currentIndex;

        return () => {
            if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [currentIndex, isPlaying, followVehicle, playbackSpeed, activeDayPoints]);

    // Handle Playback Interval
    useEffect(() => {
        if (!isPlaying || activeDayPoints.length <= 1) return;

        const interval = Math.max(50, 400 / playbackSpeed);
        const timer = setInterval(() => {
            setCurrentIndex((prev) => {
                const next = prev + 1;
                if (next >= activeDayPoints.length) {
                    setIsPlaying(false);
                    return prev;
                }
                return next;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [isPlaying, playbackSpeed, activeDayPoints.length]);

    // Reset once the displayed route actually changes
    useEffect(() => {
        setIsPlaying(false);
        setCurrentIndex(0);
        lastIndexRef.current = 0;
        if (activeDayPoints.length > 0) {
            const resetPosition = { lat: activeDayPoints[0].lat, lng: activeDayPoints[0].lng, heading: activeDayPoints[0].heading || 0 };
            animatedPosRef.current = resetPosition;
            setAnimatedPos(resetPosition);
            if (leafletMapRef.current) {
                const bounds = activeDayPoints.map(p => [p.lat, p.lng] as [number, number]);
                leafletMapRef.current.fitBounds(bounds, { padding: [20, 20] });
            }
        }
    }, [displayedDay, activeDayPoints]);

    const zoomToRoute = () => {
        if (!leafletMapRef.current || activeDayPoints.length === 0) return;
        leafletMapRef.current.fitBounds(displayedRoutePositions, { padding: [30, 30] });
    };

    const handleTimelineChange = (val: number) => {
        const idx = Math.floor((val / 100) * (activeDayPoints.length - 1));
        setIsPlaying(false);
        setCurrentIndex(idx);
    };

    const handleDaySelection = (day: string | null) => {
        if (day === selectedDay) return;
        startSelectionTransition(() => {
            setSelectedDay(day);
            setSelectedTripKey(null);
            setSelectionMode(day ? "day" : "full");
            if (day !== displayedDay) {
                setIsSwitchingDay(true);
            }
        });
    };

    const handleTripSelection = (value: string) => {
        startSelectionTransition(() => {
            if (value === "__day__") {
                setSelectedTripKey(null);
                setSelectionMode(selectedDay ? "day" : "full");
                return;
            }

            setSelectedTripKey(value);
            setSelectionMode("trip");
        });
    };

    const formatSeconds = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // Grouping consecutive points into status events + Turn Detection
    const eventMarkers = useMemo(() => {
        if (activeDayPoints.length === 0) return [];
        const markers: any[] = [];
        let currentStatus: string | null = null;
        let group: any = null;

        activeDayPoints.forEach((p, idx) => {
            // 1. Status Detection
            let status = 'stopped';
            if (p.speed > 5) status = 'running';
            else if (p.ignition) status = 'idle';

            // 2. Turn & U-Turn Detection (Only if running)
            if (idx > 2 && status === 'running') {
                const prev = activeDayPoints[idx - 1];
                const pPrev = activeDayPoints[idx - 2];

                // Visual bearing calculation
                const b1 = Math.atan2(prev.lng - pPrev.lng, prev.lat - pPrev.lat) * 180 / Math.PI;
                const b2 = Math.atan2(p.lng - prev.lng, p.lat - prev.lat) * 180 / Math.PI;
                const turnAngle = (b2 - b1 + 540) % 360 - 180;
                const absTurn = Math.abs(turnAngle);

                if (absTurn > 140) { // U-Turn
                    if (!markers.some(m => m.type === 'uturn' && (idx - activeDayPoints.findIndex(ap => ap.timestamp === m.timestamp)) < 10)) {
                        markers.push({ type: 'uturn', lat: p.lat, lng: p.lng, timestamp: p.timestamp });
                    }
                } else if (absTurn > 65) { // Significant Turn
                    const isRight = turnAngle > 0;
                    if (!markers.some(m => (m.type === 'left' || m.type === 'right') && (idx - activeDayPoints.findIndex(ap => ap.timestamp === m.timestamp)) < 10)) {
                        markers.push({ type: isRight ? 'right' : 'left', lat: p.lat, lng: p.lng, timestamp: p.timestamp });
                    }
                }
            }

            // 3. Connection Gap Detection
            if (idx > 0) {
                const prev = activeDayPoints[idx - 1];
                const gap = (new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
                if (gap > 600) {
                    markers.push({ type: 'inactive', lat: prev.lat, lng: prev.lng, start: prev.timestamp, end: p.timestamp, duration: gap });
                }
            }

            // 4. Start/Stop Clustering
            if (status !== currentStatus) {
                if (group) {
                    const duration = (new Date(group.end).getTime() - new Date(group.start).getTime()) / 1000;
                    if ((group.type === 'stopped' || group.type === 'idle') && duration > 20) {
                        markers.push({ ...group, isStop: true });
                    }
                    if (group.type === 'running' && idx > 0) {
                        markers.push({ type: 'start', lat: activeDayPoints[Math.max(0, idx - group.points.length)].lat, lng: activeDayPoints[Math.max(0, idx - group.points.length)].lng, timestamp: group.start });
                    }
                }
                currentStatus = status;
                group = { type: status, lat: p.lat, lng: p.lng, start: p.timestamp, end: p.timestamp, points: [p] };
            } else if (group) {
                group.end = p.timestamp;
                group.points.push(p);
            }
        });

        // Add start/end of route indicators
        if (activeDayPoints.length > 0) {
            markers.push({ type: 'origin', lat: activeDayPoints[0].lat, lng: activeDayPoints[0].lng, timestamp: activeDayPoints[0].timestamp });
            markers.push({ type: 'destination', lat: activeDayPoints[activeDayPoints.length - 1].lat, lng: activeDayPoints[activeDayPoints.length - 1].lng, timestamp: activeDayPoints[activeDayPoints.length - 1].timestamp });
        }

        return markers;
    }, [activeDayPoints]);

    const renderedArrowMarkers = useMemo(() => {
        if (!visibleStatuses.has('arrows') || activeDayPoints.length <= 2) return null;

        const step = Math.max(10, Math.floor(activeDayPoints.length / 15));
        return activeDayPoints.map((p, i) => {
            if (i % step !== 0 || i >= activeDayPoints.length - 1) return null;
            const pNext = activeDayPoints[i + 1];
            const bearing = Math.atan2(pNext.lng - p.lng, pNext.lat - p.lat) * 180 / Math.PI;

            return (
                <Marker
                    key={`arrow-${i}`}
                    position={[p.lat, p.lng]}
                    interactive={false}
                    icon={L.divIcon({
                        className: "direction-arrow-marker",
                        html: `<div style="transform: rotate(${bearing}deg); color: #22c55e; filter: drop-shadow(0 0 2px rgba(0,0,0,0.4));">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                            </svg>
                        </div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })}
                />
            );
        });
    }, [activeDayPoints, visibleStatuses]);

    const renderedEventMarkers = useMemo(() => {
        return eventMarkers.map((marker, idx) => {
            if (marker.type === 'uturn' && !visibleStatuses.has('uturn')) return null;
            if (['left', 'right'].includes(marker.type) && !visibleStatuses.has('turns')) return null;
            if (['stopped', 'idle', 'inactive', 'start'].includes(marker.type) && !visibleStatuses.has(marker.type)) return null;

            let html = "";
            let size: [number, number] = [24, 24];

            switch (marker.type) {
                case 'stopped':
                    html = `<div style="background: #ef4444; width: 24px; height: 24px; border: 2px solid white; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 8px; font-weight: 900; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">STOP</div>`;
                    break;
                case 'idle':
                    html = `<div style="background: #f97316; width: 22px; height: 22px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 900;">I</div>`;
                    break;
                case 'uturn':
                    html = `<div style="background: #f97316; width: 28px; height: 28px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                                 <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                             </div>`;
                    size = [28, 28];
                    break;
                case 'left':
                case 'right':
                    const rot = marker.type === 'left' ? -90 : 90;
                    html = `<div style="background: #2563eb; width: 24px; height: 24px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; transform: rotate(${rot}deg); box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                                 <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                             </div>`;
                    break;
                case 'start':
                    html = `<div style="background: #2f8d35; width: 24px; height: 24px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>`;
                    break;
                case 'origin':
                    html = `<div style="background: #22c55e; width: 12px; height: 12px; border: 2px solid white; border-radius: 50%;"></div>`;
                    size = [12, 12];
                    break;
                case 'destination':
                    html = `<div style="background: #ef4444; width: 12px; height: 12px; border: 2px solid white; border-radius: 50%;"></div>`;
                    size = [12, 12];
                    break;
                default:
                    return null;
            }

            return (
                <Marker
                    key={`event-${idx}`}
                    position={[marker.lat, marker.lng]}
                    icon={L.divIcon({
                        className: `status-event-marker ${marker.type}`,
                        html: html,
                        iconSize: size,
                        iconAnchor: [size[0] / 2, size[1] / 2]
                    })}
                >
                    <Popup>
                        <div className="p-1 min-w-[140px]">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-slate-800">
                                {marker.type.replace('_', ' ')} Event
                            </h4>
                            <p className="text-[10px] font-bold text-slate-500">
                                {new Date(marker.timestamp || marker.start).toLocaleTimeString()}
                            </p>
                        </div>
                    </Popup>
                </Marker>
            );
        });
    }, [eventMarkers, visibleStatuses]);

    // Calculate Summary Stats from points
    const stats = useMemo(() => {
        if (activeDayPoints.length < 2) return { dist: 0, driving: 0, idle: 0, stop: 0, avg: 0 };
        let dist = 0;
        let driving = 0;
        let idle = 0;
        let stop = 0;

        for (let i = 1; i < activeDayPoints.length; i++) {
            const p1 = activeDayPoints[i - 1];
            const p2 = activeDayPoints[i];
            const dt = (new Date(p2.timestamp).getTime() - new Date(p1.timestamp).getTime()) / 1000;

            // Basic distance calculation with jump threshold to match backend
            const r = 6371;
            const dLat = (p2.lat - p1.lat) * Math.PI / 180;
            const dLon = (p2.lng - p1.lng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const delta = r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            if (delta > 0 && delta < 5) { // 5km jump threshold
                dist += delta;
            }

            if (p2.speed > 2) driving += dt;
            else if (p2.speed <= 2 && p2.ignition) idle += dt;
            else stop += dt;
        }

        const avg = activeDayPoints.reduce((acc, p) => acc + (p.speed || 0), 0) / activeDayPoints.length;
        return { dist, driving, idle, stop, avg };
    }, [activeDayPoints]);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center bg-white">
                <Loader2 className="animate-spin text-blue-600" />
                <span className="ml-2 text-sm font-semibold text-gray-500">Loading history...</span>
            </div>
        );
    }

    if (points.length === 0 && !isFetching) {
        return (
            <div className="flex h-48 flex-col items-center justify-center bg-gray-50 p-6">
                <MapPin size={32} className="mb-2 text-gray-300" />
                <p className="text-sm font-bold text-gray-900">No History Found</p>
                <p className="text-xs text-gray-500 text-center max-w-xs mt-1">
                    Wait for some time or check if device is transmitting data correctly for the selected period.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full bg-white border-y border-gray-200 shadow-inner">
            <div className="flex flex-col xl:flex-row min-h-[500px]">
                {/* Left Side: Map and Controls */}
                <div className="flex-1 border-r border-gray-100 flex flex-col min-w-0">

                    {/* Controls Bar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-gray-50/50 border-b border-gray-100">
                        <div className="flex items-center gap-1.5 p-1 bg-white border border-gray-200 rounded-lg shadow-sm">
                            <button onClick={() => { setIsPlaying(false); setCurrentIndex(0); }} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
                                <SkipBack size={16} />
                            </button>
                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm hover:bg-blue-700 transition-all"
                            >
                                {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                            </button>
                            <button onClick={() => setCurrentIndex(0)} title="Reset" className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
                                <RotateCcw size={16} />
                            </button>
                            <button onClick={() => setCurrentIndex(activeDayPoints.length - 1)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
                                <SkipForward size={16} />
                            </button>
                        </div>

                        <select
                            className="h-9 px-3 text-xs font-bold bg-white border border-gray-200 rounded-lg shadow-sm outline-none"
                            value={playbackSpeed}
                            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                        >
                            <option value={1}>1x</option>
                            <option value={2}>2x</option>
                            <option value={5}>5x</option>
                            <option value={10}>10x</option>
                        </select>

                        <Button
                            variant={followVehicle ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFollowVehicle(!followVehicle)}
                            className="h-9 gap-2 text-xs font-bold"
                        >
                            <Navigation size={14} className={followVehicle ? "fill-white" : ""} />
                            Follow
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={zoomToRoute}
                            className="h-9 gap-2 text-xs font-bold"
                        >
                            <ZoomIn size={14} />
                            Zoom to route
                        </Button>

                        {/* Date Tabs */}
                        {days.length > 1 && (
                            <div className="ml-auto flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                                {(isSwitchingDay || isPendingSelection) && (
                                    <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-blue-600">
                                        <Loader2 size={10} className="animate-spin" />
                                        Switching playback...
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => handleDaySelection(null)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-full border transition-all ${!selectedDay ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                    All days
                                </button>
                                {days.map(day => (
                                    <button
                                        key={day}
                                        onClick={() => handleDaySelection(day)}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-full border transition-all whitespace-nowrap ${selectedDay === day ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                    >
                                        {new Date(day + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                    </button>
                                ))}
                                </div>
                            </div>
                        )}

                        {selectedDay && selectedDayTripOptions.length > 1 && (
                            <div className="flex min-w-[240px] items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-gray-400">Trip</span>
                                <select
                                    value={selectionMode === "trip" && selectedTripKey ? selectedTripKey : "__day__"}
                                    onChange={(event) => handleTripSelection(event.target.value)}
                                    className="h-9 min-w-[230px] rounded-lg border border-gray-200 bg-white px-3 text-[10px] font-bold text-gray-700 shadow-sm outline-none transition focus:border-blue-300"
                                >
                                    <option value="__day__">All trips of selected day</option>
                                    {selectedDayTripOptions.map((option) => (
                                        <option key={option.key} value={option.key}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Timeline Slider */}
                    <div className="px-6 py-4 border-b border-gray-100 relative">
                        {isSnapping && (
                            <div className="absolute top-0 right-6 text-[9px] font-black text-blue-500 uppercase flex items-center gap-1.5 animate-pulse">
                                <Activity size={10} />
                                Snapping to roads...
                            </div>
                        )}
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={timelineValue}
                            onChange={(e) => handleTimelineChange(Number(e.target.value))}
                            className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="mt-2 flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <span>{currentPoint ? new Date(currentPoint.timestamp).toLocaleString() : "No timestamp"}</span>
                            <span>Point {currentIndex + 1} of {activeDayPoints.length}</span>
                        </div>
                    </div>

                    {/* Map Area */}
                    <div className="flex-1 relative bg-gray-100 h-[400px]">
                        {(isSwitchingDay || isSnapping || isPendingSelection) && (
                            <div className="pointer-events-none absolute inset-0 z-[350] flex items-start justify-center bg-white/18 backdrop-blur-[1.5px]">
                                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 shadow-sm">
                                    <Loader2 size={12} className="animate-spin text-blue-600" />
                                    {isSwitchingDay ? "Switching playback..." : isPendingSelection ? "Updating selection..." : "Refreshing route..."}
                                </div>
                            </div>
                        )}
                        <MapContainer
                            center={routePositions[0] || [20.5, 78.9]}
                            zoom={12}
                            className="h-full w-full z-0"
                            scrollWheelZoom={true}
                        >
                            <MapTileLayer />
                            <MapInstanceAccessor onMap={(map) => { leafletMapRef.current = map; }} />

                            {routePositions.length > 1 && (
                                <>
                                    <Polyline
                                        positions={displayedRoutePositions}
                                        pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.8 }}
                                    />
                                    {renderedArrowMarkers}
                                </>
                            )}

                            {(animatedPos || currentPoint) && (
                                <Marker
                                    position={[animatedPos?.lat ?? currentPoint.lat, animatedPos?.lng ?? currentPoint.lng]}
                                    icon={L.divIcon({
                                        className: "animated-vehicle-marker",
                                        html: `<div class="vehicle-icon-wrapper" style="transform: rotate(${(animatedPos?.heading ?? 0)}deg)">
                                            <div class="pulse-ring"></div>
                                            <svg viewBox="0 0 24 24" width="36" height="36" fill="#2563eb" stroke="white" stroke-width="1.5">
                                                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                                            </svg>
                                        </div>`,
                                        iconSize: [40, 40],
                                        iconAnchor: [20, 20]
                                    })}
                                >
                                    <Popup>
                                        <div className="text-[10px] font-bold min-w-[120px]">
                                            <p className="border-b border-gray-100 mb-1.5 pb-1.5 text-gray-400 uppercase tracking-widest">Live Telemetry</p>
                                            <div className="space-y-1">
                                                <p className="flex justify-between items-center">
                                                    <span className="text-gray-400 font-medium">Time</span>
                                                    <span>{new Date(currentPoint.timestamp).toLocaleTimeString()}</span>
                                                </p>
                                                <p className="flex justify-between items-center text-blue-600">
                                                    <span className="font-medium">Speed</span>
                                                    <span>{currentPoint.speed.toFixed(1)} km/h</span>
                                                </p>
                                                <p className="flex justify-between items-center">
                                                    <span className="text-gray-400 font-medium">Ignition</span>
                                                    <span className={currentPoint.ignition ? 'text-green-600' : 'text-red-500'}>
                                                        {currentPoint.ignition ? 'ON' : 'OFF'}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            )}

                            {renderedEventMarkers}
                        </MapContainer>

                        {/* Status Filter Buttons Overlay */}
<div className="absolute top-20 left-3 z-[400] rounded-2xl border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur-md overflow-visible">
    <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-400">Map Filters</p>
                            </div>
                           <div className="flex flex-col gap-2 items-start">
        {mapFilterButtons.map((button) => {
            const Icon = button.icon;
            const isActive = visibleStatuses.has(button.key);

            return (
                <button
                    key={button.key}
                    onClick={() => toggleStatus(button.key)}
                    className={`group relative inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 ${
                        isActive
                            ? `${button.activeClass} scale-[1.02]`
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                    }`}
                    title={button.label}
                    aria-label={button.label}
                >
                    <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${
                            isActive ? 'bg-white/15' : 'bg-gray-50'
                        }`}
                    >
                        <Icon
                            size={13}
                            className={
                                button.key === 'arrows' && isActive
                                    ? 'animate-pulse'
                                    : ''
                            }
                        />
                    </span>

                    {/* Tooltip */}
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#0f172a] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 z-[999]">
                        {button.label}
                    </span>
                </button>
            );
        })}
    </div>
</div>
                    </div>

                </div>

                {/* Right Side: Sidebar Info */}
                <div className="w-full xl:w-[340px] bg-white flex flex-col">

                    {/* Vehicle Overview */}
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Vehicle Overview</h3>
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-blue-50 text-blue-600 rounded">ACTIVE</span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-lg font-black text-gray-900">{vehicleNumber}</h4>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{metadata?.model || "Standard Fleet"}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Type</p>
                                    <p className="text-xs font-bold text-gray-700">{metadata?.vehicleType || "Commercial"}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">IMEI</p>
                                    <p className="text-xs font-bold text-gray-700 truncate">{metadata?.imei || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Make</p>
                                    <p className="text-xs font-bold text-gray-700">{metadata?.brand || "Generic"}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Organization</p>
                                    <p className="text-xs font-bold text-gray-700">{metadata?.organization || "Fleet"}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Trip Summary (When playing specific range) */}
                    {selectionMode === "trip" && (
                        <div className="px-5 py-6 bg-[#0f172a] text-white border-b border-white/5 relative overflow-hidden group">
                            {/* Decorative background element */}
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#2f8d35]/10 rounded-full blur-2xl group-hover:bg-[#2f8d35]/20 transition-all duration-700"></div>

                            <div className="relative z-10">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#4ade80] mb-5 flex items-center gap-2.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse"></div>
                                    Trip Segment Focus
                                </h3>

                                <div className="flex gap-4">
                                    <div className="w-1 rounded-full bg-gradient-to-b from-[#4ade80] via-[#fbbf24] to-[#f87171] shadow-[0_0_10px_rgba(74,222,128,0.3)]"></div>
                                    <div className="flex-1 space-y-5">
                                        <div className="relative">
                                            <div className="mb-1.5 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/40">
                                                <span className="h-1 w-1 rounded-full bg-white/20"></span>
                                                <span>Start Phase</span>
                                            </div>
                                            <p className="text-xs font-bold text-white tracking-tight">
                                                {activeDayPoints[0] ? new Date(activeDayPoints[0].timestamp).toLocaleString('en-IN', {
                                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
                                                }) : "-"}
                                            </p>
                                            <p className="text-[10px] text-white/50 leading-relaxed mt-1 line-clamp-2 italic font-medium" title={formatAddressText(activeDayPoints[0]?.address)}>
                                                {formatAddressText(activeDayPoints[0]?.address)}
                                            </p>
                                        </div>

                                        <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent"></div>

                                        <div className="relative">
                                            <div className="mb-1.5 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/40">
                                                <span className="h-1 w-1 rounded-full bg-white/20"></span>
                                                <span>End Phase</span>
                                            </div>
                                            <p className="text-xs font-bold text-white tracking-tight">
                                                {activeDayPoints[activeDayPoints.length - 1] ? new Date(activeDayPoints[activeDayPoints.length - 1].timestamp).toLocaleString('en-IN', {
                                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
                                                }) : "-"}
                                            </p>
                                            <p className="text-[10px] text-white/50 leading-relaxed mt-1 line-clamp-2 italic font-medium" title={formatAddressText(activeDayPoints[activeDayPoints.length - 1]?.address)}>
                                                {formatAddressText(activeDayPoints[activeDayPoints.length - 1]?.address)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Playback Snapshot */}
                    <div className="p-6 bg-gray-50/30 flex-1">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Playback Snapshot</h3>
                        <div className="space-y-3">
                            <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                        <Clock size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Time</p>
                                        <p className="text-xs font-bold text-gray-800 mt-1">{currentPoint ? new Date(currentPoint.timestamp).toLocaleTimeString() : "--:--:--"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                        <Gauge size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Speed</p>
                                        <p className="text-xs font-bold text-gray-800 mt-1">{currentPoint?.speed.toFixed(1) || "0.0"} km/h</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                        <Navigation size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Driver</p>
                                        <p className="text-xs font-bold text-gray-800 mt-1">{metadata?.driverName || "Standard Driver"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                    <MapPin size={16} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Location</p>
                                    <p className="text-xs font-semibold text-gray-600 mt-1 line-clamp-2">{formatAddressText(currentPoint?.address)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Layer Toggles */}
                        <div className="mt-6">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Map Layers</h3>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => toggleStatus('arrows')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 shadow-sm border ${visibleStatuses.has('arrows') ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-gray-400 border-gray-100'}`}
                                >
                                    <Navigation size={12} className={visibleStatuses.has('arrows') ? 'rotate-45' : ''} />
                                    Arrows
                                </button>
                                <button
                                    onClick={() => toggleStatus('turns')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 shadow-sm border ${visibleStatuses.has('turns') ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-gray-400 border-gray-100'}`}
                                >
                                    <CornerUpRight size={12} />
                                    Turns
                                </button>
                                <button
                                    onClick={() => toggleStatus('uturn')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 shadow-sm border ${visibleStatuses.has('uturn') ? 'bg-orange-500 text-white border-orange-400' : 'bg-white text-gray-400 border-gray-100'}`}
                                >
                                    <RotateCcw size={12} />
                                    U-Turn
                                </button>
                            </div>
                        </div>

                        {/* Summary Block */}
                        <div className="mt-6 grid grid-cols-2 gap-2">
                            <div className="p-3 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-200">
                                <p className="text-[8px] font-black uppercase tracking-wider opacity-60">Total Distance</p>
                                <p className="text-base font-black">{(stats.dist || metadata?.totalDistance || 0).toFixed(1)} <span className="text-[9px] opacity-60">KM</span></p>
                            </div>
                            <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                <p className="text-[8px] font-black uppercase tracking-wider text-gray-400">Avg Speed</p>
                                <p className="text-base font-black text-gray-800">{(stats.avg || metadata?.avgSpeed || 0).toFixed(0)} <span className="text-[9px] text-gray-400">KM/H</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .leaflet-container {
                    background: #f8fafc !important;
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    background: #2563eb;
                    border: 2px solid white;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }

                .animated-vehicle-marker {
                    background: none !important;
                    border: none !important;
                }
                .vehicle-icon-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    filter: drop-shadow(0 0 12px rgba(37, 99, 235, 0.4));
                    background: white;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    border: 3px solid #2563eb;
                    position: relative;
                }
                .pulse-ring {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    background: rgba(37, 99, 235, 0.4);
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                .direction-arrow-marker {
                    background: none !important;
                    border: none !important;
                }
            `}</style>
        </div>
    );
};

export default TravelPlaybackInline;
