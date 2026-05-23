"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import { DivIcon, latLngBounds, Map as LeafletMap } from "leaflet";
import { Play, Pause, RotateCcw, Map as MapIcon, Crosshair, Gauge, Clock3 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import MapTileLayer from "./MapTileLayer";

type Point = {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  ignition: boolean;
  alertType?: string;
  heading?: number;
};

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
const carIcon = (heading: number) =>
  new DivIcon({
    html: `<div style="width:30px;height:18px;border-radius:6px;background:#0ea5e9;border:2px solid #0b2540;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;transform:rotate(${heading}deg);box-shadow:0 4px 10px rgba(0,0,0,0.35);">🚗</div>`,
    iconSize: [30, 18],
    iconAnchor: [15, 9],
  });
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

const startIcon = new DivIcon({
  html: `<div style="width:16px;height:16px;background:#22c55e;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 0 2px rgba(15,23,42,.18)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
const endIcon = new DivIcon({
  html: `<div style="width:16px;height:16px;background:#ef4444;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 0 2px rgba(15,23,42,.18)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
const makeStopIcon = (color: string) =>
  new DivIcon({
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #0f172a;border-radius:4px;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

function FitBounds({ pts }: { pts: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (!pts.length) return;
    map.fitBounds(latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [50, 50] });
  }, [map, pts]);
  return null;
}

export type StopFilter = "all" | "normal" | "idle" | "hide";

export type RouteEvent =
  | { type: "turn"; subtype: "slight-left" | "sharp-left" | "slight-right" | "sharp-right"; lat: number; lng: number; timestamp: string; speed: number; ignition: boolean; heading: number }
  | { type: "stop"; lat: number; lng: number; start: string; end: string; ignition: boolean; durationSec: number }
  | { type: "idle"; lat: number; lng: number; start: string; end: string; durationSec: number }
  | { type: "harsh-brake"; lat: number; lng: number; timestamp: string; speed: number; ignition: boolean; heading: number };

export default function HistoryPlaybackMap({
  points,
  playheadIndex,
  stopFilter = "all",
  events = [],
  satellite = true,
  showControls = false,
  isPlaying = false,
  speed = 1,
  onTogglePlay,
  onSpeedChange,
  onReplay,
  onStopFilterChange,
}: {
  points: Point[];
  playheadIndex: number;
  stopFilter?: StopFilter;
  events?: RouteEvent[];
  satellite?: boolean;
  showControls?: boolean;
  isPlaying?: boolean;
  speed?: number;
  onTogglePlay?: () => void;
  onSpeedChange?: (s: number) => void;
  onReplay?: () => void;
  onStopFilterChange?: (f: StopFilter) => void;
}) {
  const path = useMemo(() => {
    const filtered = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    return filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [points]);
  const playPoint = path[Math.min(playheadIndex, path.length - 1)];
  const [mapTheme, setMapTheme] = useState<"satellite" | "street">(satellite ? "satellite" : "street");
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [renderPoint, setRenderPoint] = useState<Point | null>(playPoint || null);
  const [isStopMenuOpen, setIsStopMenuOpen] = useState(false);
  const baseZoom = useMemo(() => computeSmartZoom(path), [path]);
  const pauseRef = useRef<number>(0);

  useEffect(() => setMapTheme(satellite ? "satellite" : "street"), [satellite]);

  useEffect(() => setRenderPoint(playPoint || null), [playPoint]);

  useEffect(() => {
    if (!map || !path.length) return;
    map.setView([path[0].lat, path[0].lng], baseZoom);
    map.fitBounds(latLngBounds(path.map((p) => [p.lat, p.lng])), { padding: [60, 60], maxZoom: baseZoom });
  }, [map, path, baseZoom]);

  useEffect(() => {
    if (!isPlaying || path.length < 2) return;
    const current = path[playheadIndex];
    const next = path[Math.min(playheadIndex + 1, path.length - 1)];
    let start: number | null = null;
    let raf: number;
    const duration = 900 / speed;

    const animate = (ts: number) => {
      if (ts < pauseRef.current) {
        raf = requestAnimationFrame(animate);
        return;
      }
      if (start == null) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const heading = lerpHeading(current.heading ?? 0, next.heading ?? current.heading ?? 0, t);
      setRenderPoint({
        ...current,
        lat: lerp(current.lat, next.lat, t),
        lng: lerp(current.lng, next.lng, t),
        speed: lerp(current.speed, next.speed, t),
        heading,
      });
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, playheadIndex, speed, path]);

  useEffect(() => {
    if (!map || !renderPoint || !isPlaying) return;
    const distance = map.getCenter().distanceTo([renderPoint.lat, renderPoint.lng]);
    if (distance > 60) map.panTo([renderPoint.lat, renderPoint.lng], { animate: true });
  }, [renderPoint, isPlaying, map]);

  useEffect(() => {
    if (isPlaying && map && renderPoint) {
      map.flyTo([renderPoint.lat, renderPoint.lng], Math.max(baseZoom, map.getZoom()), { duration: 0.35 });
    }
  }, [isPlaying, map, renderPoint, baseZoom]);

  useEffect(() => {
    if (isPlaying && playPoint && playPoint.speed === 0) {
      pauseRef.current = performance.now() + 900;
    }
  }, [playPoint, isPlaying]);

  const stops = useMemo(() => {
    const result: { lat: number; lng: number; ignition: boolean; start: string; end: string; type: "idle" | "stop" }[] = [];
    let streak: Point[] = [];
    path.forEach((p) => {
      if (p.speed === 0) streak.push(p);
      else {
        if (streak.length > 2) {
          result.push({
            lat: streak[Math.floor(streak.length / 2)].lat,
            lng: streak[Math.floor(streak.length / 2)].lng,
            ignition: streak.some((s) => s.ignition),
            start: streak[0].timestamp,
            end: streak[streak.length - 1].timestamp,
            type: streak.some((s) => s.ignition) ? "idle" : "stop",
          });
        }
        streak = [];
      }
    });
    if (streak.length > 2) {
      result.push({
        lat: streak[Math.floor(streak.length / 2)].lat,
        lng: streak[Math.floor(streak.length / 2)].lng,
        ignition: streak.some((s) => s.ignition),
        start: streak[0].timestamp,
        end: streak[streak.length - 1].timestamp,
        type: streak.some((s) => s.ignition) ? "idle" : "stop",
      });
    }
    return result;
  }, [path]);

  const visibleStops = useMemo(() => {
    if (stopFilter === "hide") return [];
    if (stopFilter === "normal") return stops.filter((s) => s.type === "stop");
    if (stopFilter === "idle") return stops.filter((s) => s.type === "idle");
    return stops;
  }, [stops, stopFilter]);

  if (!path.length) {
    return <div className="h-full w-full rounded-2xl border border-white/10 bg-slate-900/60 text-slate-400 flex items-center justify-center">No route</div>;
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[path[0].lat, path[0].lng]}
        zoom={13}
        className="h-full w-full"
        attributionControl={false}
        ref={setMap}
      >
        <MapTileLayer satellite={mapTheme === "satellite"} />
        <FitBounds pts={path} />
        {/* Base route */}
        <Polyline positions={path.map((p) => [p.lat, p.lng])} color="#94a3b8" weight={4} opacity={0.25} />
        {/* Progressive route up to playhead */}
        <Polyline positions={path.slice(0, playheadIndex + 1).map((p) => [p.lat, p.lng])} color="#0ea5e9" weight={5} opacity={0.9} />
        <Marker position={[path[0].lat, path[0].lng]} icon={startIcon} />
        <Marker position={[path[path.length - 1].lat, path[path.length - 1].lng]} icon={endIcon} />
        {renderPoint && (
          <Marker
            position={[renderPoint.lat, renderPoint.lng]}
            icon={carIcon(renderPoint.heading || 0)}
          >
            <Popup className="text-xs space-y-1">
              <div>{new Date(renderPoint.timestamp).toLocaleString()}</div>
              <div>Speed: {renderPoint.speed.toFixed(1)} km/h</div>
              <div>Ignition: {renderPoint.ignition ? "ON" : "OFF"}</div>
              <div>Heading: {renderPoint.heading?.toFixed?.(0) ?? "--"}°</div>
            </Popup>
          </Marker>
        )}

        {visibleStops.map((s, idx) => (
          <Marker
            key={`stop-${idx}`}
            position={[s.lat, s.lng]}
            icon={makeStopIcon(s.type === "idle" ? "#fbbf24" : "#ef4444")}
            eventHandlers={{
              click: (e) => {
                map?.flyTo([s.lat, s.lng], Math.max(baseZoom, 16), { duration: 0.4 });
                (e.target as any)?.openPopup?.();
              },
            }}
          >
            <Popup className="text-xs space-y-1">
              <div className="font-semibold">{s.type === "idle" ? "Idle Stop" : "Stop"}</div>
              <div>From: {new Date(s.start).toLocaleTimeString()}</div>
              <div>To: {new Date(s.end).toLocaleTimeString()}</div>
              <div>Duration: {Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / 1000)}s</div>
              <div>Ignition: {s.ignition ? "ON" : "OFF"}</div>
            </Popup>
          </Marker>
        ))}

        {events.map((ev, idx) => {
          if (ev.type === "turn") {
            const side = ev.subtype || "";
            const color = side.includes("left") ? "#f97316" : "#22c55e";
            return (
              <Marker key={`turn-${idx}`} position={[ev.lat, ev.lng]} icon={makeStopIcon(color)}>
                <Popup className="text-xs space-y-1">
                  <div>{(ev.subtype || "turn").replace("-", " ")}</div>
                  <div>{new Date(ev.timestamp).toLocaleTimeString()}</div>
                  <div>Speed: {ev.speed.toFixed(1)} km/h</div>
                  <div>Ignition: {ev.ignition ? "ON" : "OFF"}</div>
                  <div>Heading: {ev.heading.toFixed(0)}°</div>
                </Popup>
              </Marker>
            );
          }
          if (ev.type === "harsh-brake") {
            return (
              <Marker key={`hb-${idx}`} position={[ev.lat, ev.lng]} icon={makeStopIcon("#ef4444")}>
                <Popup className="text-xs space-y-1">
                  <div>Harsh Brake</div>
                  <div>{ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ""}</div>
                  <div>Speed: {ev.speed.toFixed(1)} km/h</div>
                  <div>Heading: {ev.heading?.toFixed?.(0) ?? "--"}°</div>
                  <div>Ignition: {ev.ignition ? "ON" : "OFF"}</div>
                </Popup>
              </Marker>
            );
          }
          if (ev.type === "stop" || ev.type === "idle") {
            const color = ev.type === "idle" ? "#fbbf24" : "#ef4444";
            return (
              <Marker key={`stop-${idx}`} position={[ev.lat, ev.lng]} icon={makeStopIcon(color)}>
                <Popup className="text-xs space-y-1">
                  <div>{ev.type === "idle" ? "Idle" : "Stop"}</div>
                  <div>Start: {new Date(ev.start).toLocaleTimeString()}</div>
                  <div>End: {new Date(ev.end).toLocaleTimeString()}</div>
                  <div>Duration: {Math.round(ev.durationSec)}s</div>
                </Popup>
              </Marker>
            );
          }
          return null;
        })}
      </MapContainer>

      {showControls && (
        <>
          {/* Speed + time chip */}
          <div className="pointer-events-none absolute left-3 bottom-3 z-[5000]">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-slate-900 shadow-lg border border-slate-200">
              <div className="flex items-center gap-1"><Gauge size={14} /> {renderPoint ? renderPoint.speed.toFixed(1) : "--"} km/h</div>
              <span className="h-3 w-px bg-slate-300" />
              <div className="flex items-center gap-1 text-slate-600"><Clock3 size={14} /> {renderPoint ? new Date(renderPoint.timestamp).toLocaleTimeString() : "--"}</div>
            </div>
          </div>

          {/* Right rail */}
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
              title="Re-center route"
              onClick={() => map && path.length && map.fitBounds(latLngBounds(path.map((p) => [p.lat, p.lng])), { padding: [50, 50] })}
            >
              <Crosshair size={18} />
            </button>
            <div className="pointer-events-auto relative">
              <button
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full font-bold shadow-lg border ${stopFilter === "hide" ? "bg-slate-900/85 text-white border-white/10" : "bg-emerald-500 text-emerald-950 border-emerald-300/60"}`}
                title="Stop / Idle markers"
                onClick={() => setIsStopMenuOpen((o) => !o)}
              >
                S
              </button>
              {isStopMenuOpen && (
                <div className="absolute right-0 mt-2 w-36 rounded-lg border border-white/10 bg-slate-900/95 text-white shadow-xl z-[6000]">
                  {(
                    [
                      { key: "all", label: "All Stops" },
                      { key: "normal", label: "Normal Stops" },
                      { key: "idle", label: "Idle Stops" },
                      { key: "hide", label: "Hide Stops" },
                    ] as { key: StopFilter; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-800 ${stopFilter === opt.key ? "text-emerald-400" : "text-white"}`}
                      onClick={() => {
                        onStopFilterChange?.(opt.key);
                        setIsStopMenuOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Play controls */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[5000] flex justify-center">
            <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-slate-900/90 px-4 py-2 text-white shadow-2xl border border-white/10 backdrop-blur">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-emerald-950 shadow-lg"
                onClick={onTogglePlay}
                aria-label={isPlaying ? "Pause playback" : "Play playback"}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-800 hover:bg-slate-700"
                onClick={onReplay}
                aria-label="Restart playback"
              >
                <RotateCcw size={18} />
              </button>
              <div className="flex items-center gap-1 text-xs text-slate-200">
                <span className="uppercase tracking-wide text-[10px] text-slate-400">Speed</span>
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => onSpeedChange?.(s)}
                    className={`px-2 py-1 rounded-full border text-xs ${speed === s ? "bg-emerald-500 text-emerald-950 border-emerald-400" : "bg-slate-800 border-white/10 text-white"}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
