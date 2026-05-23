"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { Gauge, TrendingUp, AlertTriangle, Activity, Clock } from "lucide-react";

export interface SpeedDataPoint {
  timestamp: string;
  speed: number;
  time: string;
}

export interface SpeedViolation {
  timestamp: string;
  speed: number;
  position: { lat: number; lng: number };
  address?: string;
  duration: number;
}

export interface SpeedAnalyticsProps {
  speedData: SpeedDataPoint[];
  violations: SpeedViolation[];
  speedLimit?: number;
  className?: string;
}

export default function SpeedAnalytics({
  speedData,
  violations,
  speedLimit = 60,
  className = ""
}: SpeedAnalyticsProps) {
  const speedStats = useMemo(() => {
    if (speedData.length === 0) {
      return {
        avgSpeed: 0,
        maxSpeed: 0,
        minSpeed: 0,
        totalDistance: 0,
        timeAboveLimit: 0,
        timeBelowLimit: 0,
        violationCount: 0
      };
    }

    const speeds = speedData.map(d => d.speed);
    const avgSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    const maxSpeed = Math.max(...speeds);
    const minSpeed = Math.min(...speeds);
    
    // Calculate time above/below speed limit
    const timeAboveLimit = speedData.filter(d => d.speed > speedLimit).length;
    const timeBelowLimit = speedData.filter(d => d.speed <= speedLimit).length;
    
    // Estimate distance (assuming 5-second intervals)
    const totalDistance = speeds.reduce((sum, speed) => sum + speed, 0) * (5 / 3600); // km
    
    return {
      avgSpeed,
      maxSpeed,
      minSpeed,
      totalDistance,
      timeAboveLimit,
      timeBelowLimit,
      violationCount: violations.length
    };
  }, [speedData, violations, speedLimit]);

  const speedDistribution = useMemo(() => {
    const ranges = [
      { label: '0-20 km/h', min: 0, max: 20, count: 0, color: '#22c55e' },
      { label: '20-40 km/h', min: 20, max: 40, count: 0, color: '#eab308' },
      { label: '40-60 km/h', min: 40, max: 60, count: 0, color: '#f97316' },
      { label: '60-80 km/h', min: 60, max: 80, count: 0, color: '#ef4444' },
      { label: '80+ km/h', min: 80, max: Infinity, count: 0, color: '#dc2626' }
    ];

    speedData.forEach(point => {
      const range = ranges.find(r => point.speed >= r.min && point.speed < r.max);
      if (range) range.count++;
    });

    return ranges;
  }, [speedData]);

  const chartData = useMemo(() => {
    return speedData.map((point, index) => ({
      index: index,
      time: point.time,
      speed: point.speed,
      speedLimit: speedLimit,
      violation: violations.some(v => v.timestamp === point.timestamp)
    }));
  }, [speedData, violations, speedLimit]);

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-semibold">{`Time: ${label}`}</p>
          <p className="text-sm" style={{ color: payload[0].color }}>
            {`Speed: ${payload[0].value.toFixed(1)} km/h`}
          </p>
          {payload[0].payload.violation && (
            <p className="text-sm text-red-600">⚠️ Speed Violation</p>
          )}
        </div>
      );
    }
    return null;
  };

  const SpeedLimitLine = ({ x, y, width, height }: any) => {
    const lineY = y + (height * (1 - speedLimit / Math.max(...speedData.map(d => d.speed))));
    return (
      <line
        x1={x}
        y1={lineY}
        x2={x + width}
        y2={lineY}
        stroke="#ef4444"
        strokeWidth={2}
        strokeDasharray="5,5"
      />
    );
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Speed Analytics</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Gauge size={16} />
          <span>Limit: {speedLimit} km/h</span>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-blue-600" />
            <span className="text-xs font-medium text-blue-800">Avg Speed</span>
          </div>
          <div className="text-lg font-bold text-blue-900">
            {speedStats.avgSpeed.toFixed(1)} km/h
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Gauge size={14} className="text-green-600" />
            <span className="text-xs font-medium text-green-800">Max Speed</span>
          </div>
          <div className="text-lg font-bold text-green-900">
            {speedStats.maxSpeed.toFixed(0)} km/h
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-orange-600" />
            <span className="text-xs font-medium text-orange-800">Violations</span>
          </div>
          <div className="text-lg font-bold text-orange-900">
            {speedStats.violationCount}
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-purple-600" />
            <span className="text-xs font-medium text-purple-800">Distance</span>
          </div>
          <div className="text-lg font-bold text-purple-900">
            {speedStats.totalDistance.toFixed(1)} km
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-red-600" />
            <span className="text-xs font-medium text-red-800">Over Limit</span>
          </div>
          <div className="text-lg font-bold text-red-900">
            {((speedStats.timeAboveLimit / speedData.length) * 100).toFixed(0)}%
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-gray-600" />
            <span className="text-xs font-medium text-gray-800">Min Speed</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {speedStats.minSpeed.toFixed(0)} km/h
          </div>
        </div>
      </div>

      {/* Speed vs Time Chart */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-900 mb-3">Speed Over Time</h4>
        <div className="h-64 bg-gray-50 rounded-lg p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                domain={[0, Math.max(speedStats.maxSpeed, speedLimit + 10)]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="speed" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="speedLimit" 
                stroke="#ef4444" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Speed Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Speed Distribution</h4>
          <div className="h-48 bg-gray-50 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={speedDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Time Distribution</h4>
          <div className="h-48 bg-gray-50 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Below Limit', value: speedStats.timeBelowLimit, color: '#22c55e' },
                    { name: 'Above Limit', value: speedStats.timeAboveLimit, color: '#ef4444' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {speedDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Speed Violations List */}
      {violations.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Speed Violations ({violations.length})</h4>
          <div className="max-h-48 overflow-y-auto">
            <div className="space-y-2">
              {violations.map((violation, index) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} className="text-red-600" />
                        <span className="font-semibold text-red-900">
                          {violation.speed.toFixed(1)} km/h
                        </span>
                        <span className="text-sm text-red-700">
                          (+{(violation.speed - speedLimit).toFixed(1)} km/h)
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatTime(violation.timestamp)} • {violation.address || 'Unknown location'}
                      </div>
                      {violation.duration > 0 && (
                        <div className="text-xs text-gray-500">
                          Duration: {formatDuration(violation.duration)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">#{index + 1}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Actual Speed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-red-500" style={{ borderTop: '2px dashed #ef4444' }}></div>
              <span>Speed Limit ({speedLimit} km/h)</span>
            </div>
          </div>
          <div>
            Total data points: {speedData.length}
          </div>
        </div>
      </div>
    </div>
  );
}
