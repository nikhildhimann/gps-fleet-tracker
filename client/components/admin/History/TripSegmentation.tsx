"use client";

import { useMemo } from "react";
import { Car, Clock, MapPin, Gauge, TrendingUp, Activity, Navigation, AlertTriangle, Zap } from "lucide-react";
import { RUNNING_SPEED_THRESHOLD } from "@/lib/vehicleStatusUtils";

export interface TripPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  heading: number;
  ignition: boolean;
  address?: string;
  mileage?: number;
}

export interface TripSegment {
  id: string;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  startCoords: { lat: number; lng: number };
  endCoords: { lat: number; lng: number };
  duration: number; // in seconds
  distance: number; // in kilometers
  maxSpeed: number; // km/h
  avgSpeed: number; // km/h
  idleTime: number; // in seconds
  stopTime: number; // in seconds
  points: TripPoint[];
  events: TripEvent[];
}

export interface TripEvent {
  type: 'harsh_brake' | 'harsh_accel' | 'overspeed' | 'stop' | 'idle';
  timestamp: string;
  position: { lat: number; lng: number };
  data: any;
}

export interface TripSegmentationProps {
  points: TripPoint[];
  onTripSelect?: (trip: TripSegment) => void;
  selectedTripId?: string;
  className?: string;
}

