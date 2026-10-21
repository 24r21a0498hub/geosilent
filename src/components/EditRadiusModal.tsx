import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sliders, 
  Check, 
  Maximize2, 
  Minimize2, 
  Plus, 
  Minus, 
  MapPin, 
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Zone, Location } from '../types';
import { formatDistance, getDistance } from '../utils';

interface EditRadiusModalProps {
  isOpen: boolean;
  zone: Zone | null;
  userLocation: Location | null;
  onClose: () => void;
  onSave: (zoneId: string, newRadius: number) => void;
}

const PRESET_RADII = [
  { label: '30m', value: 30, desc: 'Quiet Room' },
  { label: '60m', value: 60, desc: 'Small Office' },
  { label: '100m', value: 100, desc: 'Standard' },
  { label: '200m', value: 200, desc: 'Department' },
  { label: '350m', value: 350, desc: 'Campus Block' },
  { label: '500m', value: 500, desc: 'Large Complex' },
];

export default function EditRadiusModal({
  isOpen,
  zone,
  userLocation,
  onClose,
  onSave,
}: EditRadiusModalProps) {
  const [radius, setRadius] = useState<number>(zone ? zone.radius : 100);
  const [inputValue, setInputValue] = useState<string>(zone ? String(zone.radius) : '100');

  useEffect(() => {
    if (zone) {
      setRadius(zone.radius);
      setInputValue(String(zone.radius));
    }
  }, [zone]);

  if (!isOpen || !zone) return null;

  const currentDistance = zone.distance !== undefined && zone.distance !== null
    ? zone.distance
    : userLocation
    ? getDistance(userLocation.lat, userLocation.lng, zone.lat, zone.lng)
    : null;
  const isInsideWithNewRadius = currentDistance !== null && currentDistance <= radius;
  const difference = radius - zone.radius;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10) || 10;
    setRadius(val);
    setInputValue(String(val));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 5000) {
      setRadius(parsed);
    }
  };

  const handleInputBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < 10) {
      setRadius(10);
      setInputValue('10');
    } else if (parsed > 5000) {
      setRadius(5000);
      setInputValue('5000');
    } else {
      setRadius(parsed);
      setInputValue(String(parsed));
    }
  };

  const nudgeRadius = (delta: number) => {
    const next = Math.max(10, Math.min(2000, radius + delta));
    setRadius(next);
    setInputValue(String(next));
  };

  const handleSelectPreset = (val: number) => {
    setRadius(val);
    setInputValue(String(val));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(zone.id, radius);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-radius-title"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-2xs">
                <Sliders size={18} />
              </div>
              <div>
                <h3 id="edit-radius-title" className="text-sm font-bold text-slate-800">
                  Edit Zone Radius
                </h3>
                <p className="text-[11px] text-slate-500 truncate max-w-[190px]">
                  {zone.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition"
              aria-label="Close dialog"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="p-5 overflow-y-auto space-y-4 text-slate-800">
            {/* Visual Perimeter Simulation Box */}
            <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden flex flex-col items-center justify-center">
              {/* Grid Background */}
              <div 
                className="absolute inset-0 opacity-15" 
                style={{ 
                  backgroundImage: 'radial-gradient(#818cf8 1px, transparent 1px)', 
                  backgroundSize: '14px 14px' 
                }} 
              />

              {/* Concentric Circle Preview */}
              <div className="relative w-36 h-36 flex items-center justify-center my-1">
                {/* Outer guide ring */}
                <div className="absolute inset-0 rounded-full border border-slate-700/60 border-dashed" />
                
                {/* Original radius dashed ring */}
                <div 
                  className="absolute rounded-full border border-slate-500/40 border-dashed transition-all duration-300"
                  style={{
                    width: `${Math.min(136, Math.max(30, (zone.radius / 300) * 120))}px`,
                    height: `${Math.min(136, Math.max(30, (zone.radius / 300) * 120))}px`,
                  }}
                  title={`Original radius: ${zone.radius}m`}
                />

                {/* Adjusted radius animated area */}
                <motion.div 
                  className={`absolute rounded-full transition-all duration-300 ${
                    isInsideWithNewRadius 
                      ? 'bg-indigo-500/35 border-2 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)]' 
                      : 'bg-indigo-600/20 border-2 border-indigo-500/80'
                  }`}
                  style={{
                    width: `${Math.min(140, Math.max(26, (radius / 300) * 120))}px`,
                    height: `${Math.min(140, Math.max(26, (radius / 300) * 120))}px`,
                  }}
                />

                {/* Center marker */}
                <div className="w-3.5 h-3.5 rounded-full bg-indigo-400 ring-4 ring-indigo-500/30 flex items-center justify-center z-10">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>

                {/* User location dot relative to center if distance is known */}
                {currentDistance !== null && (
                  <div 
                    className="absolute z-10 transition-all duration-300"
                    style={{
                      // Place the user point along an angle
                      transform: `translate(${Math.min(58, Math.max(-58, (currentDistance / 300) * 50))}px, -15px)`,
                    }}
                    title={`User: ${Math.round(currentDistance)}m away`}
                  >
                    <div className="relative">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-emerald-300 shadow-sm animate-pulse" />
                      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-mono text-emerald-300 whitespace-nowrap bg-slate-950/80 px-1 rounded">
                        You ({Math.round(currentDistance)}m)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Geofence Status Badge */}
              <div className="mt-2 text-center z-10">
                {currentDistance !== null ? (
                  isInsideWithNewRadius ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                      <ShieldCheck size={13} className="text-indigo-300" />
                      User is inside perimeter (DND active)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      <MapPin size={12} className="text-slate-400" />
                      {Math.round(currentDistance - radius)}m outside perimeter
                    </span>
                  )
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Radius perimeter: {radius} meters
                  </span>
                )}
              </div>
            </div>

            {/* Stepper and Number Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Perimeter Radius
                </label>
                <div className="flex items-center gap-1 text-xs">
                  {difference !== 0 && (
                    <span className={`font-semibold text-[11px] px-1.5 py-0.5 rounded ${
                      difference > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {difference > 0 ? `+${difference}m larger` : `${difference}m smaller`}
                    </span>
                  )}
                  <span className="text-slate-400 text-[11px]">(original: {zone.radius}m)</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => nudgeRadius(-10)}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition active:scale-95 border border-slate-200"
                  title="Decrease by 10m"
                >
                  <Minus size={16} />
                </button>

                <div className="relative flex-1">
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2 px-3 text-center text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono transition"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                    meters
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => nudgeRadius(10)}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition active:scale-95 border border-slate-200"
                  title="Increase by 10m"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Slider for smooth rapid adjustment */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1 mb-1">
                  <span>20m</span>
                  <span>150m</span>
                  <span>300m</span>
                  <span>500m</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="500"
                  step="5"
                  value={Math.min(500, radius)}
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Presets
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {PRESET_RADII.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleSelectPreset(preset.value)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition border flex flex-col items-center active:scale-95 ${
                      radius === preset.value
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span className={`text-[9px] ${radius === preset.value ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {preset.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition active:scale-98"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 active:scale-98"
              >
                <Check size={14} />
                Save Radius ({radius}m)
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
