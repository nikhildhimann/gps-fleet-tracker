"use client";

import { useState, useEffect, useMemo } from "react";
import { MapContainer, Polyline, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { DivIcon, latLngBounds, Map as LeafletMap } from "leaflet";
import { Layers, MapPin, Navigation, Gauge, Activity, AlertTriangle, Car, Battery, Wifi } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

export type RouteVisualizationMode = 'full' | 'speed' | 'direction' | 'stops';
export type MapLayer = 'satellite' | 'street' | 'terrain' | 'dark';

export interface MapPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  heading: number;
  ignition: boolean;
  address?: string;
  alertType?: string;
  voltage?: number;
  gsm?: number;
}

export interface MapStop {
  lat: number;
  lng: number;
  start: string;
  end: string;
  duration: number;
  type: 'stop' | 'idle';
  address?: string;
}

interface AdvancedMapVisualizationProps {
  points: MapPoint[];
  stops: MapStop[];
  visualizationMode: RouteVisualizationMode;
  mapLayer: MapLayer;
  showStartEnd: boolean;
  showStops: boolean;
  showDirectionArrows: boolean;
  followVehicle: boolean;
  currentPosition?: { lat: number; lng: number };
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (point: MapPoint) => void;
  onStopClick?: (stop: MapStop) => void;
  className?: string;
}

// Custom tile layers
const TILE_LAYERS = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  dark: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'
};

