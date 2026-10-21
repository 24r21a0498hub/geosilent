import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Zap, 
  Clock, 
  Check, 
  VolumeX, 
  Sparkles,
  Timer
} from 'lucide-react';

interface QuickMuteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (minutes: number) => void;
}

const PRESET_DURATIONS = [
  { mins: 15, label: '15m', desc: 'Brief call / Nap', tag: 'Quick' },
  { mins: 30, label: '30m', desc: 'Short meeting', tag: 'Popular' },
  { mins: 45, label: '45m', desc: 'Presentation', tag: 'Standard' },
  { mins: 60, label: '60m', desc: '1 Hour focus / Class', tag: '1 Hour' },
  { mins: 90, label: '90m', desc: 'Deep work / Movie', tag: '1.5 Hours' },
  { mins: 120, label: '120m', desc: 'Long workshop', tag: '2 Hours' },
];

export default function QuickMuteModal({
  isOpen,
  onClose,
  onStart,
}: QuickMuteModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(30);
  const [customInput, setCustomInput] = useState<string>('30');

  if (!isOpen) return null;

  const handleSelectPreset = (mins: number) => {
    setSelectedMinutes(mins);
    setCustomInput(mins.toString());
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedMinutes(Math.min(720, parsed));
    }
  };

  const nudge = (delta: number) => {
    const next = Math.max(5, Math.min(720, selectedMinutes + delta));
    setSelectedMinutes(next);
    setCustomInput(next.toString());
  };

  const handleConfirm = () => {
    if (selectedMinutes > 0) {
      onStart(selectedMinutes);
    }
  };

  const estimatedEndTime = new Date(Date.now() + selectedMinutes * 60 * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <AnimatePresence>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-mute-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-5 pt-4 pb-3.5 text-white flex items-center justify-between relative shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white border border-white/30 shadow-inner">
                <Zap size={20} className="fill-current text-amber-200" />
              </div>
              <div>
                <h3 id="quick-mute-modal-title" className="font-extrabold text-base tracking-tight leading-tight">
                  Quick Mute
                </h3>
                <p className="text-[11px] text-amber-100 font-medium">Instant DND without any geofence</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-full transition active:scale-95 cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 space-y-3.5 overflow-y-auto">
            {/* Explanation banner */}
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2.5">
              <Timer size={17} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-950 leading-relaxed font-medium">
                Instantly silences your phone for your chosen duration. When time is up, your normal ringer mode restores automatically.
              </p>
            </div>

            {/* Quick Duration Presets Grid */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Select Duration Preset
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_DURATIONS.map((preset) => {
                  const isSelected = selectedMinutes === preset.mins;
                  return (
                    <button
                      key={preset.mins}
                      type="button"
                      onClick={() => handleSelectPreset(preset.mins)}
                      className={`p-2.5 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between h-[68px] ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-300 ring-offset-1'
                          : 'bg-slate-50 hover:bg-slate-100/80 text-slate-800 border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {preset.label}
                        </span>
                        <span className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                          isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {preset.tag}
                        </span>
                      </div>
                      <span className={`text-[9.5px] truncate font-medium ${isSelected ? 'text-amber-100' : 'text-slate-500'}`}>
                        {preset.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Minutes Slider & Nudge */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Custom Duration</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black font-mono text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg">
                    {selectedMinutes} mins
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({(selectedMinutes / 60).toFixed(1)} hrs)
                  </span>
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="5"
                max="240"
                step="5"
                value={selectedMinutes}
                onChange={(e) => handleSelectPreset(parseInt(e.target.value, 10) || 5)}
                className="w-full accent-amber-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />

              {/* Quick Nudge Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => nudge(-15)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition active:scale-95 cursor-pointer shadow-2xs"
                  >
                    -15m
                  </button>
                  <button
                    type="button"
                    onClick={() => nudge(-5)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition active:scale-95 cursor-pointer shadow-2xs"
                  >
                    -5m
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => nudge(5)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition active:scale-95 cursor-pointer shadow-2xs"
                  >
                    +5m
                  </button>
                  <button
                    type="button"
                    onClick={() => nudge(15)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition active:scale-95 cursor-pointer shadow-2xs"
                  >
                    +15m
                  </button>
                  <button
                    type="button"
                    onClick={() => nudge(30)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition active:scale-95 cursor-pointer shadow-2xs"
                  >
                    +30m
                  </button>
                </div>
              </div>
            </div>

            {/* Calculated Restoration Time Preview */}
            <div className="flex items-center justify-between px-2 py-1 text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Clock size={13} className="text-slate-400" />
                Ringer restores at:
              </span>
              <span className="font-bold text-slate-800 font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                {estimatedEndTime}
              </span>
            </div>
          </div>

          {/* Modal Footer CTA */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <VolumeX size={15} />
              Silence for {selectedMinutes} Minutes
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
