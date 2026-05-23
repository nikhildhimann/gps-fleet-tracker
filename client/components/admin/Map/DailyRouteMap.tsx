"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, useMap, useMapEvents } from "react-leaflet";
import { DivIcon, latLng, latLngBounds, Map as LeafletMap } from "leaflet";
import { Play, Pause, RotateCcw, Map as MapIcon, Crosshair } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import MapTileLayer from "./MapTileLayer";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Point = {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  ignition: boolean;
  heading?: number;
  alertType?: string;
};

type StopMarker = {
  lat: number;
  lng: number;
  start: string;
  end: string;
  duration: number;
  ignition: boolean;
  type: "idle" | "stop";
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpHeading = (from: number, to: number, t: number) => {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return from + delta * t;
};

const haversineKm = (a: Point, b: Point) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Minimum stop duration (seconds) to render a stop marker */
const STOP_MIN_DURATION_SEC = 60;

const formatDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

/* ─── Icons ──────────────────────────────────────────────────────────────── */

/** Pill-shaped endpoint icon (start = green, end = red) */
const makeEndpointIcon = (color: string, label: string) =>
  new DivIcon({
    html: `<div style="display:inline-flex;align-items:center;gap:4px;background:${color};color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:9999px;border:2px solid rgba(255,255,255,0.85);box-shadow:0 2px 8px rgba(0,0,0,0.35);white-space:nowrap;">${label}</div>`,
    iconSize: [48, 22],
    iconAnchor: [24, 11],
  });

const startIcon = makeEndpointIcon("#22c55e", "▶ Start");
const endIcon = makeEndpointIcon("#ef4444", "■ End");

/** Square stop / idle marker */
const makeStopIcon = (type: "idle" | "stop") =>
  new DivIcon({
    html: `<div style="width:14px;height:14px;background:${type === "idle" ? "#f59e0b" : "#94a3b8"};border:2px solid #fff;border-radius:3px;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

/** Alert marker (overspeed / harsh-brake / emergency) */
const makeAlertIcon = (alertType: string) => {
  const color = alertType.toLowerCase().includes("emergency")
    ? "#dc2626"
    : alertType.toLowerCase().includes("over")
      ? "#f97316"
      : "#eab308"; // harsh-brake / generic
  return new DivIcon({
    html: `<div style="width:16px;height:16px;background:${color};border:2px solid #fff;border-radius:9999px;box-shadow:0 0 8px ${color}99;display:flex;align-items:center;justify-content:center;font-size:9px;">⚠</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

/** Animated vehicle icon */
const carIcon = (heading: number) =>
  new DivIcon({
    html: `<div style="width:30px;height:18px;border-radius:5px;background:#0ea5e9;border:2px solid #0b2540;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:bold;transform:rotate(${heading}deg);box-shadow:0 3px 10px rgba(0,0,0,0.4);">🚗</div>`,
    iconSize: [30, 18],
    iconAnchor: [15, 9],
  });

/* ─── Smart zoom ─────────────────────────────────────────────────────────── */

const computeSmartZoom = (pts: Point[]) => {
  if (pts.length < 2) return 15;
  let dist = 0;
  for (let i = 1; i < pts.length; i++) dist += haversineKm(pts[i - 1], pts[i]);
  if (dist > 80) return 11;
  if (dist > 30) return 12;
  if (dist > 10) return 13;
  if (dist > 3) return 14;
  return 15;
};

/* ─── FitBounds helper ───────────────────────────────────────────────────── */

function FitBounds({ pts }: { pts: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (!pts.length) return;
    map.fitBounds(latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [40, 40] });
  }, [map, pts]);
  return null;
}

/* ─── Route click popup ──────────────────────────────────────────────────── */

/**
 * Invisible click catcher: clicking anywhere on the map while NOT on a marker
 * opens a popup at the nearest path point showing telemetry for that position.
 */
function RouteClickPopup({ path }: { path: Point[] }) {
  const [clickInfo, setClickInfo] = useState<{ latlng: [number, number]; point: Point } | null>(null);

  useMapEvents({
    click(e) {
      if (path.length === 0) return;
      const { lat, lng } = e.latlng;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < path.length; i++) {
        const d = (path[i].lat - lat) ** 2 + (path[i].lng - lng) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      // Only show popup when click is within ~150 m of the route
      if (Math.sqrt(bestDist) < 0.0015) {
        setClickInfo({ latlng: [lat, lng], point: path[bestIdx] });
      } else {
        setClickInfo(null);
      }
    },
    popupclose() {
      setClickInfo(null);
    },
  });

  if (!clickInfo) return null;
  const { latlng, point } = clickInfo;

  return (
    <Popup position={latlng}>
      <div className="space-y-1 text-xs">
        <div className="font-semibold text-slate-800">📍 Route Point</div>
        <div>🕐 {new Date(point.timestamp).toLocaleString()}</div>
        <div>🚀 Speed: {point.speed.toFixed(1)} km/h</div>
        {point.heading != null && <div>🧭 Heading: {point.heading.toFixed(0)}°</div>}
        <div>🔑 Ignition: {point.ignition ? "ON" : "OFF"}</div>
        {point.alertType && <div>⚠ Alert: {point.alertType}</div>}
      </div>
    </Popup>
  );
}

const StaticRouteLayers = memo(function StaticRouteLayers({
  path,
  routePositions,
  mapTheme,
  start,
  end,
  visibleStops,
  alertMarkers,
  baseZoom,
}: {
  path: Point[];
  routePositions: [number, number][];
  mapTheme: "satellite" | "street";
  start?: Point;
  end?: Point;
  visibleStops: StopMarker[];
  alertMarkers: Point[];
  baseZoom: number;
}) {
  const map = useMap();

  return (
    <>
      <MapTileLayer satellite={mapTheme === "satellite"} />
      <FitBounds pts={path} />

      <Polyline positions={routePositions} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.88 }} />

      <RouteClickPopup path={path} />

      {start && (
        <Marker position={[start.lat, start.lng]} icon={startIcon}>
          <Popup className="text-xs">
            <div className="font-semibold">Route Start</div>
            <div>🕐 {new Date(start.timestamp).toLocaleString()}</div>
            <div>🚀 Speed: {start.speed.toFixed(1)} km/h</div>
            <div>🔑 Ignition: {start.ignition ? "ON" : "OFF"}</div>
          </Popup>
        </Marker>
      )}

      {end && (
        <Marker position={[end.lat, end.lng]} icon={endIcon}>
          <Popup className="text-xs">
            <div className="font-semibold">Route End</div>
            <div>🕐 {new Date(end.timestamp).toLocaleString()}</div>
            <div>🚀 Speed: {end.speed.toFixed(1)} km/h</div>
            <div>🔑 Ignition: {end.ignition ? "ON" : "OFF"}</div>
          </Popup>
        </Marker>
      )}

      {visibleStops.map((s, idx) => (
        <Marker
          key={`stop-${idx}`}
          position={[s.lat, s.lng]}
          icon={makeStopIcon(s.type)}
          eventHandlers={{
            click: (e) => {
              map.flyTo([s.lat, s.lng], Math.max(baseZoom, 16), { duration: 0.4 });
              (e.target as any)?.openPopup?.();
            },
          }}
        >
          <Popup className="text-xs">
            <div className="font-semibold">{s.type === "idle" ? "🟡 Idle Stop" : "⬜ Stop"}</div>
            <div>🕐 Start: {new Date(s.start).toLocaleTimeString()}</div>
            <div>🕐 End: {new Date(s.end).toLocaleTimeString()}</div>
            <div>⏱ Duration: {formatDuration(s.duration)}</div>
            <div>🔑 Ignition: {s.ignition ? "ON" : "OFF"}</div>
          </Popup>
        </Marker>
      ))}

      {alertMarkers.map((p, idx) => (
        <Marker key={`alert-${idx}`} position={[p.lat, p.lng]} icon={makeAlertIcon(p.alertType!)}>
          <Popup className="text-xs">
            <div className="font-semibold">⚠ {p.alertType}</div>
            <div>🕐 {new Date(p.timestamp).toLocaleString()}</div>
            <div>🚀 Speed: {p.speed.toFixed(1)} km/h</div>
            {p.heading != null && <div>🧭 Heading: {p.heading.toFixed(0)}°</div>}
            <div>🔑 Ignition: {p.ignition ? "ON" : "OFF"}</div>
          </Popup>
        </Marker>
      ))}
    </>
  );
});

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function DailyRouteMap({ points, satellite = true }: { points: Point[]; satellite?: boolean }) {
  const path = useMemo(() => {
    const filtered = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    return filtered.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [points]);

  const [map, setMap] = useState<LeafletMap | null>(null);
  const [mapTheme, setMapTheme] = useState<"satellite" | "street">(satellite ? "satellite" : "street");
  const [playheadIdx, setPlayheadIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [stopFilter, setStopFilter] = useState<"all" | "normal" | "idle" | "hide">("all");
  const [renderPoint, setRenderPoint] = useState<Point | null>(null);
  const [isStopMenuOpen, setIsStopMenuOpen] = useState(false);

  const holdUntilRef = useRef<number>(0);
  const animRef = useRef<number | undefined>(undefined);
  const lastFollowMoveRef = useRef(0);
  const baseZoom = useMemo(() => computeSmartZoom(path), [path]);
  const routePositions = useMemo(() => path.map((p) => [p.lat, p.lng] as [number, number]), [path]);

  useEffect(() => setMapTheme(satellite ? "satellite" : "street"), [satellite]);

  useEffect(() => {
    setPlayheadIdx(0);
    setIsPlaying(false);
    setRenderPoint(path[0] || null);
    holdUntilRef.current = 0;
  }, [path]);

  /* ── Playback animation ── */
  useEffect(() => {
    if (!isPlaying || path.length < 2) return;
    let localIdx = playheadIdx;
    let progress = 0;
    let last = performance.now();
    const stepMs = 900;

    const loop = (now: number) => {
      if (!isPlaying) return;
      if (now < holdUntilRef.current) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const dt = now - last;
      last = now;
      progress += (dt * playSpeed) / stepMs;

      const current = path[localIdx];
      const next = path[Math.min(localIdx + 1, path.length - 1)];
      const t = Math.min(progress, 1);
      const heading = lerpHeading(current.heading ?? 0, next.heading ?? current.heading ?? 0, t);

      setRenderPoint({
        ...current,
        lat: lerp(current.lat, next.lat, t),
        lng: lerp(current.lng, next.lng, t),
        heading,
        speed: lerp(current.speed, next.speed, t),
      });

      if (progress >= 1 && localIdx < path.length - 1) {
        progress = 0;
        localIdx += 1;
        if (path[localIdx].speed === 0 && path[Math.max(localIdx - 1, 0)].speed > 0) {
          holdUntilRef.current = now + 900;
        }
        setPlayheadIdx(localIdx);
      }
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, playSpeed, path, playheadIdx]);

  const activePoint = path[Math.min(playheadIdx, Math.max(path.length - 1, 0))];
  const start = path[0];
  const end = path[path.length - 1];

  useEffect(() => {
    if (!map || !start) return;
    map.setView([start.lat, start.lng], baseZoom);
    const bounds = latLngBounds(path.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: baseZoom });
  }, [map, start, path, baseZoom]);

  const centerOnActive = useCallback(
    (opts?: { forceZoom?: boolean; point?: { lat: number; lng: number } }) => {
      const targetPoint = opts?.point || activePoint;
      if (!map || !targetPoint) return false;
      const target = latLng(targetPoint.lat, targetPoint.lng);
      const center = map.getCenter();
      const distance = center.distanceTo(target);
      const currentZoom = map.getZoom();
      const desiredZoom = opts?.forceZoom ? Math.max(currentZoom, baseZoom) : Math.max(currentZoom, baseZoom - 1);
      const now = performance.now();

      if (opts?.forceZoom) {
        map.flyTo(target, desiredZoom, { duration: 0.35 });
        lastFollowMoveRef.current = now;
        return true;
      }

      // Throttle follow updates so the map glides instead of fighting the marker.
      if (distance > 120 && now - lastFollowMoveRef.current > 220) {
        map.panTo(target, { animate: true, duration: 0.25 });
        lastFollowMoveRef.current = now;
        return true;
      }

      return false;
    },
    [map, activePoint, baseZoom],
  );

  useEffect(() => {
    if (!isPlaying || !renderPoint) return;
    centerOnActive({ point: renderPoint });
  }, [renderPoint, isPlaying, centerOnActive]);

  useEffect(() => {
    if (!isPlaying && playheadIdx === 0) centerOnActive({ forceZoom: true, point: path[0] });
  }, [playheadIdx, isPlaying, centerOnActive, path]);

  /* ── Stop detection (minimum duration threshold) ── */
  const stops = useMemo(() => {
    const result: StopMarker[] = [];
    let streak: Point[] = [];

    path.forEach((p) => {
      if (p.speed === 0) streak.push(p);
      else {
        if (streak.length > 2) {
          const s = streak[0];
          const e = streak[streak.length - 1];
          const durationSec = (new Date(e.timestamp).getTime() - new Date(s.timestamp).getTime()) / 1000;
          if (durationSec >= STOP_MIN_DURATION_SEC) {
            result.push({
              lat: streak[Math.floor(streak.length / 2)].lat,
              lng: streak[Math.floor(streak.length / 2)].lng,
              start: s.timestamp,
              end: e.timestamp,
              duration: durationSec,
              ignition: streak.some((pt) => pt.ignition),
              type: streak.some((pt) => pt.ignition) ? "idle" : "stop",
            });
          }
        }
        streak = [];
      }
    });
    if (streak.length > 2) {
      const s = streak[0];
      const e = streak[streak.length - 1];
      const durationSec = (new Date(e.timestamp).getTime() - new Date(s.timestamp).getTime()) / 1000;
      if (durationSec >= STOP_MIN_DURATION_SEC) {
        result.push({
          lat: streak[Math.floor(streak.length / 2)].lat,
          lng: streak[Math.floor(streak.length / 2)].lng,
          start: s.timestamp,
          end: e.timestamp,
          duration: durationSec,
          ignition: streak.some((pt) => pt.ignition),
          type: streak.some((pt) => pt.ignition) ? "idle" : "stop",
        });
      }
    }
    return result;
  }, [path]);

  /* ── Alert markers (overspeed / harsh-brake / emergency from alertType field only) ── */
  const alertMarkers = useMemo(() => {
    const ALERT_RE = /over.?speed|harsh.?brake|emergency/i;
    return path.filter((p) => p.alertType && ALERT_RE.test(p.alertType));
  }, [path]);

  const visibleStops = useMemo(() => {
    if (stopFilter === "hide") return [];
    if (stopFilter === "normal") return stops.filter((s) => s.type === "stop");
    if (stopFilter === "idle") return stops.filter((s) => s.type === "idle");
    return stops;
  }, [stops, stopFilter]);

  const vehicleMarkerIcon = useMemo(() => {
    if (!renderPoint) return undefined;
    const snappedHeading = Math.round((renderPoint.heading || 0) / 4) * 4;
    return carIcon(snappedHeading);
  }, [renderPoint]);

  if (!path.length) {
    return (
      <div className="h-[500px] rounded-2xl border border-white/10 bg-slate-900/60 text-slate-400 flex items-center justify-center">
        No route data
      </div>
    );
  }

  return (
    <div className="h-[500px] rounded-2xl border border-white/10 bg-slate-900/70 shadow-lg shadow-black/25 overflow-hidden relative">
      <MapContainer
        center={[path[0].lat, path[0].lng]}
        zoom={14}
        className="h-full w-full"
        attributionControl={false}
        ref={setMap}
      >
        <StaticRouteLayers
          path={path}
          routePositions={routePositions}
          mapTheme={mapTheme}
          start={start}
          end={end}
          visibleStops={visibleStops}
          alertMarkers={alertMarkers}
          baseZoom={baseZoom}
        />

        {/* ── Animated vehicle marker ── */}
        {renderPoint && vehicleMarkerIcon && (
          <Marker position={[renderPoint.lat, renderPoint.lng]} icon={vehicleMarkerIcon} />
        )}
      </MapContainer>

      {/* ── Right rail controls ── */}
      <div className="pointer-events-none absolute right-3 top-3 z-[5000] flex flex-col gap-2">
        <button
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/85 text-white shadow-lg border border-white/10"
          title="Toggle map layer"
          onClick={() => setMapTheme((m) => (m === "satellite" ? "street" : "satellite"))}
        >
          <MapIcon size={18} />
        </button>
        <button
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/85 text-white shadow-lg border border-white/10"
          title="Fit route"
          onClick={() => {
            if (map && path.length) {
              map.fitBounds(latLngBounds(path.map((p) => [p.lat, p.lng])), { padding: [40, 40] });
            }
          }}
        >
          <Crosshair size={18} />
        </button>
        <div className="pointer-events-auto relative">
          <button
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full font-bold shadow-lg border ${stopFilter === "hide"
              ? "bg-slate-900/85 text-white border-white/10"
              : "bg-emerald-500 text-emerald-950 border-emerald-300/60"
              }`}
            title="Stop / Idle markers"
            onClick={() => setIsStopMenuOpen((o) => !o)}
          >
            S
          </button>
          {isStopMenuOpen && (
            <div className="absolute right-0 mt-2 w-36 rounded-lg border border-white/10 bg-slate-900/95 text-white shadow-xl z-[6000]">
              {(["all", "normal", "idle", "hide"] as const).map((key) => (
                <button
                  key={key}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-800 ${stopFilter === key ? "text-emerald-400" : "text-white"
                    }`}
                  onClick={() => {
                    setStopFilter(key);
                    setIsStopMenuOpen(false);
                  }}
                >
                  {key === "all" ? "All Stops" : key === "normal" ? "Normal Stops" : key === "idle" ? "Idle Stops" : "Hide Stops"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom play controls + live HUD ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[5000] flex justify-center">
        <div className="pointer-events-auto inline-flex items-center gap-4 rounded-full bg-slate-900/90 px-5 py-3 text-white shadow-2xl border border-white/10 backdrop-blur">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-emerald-200">
              {renderPoint ? `${renderPoint.speed.toFixed(1)} km/h` : "-- km/h"}
            </span>
            <span className="text-xs text-slate-300">
              {renderPoint ? new Date(renderPoint.timestamp).toLocaleTimeString() : "--"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-emerald-950 shadow-lg"
              onClick={() =>
                setIsPlaying((p) => {
                  if (!p && activePoint) centerOnActive({ forceZoom: true });
                  return !p;
                })
              }
              aria-label={isPlaying ? "Pause playback" : "Play playback"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-800 hover:bg-slate-700"
              onClick={() => {
                setPlayheadIdx(0);
                setIsPlaying(false);
                centerOnActive({ forceZoom: true, point: path[0] });
              }}
              aria-label="Restart"
            >
              <RotateCcw size={18} />
            </button>
            <div className="flex items-center gap-1 text-xs text-slate-200">
              <span className="uppercase tracking-wide text-[10px] text-slate-400">Speed</span>
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaySpeed(s)}
                  className={`px-2 py-1 rounded-full border text-xs ${playSpeed === s
                    ? "bg-emerald-500 text-emerald-950 border-emerald-400"
                    : "bg-slate-800 border-white/10 text-white"
                    }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