function MapController({ 
  points, 
  followVehicle, 
  currentPosition, 
  showStartEnd 
}: { 
  points: MapPoint[]; 
  followVehicle: boolean; 
  currentPosition?: { lat: number; lng: number }; 
  showStartEnd: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    if (followVehicle && currentPosition) {
      map.panTo([currentPosition.lat, currentPosition.lng]);
    } else if (showStartEnd) {
      const bounds = latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [followVehicle, currentPosition, points, showStartEnd, map]);

  return null;
}

// Custom hook to replace MapController
function useMapController({
  points, 
  followVehicle, 
  currentPosition, 
  showStartEnd,
  map
}: {
  points: MapPoint[]; 
  followVehicle: boolean; 
  currentPosition?: { lat: number; lng: number }; 
  showStartEnd: boolean;
  map: LeafletMap | null;
}) {
  useEffect(() => {
    if (!map || !points.length) return;

    if (followVehicle && currentPosition) {
      map.panTo([currentPosition.lat, currentPosition.lng]);
    } else if (showStartEnd) {
      const bounds = latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [followVehicle, currentPosition, points, showStartEnd, map]);
}

export default function AdvancedMapVisualization({
  points,
  stops,
  visualizationMode,
  mapLayer,
  showStartEnd,
  showStops,
  showDirectionArrows,
  followVehicle,
  currentPosition,
  onMapClick,
  onMarkerClick,
  onStopClick,
  className = ""
}: AdvancedMapVisualizationProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);

  // Use custom hook for map control
  useMapController({
    points,
    followVehicle,
    currentPosition,
    showStartEnd,
    map
  });

  // Speed-based coloring
  const getSpeedColor = (speed: number): string => {
    if (speed === 0) return '#6b7280'; // Gray for stopped
    if (speed < 20) return '#22c55e'; // Green for slow
    if (speed < 40) return '#eab308'; // Yellow for medium
    if (speed < 60) return '#f97316'; // Orange for fast
    return '#ef4444'; // Red for very fast
  };

  // Create speed-colored polylines
  const speedPolylines = useMemo(() => {
    if (visualizationMode !== 'speed' || points.length < 2) return [];

    const polylines: { positions: [number, number][]; color: string; weight: number }[] = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const avgSpeed = (start.speed + end.speed) / 2;
      
      polylines.push({
        positions: [[start.lat, start.lng], [end.lat, end.lng]],
        color: getSpeedColor(avgSpeed),
        weight: avgSpeed > 60 ? 6 : avgSpeed > 40 ? 5 : avgSpeed > 20 ? 4 : 3
      });
    }
    
    return polylines;
  }, [points, visualizationMode]);

  // Create direction arrows
  const directionArrows = useMemo(() => {
    if (!showDirectionArrows || points.length < 2) return [];

    const arrows = [];
    const step = Math.max(1, Math.floor(points.length / 20)); // Show ~20 arrows max
    
    for (let i = 0; i < points.length; i += step) {
      const point = points[i];
      if (point.speed > 5) { // Only show arrows for moving points
        arrows.push({
          position: [point.lat, point.lng] as [number, number],
          heading: point.heading,
          speed: point.speed
        });
      }
    }
    
    return arrows;
  }, [points, showDirectionArrows]);

  // Create custom icons
  const startIcon = new DivIcon({
    html: `<div style="width:20px;height:20px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">S</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    className: ''
  });

  const endIcon = new DivIcon({
    html: `<div style="width:20px;height:20px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">E</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    className: ''
  });

  const stopIcon = (type: 'stop' | 'idle') => new DivIcon({
    html: `<div style="width:16px;height:16px;background:${type === 'stop' ? '#ef4444' : '#f59e0b'};border:2px solid #fff;border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    className: ''
  });

  const directionIcon = (heading: number, speed: number) => new DivIcon({
    html: `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);color:${getSpeedColor(speed)};font-size:16px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));">➤</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: ''
  });

  const currentVehicleIcon = new DivIcon({
    html: `<div style="width:32px;height:32px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:16px;animation:pulse 2s infinite;">🚗</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: ''
  });

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={[points[0]?.lat || 0, points[0]?.lng || 0]}
        zoom={14}
        className="h-full w-full"
        ref={setMap as any}
      >
        <TileLayer
          url={TILE_LAYERS[mapLayer]}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Route visualization */}
        {visualizationMode === 'full' && points.length > 1 && (
          <Polyline
            positions={points.map(p => [p.lat, p.lng])}
            color="#3b82f6"
            weight={4}
            opacity={0.8}
          />
        )}

        {/* Speed-colored polylines */}
        {visualizationMode === 'speed' && speedPolylines.map((line, index) => (
          <Polyline
            key={index}
            positions={line.positions}
            color={line.color}
            weight={line.weight}
            opacity={0.8}
          />
        ))}

        {/* Start and End markers */}
        {showStartEnd && points.length > 0 && (
          <>
            <Marker
              position={[points[0].lat, points[0].lng]}
              icon={startIcon}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">Start Point</div>
                  <div>{points[0].address || 'Unknown location'}</div>
                  <div>{new Date(points[0].timestamp).toLocaleString()}</div>
                  <div>Speed: {points[0].speed.toFixed(1)} km/h</div>
                </div>
              </Popup>
            </Marker>
            
            <Marker
              position={[points[points.length - 1].lat, points[points.length - 1].lng]}
              icon={endIcon}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">End Point</div>
                  <div>{points[points.length - 1].address || 'Unknown location'}</div>
                  <div>{new Date(points[points.length - 1].timestamp).toLocaleString()}</div>
                  <div>Speed: {points[points.length - 1].speed.toFixed(1)} km/h</div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Stop markers */}
        {showStops && stops.map((stop, index) => (
          <Marker
            key={index}
            position={[stop.lat, stop.lng]}
            icon={stopIcon(stop.type)}
            eventHandlers={{
              click: () => onStopClick?.(stop)
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{stop.type === 'stop' ? 'Stop' : 'Idle'}</div>
                <div>{stop.address || 'Unknown location'}</div>
                <div>Duration: {Math.floor(stop.duration / 60)}m {stop.duration % 60}s</div>
                <div>From: {new Date(stop.start).toLocaleTimeString()}</div>
                <div>To: {new Date(stop.end).toLocaleTimeString()}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Direction arrows */}
        {directionArrows.map((arrow, index) => (
          <Marker
            key={index}
            position={arrow.position}
            icon={directionIcon(arrow.heading, arrow.speed)}
          />
        ))}

        {/* Current vehicle position */}
        {currentPosition && (
          <Marker
            position={[currentPosition.lat, currentPosition.lng]}
            icon={currentVehicleIcon}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">Current Position</div>
                <div>Speed: {points.find(p => p.lat === currentPosition.lat && p.lng === currentPosition.lng)?.speed.toFixed(1) || 0} km/h</div>
                <div>Time: {new Date().toLocaleTimeString()}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Speed legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
          <div className="text-xs font-semibold text-gray-900 mb-2">Speed Legend</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-gray-500 rounded"></div>
              <span className="text-xs text-gray-700">0 km/h</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-green-500 rounded"></div>
              <span className="text-xs text-gray-700">&lt;20 km/h</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-yellow-500 rounded"></div>
              <span className="text-xs text-gray-700">20-40 km/h</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-orange-500 rounded"></div>
              <span className="text-xs text-gray-700">40-60 km/h</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-red-500 rounded"></div>
              <span className="text-xs text-gray-700">&gt;60 km/h</span>
            </div>
          </div>
        </div>
      </MapContainer>

      {/* Map controls overlay */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-gray-200">
        <div className="text-xs font-semibold text-gray-900 mb-2">Map Layers</div>
        <div className="space-y-1">
          {Object.keys(TILE_LAYERS).map((layer) => (
            <button
              key={layer}
              className={`w-full px-2 py-1 text-xs rounded transition-colors ${
                mapLayer === layer
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => {/* This will be handled by parent */}}
            >
              {layer.charAt(0).toUpperCase() + layer.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
