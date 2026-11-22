import React from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  Building2, 
  Briefcase, 
  Sparkles,
  Check
} from 'lucide-react';
import { SmartZoneMode } from '../types';

export interface SmartModePreset {
  id: SmartZoneMode;
  name: string;
  defaultRadius: number; // 50, 100, 200, 500
  icon: typeof GraduationCap;
  tagline: string;
  color: string;
  bgColor: string;
  borderColor: string;
  silenceMode: 'silent' | 'priority' | 'vibrate';
  features: string[];
}

export const SMART_MODE_PRESETS: SmartModePreset[] = [
  {
    id: 'college',
    name: 'College Mode',
    defaultRadius: 200,
    icon: GraduationCap,
    tagline: 'Lecture Halls & Campus Buildings',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50/80',
    borderColor: 'border-indigo-200',
    silenceMode: 'silent',
    features: ['Classroom Anti-Drift Guard', '25s Exit Grace Period', '200m Geofence Radius']
  },
  {
    id: 'library',
    name: 'Library Mode',
    defaultRadius: 100,
    icon: BookOpen,
    tagline: 'Quiet Study & Reading Rooms',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50/80',
    borderColor: 'border-emerald-200',
    silenceMode: 'silent',
    features: ['Total Pin-Drop Silence', 'Instant Mute on Entry', '100m Geofence Radius']
  },
  {
    id: 'hospital',
    name: 'Hospital Mode',
    defaultRadius: 200,
    icon: Building2,
    tagline: 'Medical Centers & Clinics',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50/80',
    borderColor: 'border-rose-200',
    silenceMode: 'priority',
    features: ['Priority Filter (VIP Calls Ring)', 'Emergency Breakthrough', '200m Geofence Radius']
  },
  {
    id: 'meeting',
    name: 'Meeting Mode',
    defaultRadius: 50,
    icon: Briefcase,
    tagline: 'Conference Rooms & Offices',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50/80',
    borderColor: 'border-amber-200',
    silenceMode: 'silent',
    features: ['Ultra-Tight 50m Radius', 'Quick 10s Dwell Filter', 'Zero Accidental Triggers']
  }
];

interface SmartModesSelectorProps {
  selectedMode: SmartZoneMode;
  onSelectMode: (mode: SmartZoneMode, suggestedRadius: number) => void;
}

export default function SmartModesSelector({
  selectedMode,
  onSelectMode
}: SmartModesSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={13} className="text-indigo-600" />
          Smart Mode Presets
        </label>
        <span className="text-[10px] text-slate-400">Pre-tuned for environments</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SMART_MODE_PRESETS.map((preset) => {
          const isSelected = selectedMode === preset.id;
          const Icon = preset.icon;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectMode(preset.id, preset.defaultRadius)}
              className={`p-3 rounded-2xl border text-left transition relative cursor-pointer ${
                isSelected
                  ? `${preset.bgColor} ${preset.borderColor} border-2 shadow-2xs`
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                  <Check size={10} />
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg ${preset.bgColor} ${preset.color} flex items-center justify-center`}>
                  <Icon size={16} />
                </div>
                <p className="font-bold text-xs text-slate-900 leading-tight">
                  {preset.name}
                </p>
              </div>
              <p className="text-[10px] text-slate-500 line-clamp-1">{preset.tagline}</p>
              <div className="mt-1.5 flex items-center gap-1">
                <span className="text-[9px] font-mono font-bold bg-white/90 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                  {preset.defaultRadius}m
                </span>
                <span className="text-[9px] text-indigo-700 font-medium truncate">
                  {preset.silenceMode === 'priority' ? 'VIP Allowed' : 'Total Silence'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