export default function TripSegmentation({
  points,
  onTripSelect,
  selectedTripId,
  className = ""
}: TripSegmentationProps) {
  const tripSegments = useMemo(() => {
    if (points.length < 2) return [];

    const segments: TripSegment[] = [];
    let currentTripPoints: TripPoint[] = [];
    let tripStartTime = '';
    let lastIgnitionState = points[0].ignition;
    let stopStartTime = '';
    let idleStartTime = '';

    const haversineDistance = (p1: TripPoint, p2: TripPoint): number => {
      const R = 6371; // Earth's radius in km
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLng = (p2.lng - p1.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const detectEvents = (tripPoints: TripPoint[]): TripEvent[] => {
      const events: TripEvent[] = [];
      
      for (let i = 1; i < tripPoints.length; i++) {
        const prev = tripPoints[i - 1];
        const curr = tripPoints[i];
        
        // Harsh braking
        if ((prev.speed || 0) - (curr.speed || 0) > 30) {
          events.push({
            type: 'harsh_brake',
            timestamp: curr.timestamp,
            position: { lat: curr.lat, lng: curr.lng },
            data: { speedBefore: prev.speed || 0, speedAfter: curr.speed || 0, deceleration: (prev.speed || 0) - (curr.speed || 0) }
          });
        }
        
        // Harsh acceleration
        if ((curr.speed || 0) - (prev.speed || 0) > 20) {
          events.push({
            type: 'harsh_accel',
            timestamp: curr.timestamp,
            position: { lat: curr.lat, lng: curr.lng },
            data: { speedBefore: prev.speed || 0, speedAfter: curr.speed || 0, acceleration: (curr.speed || 0) - (prev.speed || 0) }
          });
        }
        
        // Overspeed
        if ((curr.speed || 0) > 80) {
          events.push({
            type: 'overspeed',
            timestamp: curr.timestamp,
            position: { lat: curr.lat, lng: curr.lng },
            data: { speed: curr.speed || 0 }
          });
        }
      }
      
      return events;
    };

    const calculateTripStats = (tripPoints: TripPoint[]) => {
      if (tripPoints.length < 2) {
        return {
          distance: 0,
          maxSpeed: 0,
          avgSpeed: 0,
          idleTime: 0,
          stopTime: 0
        };
      }

      let distance = 0;
      let maxSpeed = 0;
      let totalSpeed = 0;
      let idleTime = 0;
      let stopTime = 0;

      for (let i = 1; i < tripPoints.length; i++) {
        const prev = tripPoints[i - 1];
        const curr = tripPoints[i];
        
        // Calculate distance
        distance += haversineDistance(prev, curr);
        
        // Speed stats
        maxSpeed = Math.max(maxSpeed, curr.speed || 0);
        totalSpeed += curr.speed || 0;
        
        // Time calculations
        const timeDiff = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
        
        if ((curr.speed || 0) === 0) {
          if (curr.ignition) {
            idleTime += timeDiff;
          } else {
            stopTime += timeDiff;
          }
        }
      }

      const avgSpeed = totalSpeed / tripPoints.length;
      const duration = (new Date(tripPoints[tripPoints.length - 1].timestamp).getTime() - 
                     new Date(tripPoints[0].timestamp).getTime()) / 1000;

      return {
        distance,
        maxSpeed,
        avgSpeed,
        idleTime,
        stopTime,
        duration
      };
    };

    // Process points to detect trips
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      // Trip start: ignition turns ON and vehicle starts moving
      if (!lastIgnitionState && point.ignition && (point.speed || 0) >= RUNNING_SPEED_THRESHOLD) {
        // Start new trip
        if (currentTripPoints.length > 0) {
          // End previous trip if it exists
          const stats = calculateTripStats(currentTripPoints);
          const events = detectEvents(currentTripPoints);
          
          segments.push({
            id: `trip-${segments.length + 1}`,
            startTime: currentTripPoints[0].timestamp,
            endTime: currentTripPoints[currentTripPoints.length - 1].timestamp,
            startLocation: currentTripPoints[0].address || 'Unknown',
            endLocation: currentTripPoints[currentTripPoints.length - 1].address || 'Unknown',
            startCoords: { lat: currentTripPoints[0].lat, lng: currentTripPoints[0].lng },
            endCoords: { lat: currentTripPoints[currentTripPoints.length - 1].lat, lng: currentTripPoints[currentTripPoints.length - 1].lng },
            duration: stats.duration || 0,
            distance: stats.distance || 0,
            maxSpeed: stats.maxSpeed || 0,
            avgSpeed: stats.avgSpeed || 0,
            idleTime: stats.idleTime || 0,
            stopTime: stats.stopTime || 0,
            points: currentTripPoints,
            events
          });
        }
        
        currentTripPoints = [point];
        tripStartTime = point.timestamp;
      }
      // Continue trip if ignition is ON
      else if (point.ignition && currentTripPoints.length > 0) {
        currentTripPoints.push(point);
      }
      // Trip end: ignition turns OFF after being ON for a while
      else if (lastIgnitionState && !point.ignition && currentTripPoints.length > 0) {
        currentTripPoints.push(point);
        
        const stats = calculateTripStats(currentTripPoints);
        const events = detectEvents(currentTripPoints);
        
        segments.push({
          id: `trip-${segments.length + 1}`,
          startTime: currentTripPoints[0].timestamp,
          endTime: currentTripPoints[currentTripPoints.length - 1].timestamp,
          startLocation: currentTripPoints[0].address || 'Unknown',
          endLocation: currentTripPoints[currentTripPoints.length - 1].address || 'Unknown',
          startCoords: { lat: currentTripPoints[0].lat, lng: currentTripPoints[0].lng },
          endCoords: { lat: currentTripPoints[currentTripPoints.length - 1].lat, lng: currentTripPoints[currentTripPoints.length - 1].lng },
          duration: stats.duration || 0,
          distance: stats.distance || 0,
          maxSpeed: stats.maxSpeed || 0,
          avgSpeed: stats.avgSpeed || 0,
          idleTime: stats.idleTime || 0,
          stopTime: stats.stopTime || 0,
          points: currentTripPoints,
          events
        });
        
        currentTripPoints = [];
        tripStartTime = '';
      }
      
      lastIgnitionState = point.ignition;
    }

    // Handle last trip if it didn't end properly
    if (currentTripPoints.length > 0) {
      const stats = calculateTripStats(currentTripPoints);
      const events = detectEvents(currentTripPoints);
      
      segments.push({
        id: `trip-${segments.length + 1}`,
        startTime: currentTripPoints[0].timestamp,
        endTime: currentTripPoints[currentTripPoints.length - 1].timestamp,
        startLocation: currentTripPoints[0].address || 'Unknown',
        endLocation: currentTripPoints[currentTripPoints.length - 1].address || 'Unknown',
        startCoords: { lat: currentTripPoints[0].lat, lng: currentTripPoints[0].lng },
        endCoords: { lat: currentTripPoints[currentTripPoints.length - 1].lat, lng: currentTripPoints[currentTripPoints.length - 1].lng },
        duration: stats.duration || 0,
        distance: stats.distance || 0,
        maxSpeed: stats.maxSpeed || 0,
        avgSpeed: stats.avgSpeed || 0,
        idleTime: stats.idleTime || 0,
        stopTime: stats.stopTime || 0,
        points: currentTripPoints,
        events
      });
    }

    return segments;
  }, [points]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getEventIcon = (type: TripEvent['type']) => {
    switch (type) {
      case 'harsh_brake':
        return <Activity size={12} className="text-red-500" />;
      case 'harsh_accel':
        return <TrendingUp size={12} className="text-orange-500" />;
      case 'overspeed':
        return <Gauge size={12} className="text-yellow-500" />;
      case 'stop':
        return <MapPin size={12} className="text-gray-500" />;
      case 'idle':
        return <Clock size={12} className="text-yellow-600" />;
      default:
        return <Navigation size={12} className="text-gray-400" />;
    }
  };

  const totalStats = useMemo(() => {
    return tripSegments.reduce((acc, trip) => ({
      totalDistance: acc.totalDistance + trip.distance,
      totalDuration: acc.totalDuration + trip.duration,
      totalTrips: acc.totalTrips + 1,
      totalIdleTime: acc.totalIdleTime + trip.idleTime,
      totalStopTime: acc.totalStopTime + trip.stopTime,
      avgSpeed: acc.avgSpeed + trip.avgSpeed,
      maxSpeed: Math.max(acc.maxSpeed, trip.maxSpeed || 0)
    }), {
      totalDistance: 0,
      totalDuration: 0,
      totalTrips: 0,
      totalIdleTime: 0,
      totalStopTime: 0,
      avgSpeed: 0,
      maxSpeed: 0
    });
  }, [tripSegments]);

  // Calculate overall average speed
  totalStats.avgSpeed = tripSegments.length > 0 ? totalStats.avgSpeed / tripSegments.length : 0;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Trip Analysis</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Car size={16} />
            <span>{tripSegments.length} trips</span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Navigation size={14} className="text-blue-600" />
              <span className="text-xs font-medium text-blue-800">Total Distance</span>
            </div>
            <div className="text-lg font-bold text-blue-900">
              {totalStats.totalDistance.toFixed(1)} km
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-green-600" />
              <span className="text-xs font-medium text-green-800">Total Time</span>
            </div>
            <div className="text-lg font-bold text-green-900">
              {formatDuration(totalStats.totalDuration)}
            </div>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Gauge size={14} className="text-orange-600" />
              <span className="text-xs font-medium text-orange-800">Max Speed</span>
            </div>
            <div className="text-lg font-bold text-orange-900">
              {totalStats.maxSpeed.toFixed(0)} km/h
            </div>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-purple-600" />
              <span className="text-xs font-medium text-purple-800">Avg Speed</span>
            </div>
            <div className="text-lg font-bold text-purple-900">
              {totalStats.avgSpeed.toFixed(1)} km/h
            </div>
          </div>
        </div>
      </div>

      {/* Trips List */}
      <div className="max-h-96 overflow-y-auto">
        {tripSegments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Car size={48} className="mx-auto mb-4 opacity-50" />
            <p>No trips detected</p>
            <p className="text-sm mt-2">Trips are detected when ignition turns ON and vehicle starts moving</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {tripSegments.map((trip, index) => {
              const isSelected = selectedTripId === trip.id;
              
              return (
                <div
                  key={trip.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-blue-500 border-blue-200' : 'border-gray-200'
                  }`}
                  onClick={() => onTripSelect?.(trip)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        Trip {index + 1}
                      </h4>
                      <div className="text-sm text-gray-600">
                        {formatDate(trip.startTime)} • {formatTime(trip.startTime)} - {formatTime(trip.endTime)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        {trip.distance.toFixed(1)} km
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDuration(trip.duration)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">From</div>
                        <div className="truncate font-medium">{trip.startLocation}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">To</div>
                        <div className="truncate font-medium">{trip.endLocation}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Gauge size={14} className="text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Speed</div>
                        <div className="font-medium">{trip.avgSpeed.toFixed(0)} / {trip.maxSpeed.toFixed(0)} km/h</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Idle/Stop</div>
                        <div className="font-medium">{formatDuration(trip.idleTime)} / {formatDuration(trip.stopTime)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Events */}
                  {trip.events.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity size={14} className="text-gray-400" />
                        <span className="text-xs font-medium text-gray-700">Events ({trip.events.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {trip.events.slice(0, 5).map((event, eventIndex) => (
                          <div key={eventIndex} className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                            {getEventIcon(event.type)}
                            <span className="text-xs text-gray-600">
                              {event.type.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                        {trip.events.length > 5 && (
                          <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                            +{trip.events.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                    <button
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTripSelect?.(trip);
                      }}
                    >
                      Replay Trip
                    </button>
                    <button
                      className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Add to comparison logic here
                      }}
                    >
                      Compare
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
