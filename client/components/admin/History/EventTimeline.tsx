"use client";

import { useState, useMemo } from "react";
import { Clock, MapPin, Zap, Gauge, AlertTriangle, Activity, Shield, Navigation, Car } from "lucide-react";

export interface TimelineEvent {
  id: string;
  type: 'ignition_on' | 'ignition_off' | 'overspeed' | 'harsh_brake' | 'harsh_accel' | 'stop' | 'idle' | 'geofence_entry' | 'geofence_exit' | 'emergency' | 'low_battery' | 'tamper';
  timestamp: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  position: { lat: number; lng: number };
  address?: string;
  data?: {
    speed?: number;
    duration?: number;
    geofenceName?: string;
    voltage?: number;
    heading?: number;
  };
}

export interface EventTimelineProps {
  events: TimelineEvent[];
  selectedEventId: string | null;
  currentTime: string;
  onEventSelect: (eventId: string) => void;
  onJumpToEvent: (eventId: string) => void;
  className?: string;
}

export default function EventTimeline({
  events,
  selectedEventId,
  currentTime,
  onEventSelect,
  onJumpToEvent,
  className = ""
}: EventTimelineProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const typeMatch = filterType === 'all' || event.type === filterType;
      const severityMatch = severityFilter === 'all' || event.severity === severityFilter;
      return typeMatch && severityMatch;
    });
  }, [events, filterType, severityFilter]);

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'ignition_on':
      case 'ignition_off':
        return <Zap size={16} />;
      case 'overspeed':
        return <Gauge size={16} />;
      case 'harsh_brake':
      case 'harsh_accel':
        return <AlertTriangle size={16} />;
      case 'stop':
      case 'idle':
        return <Car size={16} />;
      case 'geofence_entry':
      case 'geofence_exit':
        return <MapPin size={16} />;
      case 'emergency':
        return <Shield size={16} />;
      case 'low_battery':
        return <Activity size={16} />;
      case 'tamper':
        return <AlertTriangle size={16} />;
      default:
        return <Navigation size={16} />;
    }
  };

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'ignition_on':
        return 'text-green-500 bg-green-100 border-green-200';
      case 'ignition_off':
        return 'text-red-500 bg-red-100 border-red-200';
      case 'overspeed':
        return 'text-orange-500 bg-orange-100 border-orange-200';
      case 'harsh_brake':
        return 'text-red-500 bg-red-100 border-red-200';
      case 'harsh_accel':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'stop':
        return 'text-gray-500 bg-gray-100 border-gray-200';
      case 'idle':
        return 'text-yellow-500 bg-yellow-100 border-yellow-200';
      case 'geofence_entry':
        return 'text-blue-500 bg-blue-100 border-blue-200';
      case 'geofence_exit':
        return 'text-purple-500 bg-purple-100 border-purple-200';
      case 'emergency':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'low_battery':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'tamper':
        return 'text-red-500 bg-red-100 border-red-200';
      default:
        return 'text-gray-500 bg-gray-100 border-gray-200';
    }
  };

  const getSeverityColor = (severity: TimelineEvent['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'high':
        return 'border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const eventTypes = [
    { value: 'all', label: 'All Events' },
    { value: 'ignition_on', label: 'Ignition ON' },
    { value: 'ignition_off', label: 'Ignition OFF' },
    { value: 'overspeed', label: 'Overspeed' },
    { value: 'harsh_brake', label: 'Harsh Brake' },
    { value: 'harsh_accel', label: 'Harsh Acceleration' },
    { value: 'stop', label: 'Stop' },
    { value: 'idle', label: 'Idle' },
    { value: 'geofence_entry', label: 'Geofence Entry' },
    { value: 'geofence_exit', label: 'Geofence Exit' },
    { value: 'emergency', label: 'Emergency' },
    { value: 'low_battery', label: 'Low Battery' },
    { value: 'tamper', label: 'Tamper' }
  ];

  const severityLevels = [
    { value: 'all', label: 'All Severities' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  const getEventStats = () => {
    const stats = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return stats;
  };

  const eventStats = getEventStats();

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Event Timeline</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={16} />
            <span>{filteredEvents.length} events</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
          >
            {eventTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
          >
            {severityLevels.map(level => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="bg-red-50 border border-red-200 rounded p-2">
            <div className="font-semibold text-red-700">Critical</div>
            <div className="text-red-600">{eventStats.critical || 0}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded p-2">
            <div className="font-semibold text-orange-700">High</div>
            <div className="text-orange-600">{eventStats.high || 0}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
            <div className="font-semibold text-yellow-700">Medium</div>
            <div className="text-yellow-600">{eventStats.medium || 0}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <div className="font-semibold text-blue-700">Low</div>
            <div className="text-blue-600">{eventStats.low || 0}</div>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No events found</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredEvents.map((event, index) => {
              const isSelected = selectedEventId === event.id;
              const isPastEvent = new Date(event.timestamp) < new Date(currentTime);
              const colorClasses = getEventColor(event.type);
              const severityClasses = getSeverityColor(event.severity);

              return (
                <div
                  key={event.id}
                  className={`relative border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-blue-500' : ''
                  } ${severityClasses}`}
                  onClick={() => {
                    onEventSelect(event.id);
                    onJumpToEvent(event.id);
                  }}
                >
                  {/* Timeline connector */}
                  {index < filteredEvents.length - 1 && (
                    <div className="absolute top-full left-6 w-0.5 h-3 bg-gray-300" />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Event Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses} flex-shrink-0`}>
                      {getEventIcon(event.type)}
                    </div>

                    {/* Event Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {event.title}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {event.description}
                      </p>

                      {/* Event Details */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {event.address || 'Unknown location'}
                        </span>
                        
                        {event.data?.speed && (
                          <span className="flex items-center gap-1">
                            <Gauge size={12} />
                            {event.data.speed.toFixed(1)} km/h
                          </span>
                        )}
                        
                        {event.data?.duration && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDuration(event.data.duration)}
                          </span>
                        )}
                        
                        {event.data?.geofenceName && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {event.data.geofenceName}
                          </span>
                        )}
                      </div>

                      {/* Severity Badge */}
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${
                          event.severity === 'critical' ? 'text-red-700 bg-red-100 border-red-200' :
                          event.severity === 'high' ? 'text-orange-700 bg-orange-100 border-orange-200' :
                          event.severity === 'medium' ? 'text-yellow-700 bg-yellow-100 border-yellow-200' :
                          'text-blue-700 bg-blue-100 border-blue-200'
                        }`}>
                          {event.severity.charAt(0).toUpperCase() + event.severity.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onJumpToEvent(event.id);
                      }}
                      title="Jump to event"
                    >
                      <Navigation size={16} />
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
