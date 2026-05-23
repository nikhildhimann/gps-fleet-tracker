"use client";

import { useState, useMemo } from "react";
import { Calendar, Clock, MapPin, Activity, TrendingUp, AlertTriangle } from "lucide-react";

export interface CalendarDay {
  date: Date;
  trips: number;
  distance: number;
  duration: number;
  maxSpeed: number;
  events: number;
}

export interface CalendarHeatmapProps {
  data: CalendarDay[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onQuickJump: (type: 'yesterday' | 'lastWeek' | 'lastMonth') => void;
  className?: string;
}

export default function CalendarHeatmap({
  data,
  selectedDate,
  onDateSelect,
  onQuickJump,
  className = ""
}: CalendarHeatmapProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const days: (Date | null)[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      if (current.getMonth() === month) {
        days.push(new Date(current));
      } else {
        days.push(null);
      }
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentMonth]);

  const getDataForDate = (date: Date): CalendarDay | null => {
    return data.find(d => 
      d.date.toDateString() === date.toDateString()
    ) || null;
  };

  const getIntensityColor = (day: CalendarDay | null): string => {
    if (!day || day.trips === 0) return 'bg-gray-100';
    
    const intensity = Math.min(day.distance / 100, 1); // Normalize to 0-1 (100km max)
    
    if (intensity < 0.2) return 'bg-green-200';
    if (intensity < 0.4) return 'bg-green-300';
    if (intensity < 0.6) return 'bg-green-400';
    if (intensity < 0.8) return 'bg-green-500';
    return 'bg-green-600';
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Driving Overview</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onQuickJump('yesterday')}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            Yesterday
          </button>
          <button
            onClick={() => onQuickJump('lastWeek')}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            Last Week
          </button>
          <button
            onClick={() => onQuickJump('lastMonth')}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            Last Month
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          ←
        </button>
        <h4 className="font-medium text-gray-900">{formatMonth(currentMonth)}</h4>
        <button
          onClick={() => navigateMonth('next')}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {calendarDays.map((date, index) => {
          const dayData = date ? getDataForDate(date) : null;
          const isSelected = selectedDate && date && date.toDateString() === selectedDate.toDateString();
          const isToday = date && date.toDateString() === new Date().toDateString();
          
          return (
            <div
              key={index}
              className={`aspect-square relative group cursor-pointer rounded transition-all ${
                !date ? 'bg-gray-50' : getIntensityColor(dayData)
              } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${isToday ? 'ring-2 ring-orange-500' : ''}`}
              onClick={() => date && onDateSelect(date)}
            >
              {date && (
                <>
                  <div className="text-xs text-center py-1">
                    {date.getDate()}
                  </div>
                  
                  {/* Tooltip */}
                  {dayData && dayData.trips > 0 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                      <div className="font-medium mb-1">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Activity size={10} />
                          <span>{dayData.trips} trips</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={10} />
                          <span>{dayData.distance.toFixed(1)} km</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={10} />
                          <span>{(dayData.duration / 3600).toFixed(1)}h</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp size={10} />
                          <span>{dayData.maxSpeed.toFixed(0)} km/h</span>
                        </div>
                        {dayData.events > 0 && (
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={10} />
                            <span>{dayData.events} events</span>
                          </div>
                        )}
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-gray-100 rounded"></div>
            <div className="w-3 h-3 bg-green-200 rounded"></div>
            <div className="w-3 h-3 bg-green-300 rounded"></div>
            <div className="w-3 h-3 bg-green-400 rounded"></div>
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <div className="w-3 h-3 bg-green-600 rounded"></div>
          </div>
          <span>More</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Selected</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900">
              {data.reduce((sum, day) => sum + day.trips, 0)}
            </div>
            <div className="text-xs text-gray-600">Total Trips</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">
              {data.reduce((sum, day) => sum + day.distance, 0).toFixed(0)} km
            </div>
            <div className="text-xs text-gray-600">Total Distance</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">
              {(data.reduce((sum, day) => sum + day.duration, 0) / 3600).toFixed(1)}h
            </div>
            <div className="text-xs text-gray-600">Total Time</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">
              {Math.max(...data.map(d => d.maxSpeed), 0).toFixed(0)} km/h
            </div>
            <div className="text-xs text-gray-600">Max Speed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
