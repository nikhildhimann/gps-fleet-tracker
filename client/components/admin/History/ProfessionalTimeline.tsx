"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Clock, Calendar, Zap, Gauge, MapPin, Activity, AlertTriangle } from "lucide-react";

export type PlaybackSpeed = 0.5 | 1 | 2 | 5 | 10 | 25 | 50;

export interface TimelinePoint {
  index: number;
  timestamp: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  ignition: boolean;
  address?: string;
  alertType?: string;
}

export interface TimelineEvent {
  id: string;
  type: 'ignition' | 'overspeed' | 'harsh_brake' | 'harsh_accel' | 'stop' | 'idle' | 'geofence' | 'emergency';
  timestamp: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  position: { lat: number; lng: number };
  data?: any;
}

interface ProfessionalTimelineProps {
  points: TimelinePoint[];
  events: TimelineEvent[];
  currentTime: string;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  onTimeChange: (timestamp: string, index: number) => void;
  onPlayPause: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onJumpToEvent: (eventId: string) => void;
  className?: string;
}

export default function ProfessionalTimeline({
  points,
  events,
  currentTime,
  isPlaying,
  playbackSpeed,
  onTimeChange,
  onPlayPause,
  onSpeedChange,
  onJumpToEvent,
  className = ""
}: ProfessionalTimelineProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<TimelinePoint | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const startTime = useMemo(() => points[0]?.timestamp || "", [points]);
  const endTime = useMemo(() => points[points.length - 1]?.timestamp || "", [points]);
  const totalDuration = useMemo(() => {
    if (!startTime || !endTime) return 0;
    return new Date(endTime).getTime() - new Date(startTime).getTime();
  }, [startTime, endTime]);

  const currentIndex = useMemo(() => {
    return points.findIndex(p => p.timestamp === currentTime) || 0;
  }, [points, currentTime]);

  const progress = useMemo(() => {
    if (totalDuration === 0) return 0;
    const currentProgress = new Date(currentTime).getTime() - new Date(startTime).getTime();
    return Math.max(0, Math.min(100, (currentProgress / totalDuration) * 100));
  }, [currentTime, startTime, totalDuration]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || points.length === 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    
    const targetTime = new Date(startTime).getTime() + (totalDuration * percentage);
    const targetTimestamp = new Date(targetTime).toISOString();
    
    // Find closest point
    let closestIndex = 0;
    let minDiff = Math.abs(new Date(points[0].timestamp).getTime() - targetTime);
    
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(new Date(points[i].timestamp).getTime() - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    
    onTimeChange(points[closestIndex].timestamp, closestIndex);
  }, [points, startTime, totalDuration, onTimeChange]);

  const handleEventClick = useCallback((event: TimelineEvent) => {
    setSelectedEvent(event);
    onJumpToEvent(event.id);
  }, [onJumpToEvent]);

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'ignition': return <Zap size={12} />;
      case 'overspeed': return <Gauge size={12} />;
      case 'harsh_brake': return <AlertTriangle size={12} />;
      case 'harsh_accel': return <Activity size={12} />;
      case 'stop': return <MapPin size={12} />;
      case 'idle': return <Clock size={12} />;
      case 'geofence': return <MapPin size={12} />;
      case 'emergency': return <AlertTriangle size={12} />;
      default: return <Activity size={12} />;
    }
  };

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'ignition': return 'bg-blue-500';
      case 'overspeed': return 'bg-red-500';
      case 'harsh_brake': return 'bg-orange-500';
      case 'harsh_accel': return 'bg-yellow-500';
      case 'stop': return 'bg-gray-500';
      case 'idle': return 'bg-yellow-600';
      case 'geofence': return 'bg-purple-500';
      case 'emergency': return 'bg-red-600';
      default: return 'bg-gray-400';
    }
  };

  const speeds: PlaybackSpeed[] = [0.5, 1, 2, 5, 10, 25, 50];

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg p-4 ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onPlayPause}
            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          
          <button
            onClick={() => onTimeChange(startTime, 0)}
            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center transition-colors"
          >
            <SkipBack size={14} />
          </button>
          
          <button
            onClick={() => onTimeChange(endTime, points.length - 1)}
            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center transition-colors"
          >
            <SkipForward size={14} />
          </button>
          
          <button
            onClick={() => onTimeChange(startTime, 0)}
            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Speed:</span>
          <div className="flex gap-1">
            {speeds.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{formatTimestamp(startTime)}</span>
          <span className="text-sm font-medium text-gray-900">
            {formatTimestamp(currentTime)} ({currentIndex + 1}/{points.length})
          </span>
          <span className="text-xs text-gray-500">{formatTimestamp(endTime)}</span>
        </div>
        
        <div className="relative">
          {/* Main timeline bar */}
          <div
            ref={timelineRef}
            className="h-2 bg-gray-200 rounded-full cursor-pointer relative"
            onClick={handleTimelineClick}
          >
            {/* Progress bar */}
            <div
              className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
            
            {/* Current position indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-lg cursor-grab active:cursor-grabbing"
              style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>

          {/* Event markers */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {events.map((event) => {
              const eventProgress = ((new Date(event.timestamp).getTime() - new Date(startTime).getTime()) / totalDuration) * 100;
              return (
                <div
                  key={event.id}
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white cursor-pointer pointer-events-auto hover:scale-125 transition-transform"
                  style={{ 
                    left: `${eventProgress}%`,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: event.severity === 'critical' ? '#dc2626' : 
                                   event.severity === 'high' ? '#ea580c' : 
                                   event.severity === 'medium' ? '#f59e0b' : '#6b7280'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEventClick(event);
                  }}
                  title={event.title}
                />
              );
            })}
          </div>
        </div>

        {/* Duration info */}
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-500">Duration: {formatDuration(totalDuration)}</span>
          <span className="text-xs text-gray-500">
            Elapsed: {formatDuration(new Date(currentTime).getTime() - new Date(startTime).getTime())}
          </span>
        </div>
      </div>

      {/* Current point info */}
      {hoveredPoint && (
        <div className="absolute bottom-full left-0 mb-2 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg z-10">
          <div>Speed: {hoveredPoint.speed.toFixed(1)} km/h</div>
          <div>Heading: {hoveredPoint.heading.toFixed(0)}°</div>
          <div>Ignition: {hoveredPoint.ignition ? 'ON' : 'OFF'}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}

      {/* Selected event details */}
      {selectedEvent && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-full ${getEventColor(selectedEvent.type)} flex items-center justify-center text-white`}>
                  {getEventIcon(selectedEvent.type)}
                </div>
                <span className="font-medium text-gray-900">{selectedEvent.title}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  selectedEvent.severity === 'critical' ? 'bg-red-100 text-red-800' :
                  selectedEvent.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                  selectedEvent.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedEvent.severity}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-1">{selectedEvent.description}</p>
              <p className="text-xs text-gray-500">{formatTimestamp(selectedEvent.timestamp)}</p>
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
