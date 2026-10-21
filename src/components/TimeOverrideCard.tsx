import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  Moon, 
  Sun, 
  Calendar, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Zap, 
  Info,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { TimeScheduleOverride } from '../types';
import { 
  formatTimeTo12Hour, 
  parseTimeToMinutes, 
  getScheduleDurationHours 
} from '../utils';

interface TimeOverrideCardProps {
  schedule: TimeScheduleOverride;
  onChange: (updated: TimeScheduleOverride) => void;
  isCurrentlyActive: boolean;
}

const PRESETS = [
  { label: 'Night Sleep', start: '23:00', end: '07:00', icon: '🌙' },
  { label: 'Late Night', start: '00:00', end: '08:00', icon: '💤' },
  { label: 'Evening Quiet', start: '22:00', end: '06:00', icon: '🌆' },
  { label: 'Work Focus', start: '09:00', end: '13:00', icon: '💼' },
];

const DAYS_OF_WEEK = [
  { day: 1, label: 'Mon', full: 'Monday' },
  { day: 2, label: 'Tue', full: 'Tuesday' },
  { day: 3, label: 'Wed', full: 'Wednesday' },
  { day: 4, label: 'Thu', full: 'Thursday' },
  { day: 5, label: 'Fri', full: 'Friday' },
  { day: 6, label: 'Sat', full: 'Saturday' },
  { day: 0, label: 'Sun', full: 'Sunday' },
];

