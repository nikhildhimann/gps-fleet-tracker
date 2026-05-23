"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, MapPin, Gauge, Battery, Wifi, Thermometer, Navigation, Zap, Activity, TrendingUp } from "lucide-react";

export interface TelemetryData {
  timestamp: string;
  location: string;
  speed: number;
  heading: number;
  fuel: number;
  battery: number;
  engineTemp: number;
  odometer: number;
  ignition: boolean;
  gsmSignal: number;
  voltage: number;
  altitude: number;
  satellites: number;
}

export interface LiveTelemetryPanelProps {
  data: TelemetryData | null;
  isPlaying: boolean;
  showAdvanced?: boolean;
  className?: string;
}

export default function LiveTelemetryPanel({
  data,
  isPlaying,
  showAdvanced = false,
  className = ""
}: LiveTelemetryPanelProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const getHeadingDirection = (heading: number): string => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  };

  const getFuelColor = (fuel: number): string => {
    if (fuel > 60) return 'text-green-600';
    if (fuel > 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBatteryColor = (voltage: number): string => {
    if (voltage > 12.5) return 'text-green-600';
    if (voltage > 12.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSignalStrength = (signal: number): { color: string; bars: number } => {
    if (signal >= 20) return { color: 'text-green-600', bars: 4 };
    if (signal >= 15) return { color: 'text-green-500', bars: 3 };
    if (signal >= 10) return { color: 'text-yellow-600', bars: 2 };
    if (signal >= 5) return { color: 'text-orange-600', bars: 1 };
    return { color: 'text-red-600', bars: 0 };
  };

  const getSpeedColor = (speed: number): string => {
    if (speed < 30) return 'text-green-600';
    if (speed < 60) return 'text-blue-600';
    if (speed < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEngineTempColor = (temp: number): string => {
    if (temp < 80) return 'text-green-600';
    if (temp < 95) return 'text-yellow-600';
    return 'text-red-600';
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
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const signalStrength = data ? getSignalStrength(data.gsmSignal) : { color: 'text-gray-400', bars: 0 };

  if (!data) {
    return (
      <div className={`bg-gray-900 text-white rounded-lg shadow-xl p-4 ${className}`}>
        <div className="text-center text-gray-400 py-8">
          <Navigation size={48} className="mx-auto mb-4 opacity-50" />
          <p>No telemetry data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 text-white rounded-lg shadow-xl p-4 ${className}`}>
      {/* Header with status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-sm font-semibold">Live Telemetry</span>
        </div>
        <div className="text-xs text-gray-400">
          {formatDate(data.timestamp)}
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Time */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-blue-400" />
            <span className="text-xs text-gray-400">Time</span>
          </div>
          <div className="text-lg font-bold text-blue-400">
            {formatTimestamp(data.timestamp)}
          </div>
        </div>

        {/* Speed */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Gauge size={14} className={getSpeedColor(data.speed)} />
            <span className="text-xs text-gray-400">Speed</span>
          </div>
          <div className={`text-lg font-bold ${getSpeedColor(data.speed)}`}>
            {data.speed.toFixed(1)} km/h
          </div>
        </div>

        {/* Location */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={14} className="text-green-400" />
            <span className="text-xs text-gray-400">Location</span>
          </div>
          <div className="text-sm font-medium text-green-400 truncate">
            {data.location || 'Unknown'}
          </div>
        </div>

        {/* Heading */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Navigation size={14} className="text-purple-400" />
            <span className="text-xs text-gray-400">Heading</span>
          </div>
          <div className="text-lg font-bold text-purple-400">
            {data.heading.toFixed(0)}° {getHeadingDirection(data.heading)}
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Fuel */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Battery size={14} className={getFuelColor(data.fuel)} />
            <span className="text-xs text-gray-400">Fuel</span>
          </div>
          <div className={`text-lg font-bold ${getFuelColor(data.fuel)}`}>
            {data.fuel.toFixed(0)}%
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
            <div 
              className={`h-1.5 rounded-full transition-all ${getFuelColor(data.fuel).replace('text-', 'bg-')}`}
              style={{ width: `${Math.max(0, Math.min(100, data.fuel))}%` }}
            />
          </div>
        </div>

        {/* Battery */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className={getBatteryColor(data.battery)} />
            <span className="text-xs text-gray-400">Battery</span>
          </div>
          <div className={`text-lg font-bold ${getBatteryColor(data.battery)}`}>
            {data.battery.toFixed(1)}V
          </div>
        </div>

        {/* Engine Temp */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Thermometer size={14} className={getEngineTempColor(data.engineTemp)} />
            <span className="text-xs text-gray-400">Engine</span>
          </div>
          <div className={`text-lg font-bold ${getEngineTempColor(data.engineTemp)}`}>
            {data.engineTemp.toFixed(0)}°C
          </div>
        </div>

        {/* Odometer */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-cyan-400" />
            <span className="text-xs text-gray-400">Odometer</span>
          </div>
          <div className="text-lg font-bold text-cyan-400">
            {(data.odometer / 1000).toFixed(1)}k km
          </div>
        </div>
      </div>

      {/* Advanced Metrics */}
      {showAdvanced && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {/* GSM Signal */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Wifi size={14} className={signalStrength.color} />
              <span className="text-xs text-gray-400">Signal</span>
            </div>
            <div className={`text-lg font-bold ${signalStrength.color}`}>
              {data.gsmSignal}
            </div>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={`w-1 h-2 rounded-full ${
                    bar <= signalStrength.bars ? signalStrength.color.replace('text-', 'bg-') : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Altitude */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={14} className="text-indigo-400" />
              <span className="text-xs text-gray-400">Altitude</span>
            </div>
            <div className="text-lg font-bold text-indigo-400">
              {data.altitude.toFixed(0)}m
            </div>
          </div>

          {/* Satellites */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Navigation size={14} className="text-teal-400" />
              <span className="text-xs text-gray-400">Satellites</span>
            </div>
            <div className="text-lg font-bold text-teal-400">
              {data.satellites}
            </div>
          </div>

          {/* Ignition Status */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className={data.ignition ? 'text-green-400' : 'text-red-400'} />
              <span className="text-xs text-gray-400">Ignition</span>
            </div>
            <div className={`text-lg font-bold ${data.ignition ? 'text-green-400' : 'text-red-400'}`}>
              {data.ignition ? 'ON' : 'OFF'}
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="border-t border-gray-700 pt-3 mt-4">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>GPS: {data.satellites} sats</span>
            <span className={signalStrength.color}>Signal: {data.gsmSignal}</span>
            <span className={data.ignition ? 'text-green-400' : 'text-red-400'}>
              Ignition: {data.ignition ? 'ON' : 'OFF'}
            </span>
          </div>
          <div>
            Last Update: {formatTimestamp(data.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}
