import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Timer, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  Footprints,
  Info,
  Sliders,
  Play
} from 'lucide-react';

interface DwellTimeModalProps {
  isOpen: boolean;
  dwellTimeSeconds: number;
  onClose: () => void;
  onSave: (newDwellTimeSeconds: number) => void;
  onTestPassThrough?: () => void;
}

const PRESET_DWELLS = [
  { label: '0s (Off)', value: 0, desc: 'Instant activation', badge: 'Instant' },
  { label: '10s', value: 10, desc: 'Quick filter for corridors', badge: 'Brief' },
  { label: '15s', value: 15, desc: 'Ideal for city & walking', badge: 'Recommended' },
  { label: '20s', value: 20, desc: 'Strong anti-toggling filter', badge: 'Balanced' },
  { label: '30s', value: 30, desc: 'Campus & transit buffer', badge: 'Extended' },
  { label: '45s', value: 45, desc: 'Maximum anti-flicker delay', badge: 'Relaxed' },
];

export default function DwellTimeModal({
  isOpen,
  dwellTimeSeconds,
  onClose,
  onSave,
  onTestPassThrough,
}: DwellTimeModalProps) {
  const [dwell, setDwell] = useState<number>(dwellTimeSeconds);

  useEffect(() => {
    setDwell(dwellTimeSeconds);
  }, [dwellTimeSeconds]);

  if (!isOpen) return null;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDwell(parseInt(e.target.value, 10) || 0);
  };

  const nudgeDwell = (delta: number) => {
    setDwell((prev) => Math.max(0, Math.min(60, prev + delta)));
  };

  const handleSave = () => {
    onSave(dwell);
  };

  return (
    <AnimatePresence>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="dwell-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 via-white to-amber-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                <Timer size={20} />
              </div>
              <div>
                <h2 id="dwell-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                  Entry Dwell Time Delay
                </h2>
                <p className="text-xs text-slate-500">
                  Anti-flicker filter for brief pass-throughs
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
              title="Close modal"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Why Dwell Time Card */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3">
              <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 leading-relaxed">
                <p className="font-bold text-amber-900 mb-0.5">Pass-Through Protection</p>
                <p className="text-amber-800/90 text-[11px]">
                  When walking or driving past a zone perimeter, a brief dwell delay prevents Do Not Disturb from toggling on and off unnecessarily. DND only triggers after you stay inside continuously.
                </p>
              </div>
            </div>

            {/* Big Active Value Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-center relative overflow-hidden">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock size={16} className="text-indigo-600" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Configured Delay Duration
                </span>
              </div>

              <div className="flex items-baseline justify-center gap-1.5 my-1">
                <span className="text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
                  {dwell}
                </span>
                <span className="text-base font-bold text-slate-500">
                  {dwell === 1 ? 'second' : 'seconds'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 mt-2">
                {dwell === 0 ? (
                  <span className="text-[11px] bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">
                    ⚡ Instant (No delay)
                  </span>
                ) : dwell === 15 ? (
                  <span className="text-[11px] bg-indigo-100 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-indigo-200">
                    <Sparkles size={11} />
                    Recommended Setting
                  </span>
                ) : (
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                    🛡️ {dwell}s Pass-Through Shield
                  </span>
                )}
              </div>
            </div>

            {/* Slider & Precision Steppers */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Adjust Dwell Time</span>
                <span className="font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                  {dwell === 0 ? '0s (Instant)' : `${dwell} seconds`}
                </span>
              </div>

              <input 
                type="range"
                min="0"
                max="60"
                step="5"
                value={dwell}
                onChange={handleSliderChange}
                className="w-full accent-indigo-600 h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5">
                <span>0s (Instant)</span>
                <span>15s (Optimal)</span>
                <span>30s</span>
                <span>60s (Max)</span>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => nudgeDwell(-5)}
                  disabled={dwell <= 0}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold rounded-lg transition active:scale-95"
                >
                  -5s
                </button>
                <button
                  type="button"
                  onClick={() => nudgeDwell(-1)}
                  disabled={dwell <= 0}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold rounded-lg transition active:scale-95"
                >
                  -1s
                </button>
                <button
                  type="button"
                  onClick={() => nudgeDwell(1)}
                  disabled={dwell >= 60}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold rounded-lg transition active:scale-95"
                >
                  +1s
                </button>
                <button
                  type="button"
                  onClick={() => nudgeDwell(5)}
                  disabled={dwell >= 60}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold rounded-lg transition active:scale-95"
                >
                  +5s
                </button>
              </div>
            </div>

            {/* Quick 1-Click Presets */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Quick Delay Presets
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_DWELLS.map((preset) => {
                  const isSelected = dwell === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setDwell(preset.value)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-50/80 shadow-xs ring-1 ring-indigo-500' 
                          : 'border-slate-200 hover:border-indigo-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                          {preset.label}
                        </span>
                        {isSelected && <Check size={12} className="text-indigo-600 shrink-0" />}
                      </div>
                      <span className="text-[9px] text-slate-500 mt-1 line-clamp-1">
                        {preset.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Behavior Explanation Card */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                <Info size={13} className="text-indigo-600" />
                Live Behavior Simulation
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                {dwell === 0 ? (
                  <>⚡ <strong>Instant Mode:</strong> DND engages immediately as soon as you enter any geofenced perimeter.</>
                ) : (
                  <>⏱️ When entering a zone, the app counts down <strong>{dwell} seconds</strong>. If you exit the zone within {dwell}s (pass-through), DND is <strong>cancelled without toggling ringer</strong>.</>
                )}
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition active:scale-98 flex items-center justify-center gap-1.5"
            >
              <Check size={14} />
              Apply Dwell Setting ({dwell}s)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