export default function TimeOverrideCard({
  schedule,
  onChange,
  isCurrentlyActive,
}: TimeOverrideCardProps) {
  const [currentMinutes, setCurrentMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // Keep live needle on timeline updated every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const startMin = parseTimeToMinutes(schedule.startTime);
  const endMin = parseTimeToMinutes(schedule.endTime);
  const crossesMidnight = startMin > endMin;
  const durationHours = getScheduleDurationHours(schedule.startTime, schedule.endTime);

  const handleToggleEnabled = () => {
    onChange({
      ...schedule,
      enabled: !schedule.enabled,
    });
  };

  const handleStartTimeChange = (val: string) => {
    onChange({
      ...schedule,
      startTime: val,
    });
  };

  const handleEndTimeChange = (val: string) => {
    onChange({
      ...schedule,
      endTime: val,
    });
  };

  const handleSelectPreset = (start: string, end: string) => {
    onChange({
      ...schedule,
      enabled: true,
      startTime: start,
      endTime: end,
    });
  };

  const handleToggleDay = (day: number) => {
    const currentDays = schedule.days || [0, 1, 2, 3, 4, 5, 6];
    let nextDays: number[];
    if (currentDays.includes(day)) {
      nextDays = currentDays.filter((d) => d !== day);
      if (nextDays.length === 0) nextDays = [day]; // Keep at least one
    } else {
      nextDays = [...currentDays, day];
    }
    onChange({
      ...schedule,
      days: nextDays,
    });
  };

  const handleSetQuickDays = (type: 'all' | 'weekdays' | 'weekends') => {
    let nextDays: number[];
    if (type === 'all') nextDays = [0, 1, 2, 3, 4, 5, 6];
    else if (type === 'weekdays') nextDays = [1, 2, 3, 4, 5];
    else nextDays = [0, 6];
    onChange({
      ...schedule,
      days: nextDays,
    });
  };

  const handleToggleTestActive = () => {
    onChange({
      ...schedule,
      testForceActive: !schedule.testForceActive,
    });
  };

  // Compute visual 24h timeline percent values
  const nowPercent = (currentMinutes / 1440) * 100;
  const startPercent = (startMin / 1440) * 100;
  const endPercent = (endMin / 1440) * 100;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
      {/* Header & Main Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-2xs ${
            isCurrentlyActive 
              ? 'bg-purple-600 text-white' 
              : schedule.enabled 
              ? 'bg-indigo-100 text-indigo-600' 
              : 'bg-slate-100 text-slate-400'
          }`}>
            <Moon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Time-Based Override</h3>
              {isCurrentlyActive ? (
                <span className="text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-ping" />
                  Active Now
                </span>
              ) : schedule.enabled ? (
                <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  Scheduled
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500">
              Global hours where DND stays on regardless of location
            </p>
          </div>
        </div>

        <button 
          id="time-override-toggle-btn"
          type="button"
          onClick={handleToggleEnabled}
          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
            schedule.enabled ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
          title={schedule.enabled ? 'Disable Time-Based Override' : 'Enable Time-Based Override'}
          aria-label="Toggle Time-Based Override"
        >
          <motion.div 
            layout
            className={`w-4 h-4 bg-white rounded-full absolute top-1 ${schedule.enabled ? 'right-1' : 'left-1'}`}
          />
        </button>
      </div>

      {schedule.enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 pt-1"
        >
          {/* Active Schedule Status Summary Banner */}
          <div className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
            isCurrentlyActive
              ? 'bg-purple-50/80 border-purple-200 text-purple-950'
              : 'bg-indigo-50/60 border-indigo-100 text-slate-700'
          }`}>
            <div className="flex items-start gap-2.5">
              <Clock size={16} className={`shrink-0 mt-0.5 ${isCurrentlyActive ? 'text-purple-600' : 'text-indigo-600'}`} />
              <div>
                <p className="font-bold">
                  {formatTimeTo12Hour(schedule.startTime)} – {formatTimeTo12Hour(schedule.endTime)}
                  <span className="font-normal opacity-85 ml-1.5">
                    ({durationHours} hrs {crossesMidnight ? '• Overnight' : ''})
                  </span>
                </p>
                <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
                  {isCurrentlyActive ? (
                    <strong>DND is currently locked ON by schedule. Location exits will not unmute your phone.</strong>
                  ) : (
                    <span>Schedule is active on selected days. Next session begins at {formatTimeTo12Hour(schedule.startTime)}.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Test Simulation Button */}
            <button
              id="test-force-override-btn"
              type="button"
              onClick={handleToggleTestActive}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition shrink-0 cursor-pointer active:scale-95 ${
                schedule.testForceActive
                  ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Force override on right now to test dashboard status"
            >
              {schedule.testForceActive ? '✓ Force Active (Testing)' : '⚡ Test Active Now'}
            </button>
          </div>

          {/* VISUAL 24-HOUR TIMELINE BAR */}
          <div className="bg-slate-900 rounded-2xl p-3.5 text-white space-y-2 select-none">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold flex items-center gap-1.5 text-slate-300">
                <Moon size={13} className="text-purple-400" />
                24-Hour Override Timeline
              </span>
              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Now: {formatTimeTo12Hour(`${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`)}
              </span>
            </div>

            {/* Horizontal Timeline Track */}
            <div className="relative w-full h-7 bg-slate-800 rounded-lg overflow-hidden border border-slate-700/80">
              {/* Day/Night background gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 opacity-60" />

              {/* Shaded Override Segments */}
              {crossesMidnight ? (
                <>
                  {/* Segment 1: start to midnight (end of track) */}
                  <div 
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-80"
                    style={{
                      left: `${startPercent}%`,
                      width: `${100 - startPercent}%`,
                    }}
                  />
                  {/* Segment 2: midnight to end */}
                  <div 
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-80"
                    style={{
                      left: '0%',
                      width: `${endPercent}%`,
                    }}
                  />
                </>
              ) : (
                <div 
                  className="absolute top-0 bottom-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-80"
                  style={{
                    left: `${startPercent}%`,
                    width: `${Math.max(2, endPercent - startPercent)}%`,
                  }}
                />
              )}

              {/* Current Time Needle Indicator */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-10 pointer-events-none transition-all duration-500 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                style={{ left: `${nowPercent}%` }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-1 -left-1 ring-2 ring-slate-900" />
              </div>
            </div>

            {/* Timeline Tick Labels */}
            <div className="flex justify-between text-[9px] text-slate-400 font-mono px-0.5 pt-0.5">
              <span>12 AM</span>
              <span>4 AM</span>
              <span>8 AM</span>
              <span>12 PM</span>
              <span>4 PM</span>
              <span>8 PM</span>
              <span>12 AM</span>
            </div>
          </div>

          {/* Time Range Pickers */}
          <div className="grid grid-cols-2 gap-3">
            {/* Start Time */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <label htmlFor="schedule-start-time" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Start Quiet Hours
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="schedule-start-time"
                  type="time"
                  value={schedule.startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                Activates DND at {formatTimeTo12Hour(schedule.startTime)}
              </p>
            </div>

            {/* End Time */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <label htmlFor="schedule-end-time" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                End Quiet Hours
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="schedule-end-time"
                  type="time"
                  value={schedule.endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                Restores automation at {formatTimeTo12Hour(schedule.endTime)}
              </p>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Popular Presets</span>
              <span className="text-[10px] text-slate-400">Tap to apply</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => {
                const isSelected = schedule.startTime === p.start && schedule.endTime === p.end;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleSelectPreset(p.start, p.end)}
                    className={`p-2 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer active:scale-98 ${
                      isSelected
                        ? 'bg-purple-50 border-purple-400 text-purple-900 shadow-2xs font-bold'
                        : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="text-sm">{p.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs truncate leading-tight">{p.label}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {formatTimeTo12Hour(p.start)} – {formatTimeTo12Hour(p.end)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Days of Week */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={12} className="text-indigo-600" />
                Active Days
              </span>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleSetQuickDays('all')}
                  className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-600 font-medium border border-slate-200 cursor-pointer"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDays('weekdays')}
                  className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-600 font-medium border border-slate-200 cursor-pointer"
                >
                  Mon-Fri
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDays('weekends')}
                  className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-600 font-medium border border-slate-200 cursor-pointer"
                >
                  Sat-Sun
                </button>
              </div>
            </div>

            {/* Day Pills */}
            <div className="grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map((d) => {
                const isSelected = (schedule.days || [0, 1, 2, 3, 4, 5, 6]).includes(d.day);
                return (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => handleToggleDay(d.day)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                    title={d.full}
                  >
                    <span>{d.label[0]}</span>
                    <span className="text-[9px] font-normal opacity-80">{d.label.slice(1)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
