import React from 'react';
import { motion } from 'motion/react';
import { 
  Sun, 
  Moon, 
  Globe, 
  Check, 
  Layers, 
  Sparkles,
  Compass,
  Palette
} from 'lucide-react';
import { MapTheme } from '../types';

interface MapThemeSelectorCardProps {
  currentTheme: MapTheme;
  onChange: (theme: MapTheme) => void;
}

interface ThemeOption {
  id: MapTheme;
  name: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  badge: string;
  previewBg: string;
  previewRing: string;
  previewAccent: string;
  previewGrid: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    name: 'Light',
    tagline: 'Daytime Clarity',
    description: 'Clean cartographic blueprint with crisp contrast for high-glare daytime environments.',
    icon: Sun,
    badge: 'Day Mode',
    previewBg: 'bg-slate-100 border-slate-300',
    previewRing: 'border-indigo-500 bg-indigo-50/80',
    previewAccent: 'bg-indigo-600',
    previewGrid: 'border-slate-300',
  },
  {
    id: 'dark',
    name: 'Dark',
    tagline: 'Tactical Radar HUD',
    description: 'Signature nocturnal radar with deep slate background and glowing neon vectors.',
    icon: Moon,
    badge: 'Default',
    previewBg: 'bg-slate-950 border-slate-800',
    previewRing: 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_12px_rgba(56,189,248,0.25)]',
    previewAccent: 'bg-cyan-400',
    previewGrid: 'border-slate-800',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    tagline: 'Earth & Telemetry',
    description: 'Deep topography terrain styling with orbital telemetry rings and vivid geofence halos.',
    icon: Globe,
    badge: 'High-Tech',
    previewBg: 'bg-[#06141c] border-teal-900',
    previewRing: 'border-teal-400 bg-teal-950/40 shadow-[0_0_12px_rgba(20,184,166,0.3)]',
    previewAccent: 'bg-teal-400',
    previewGrid: 'border-teal-900/60',
  },
];

export default function MapThemeSelectorCard({
  currentTheme,
  onChange,
}: MapThemeSelectorCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-2xs">
            <Palette size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Map Theme</h3>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full capitalize">
                {currentTheme} View
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Visual styling for Radar & Geofence perimeter map
            </p>
          </div>
        </div>
      </div>

      {/* 3-Column Theme Card Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {THEME_OPTIONS.map((theme) => {
          const isSelected = currentTheme === theme.id;
          const Icon = theme.icon;

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              className={`p-3 rounded-2xl border text-left transition-all duration-200 relative flex flex-col justify-between cursor-pointer active:scale-98 ${
                isSelected
                  ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-xs'
                  : 'border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/60'
              }`}
            >
              {/* Top Row: Icon + Badge + Checkmark */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Icon size={13} />
                  </div>
                  <span className="text-xs font-bold text-slate-800">{theme.name}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                    isSelected
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {theme.badge}
                  </span>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </div>
              </div>

              {/* Visual Map Mockup / Preview Box */}
              <div className={`w-full h-16 rounded-xl border relative overflow-hidden flex items-center justify-center select-none mb-2.5 transition-all ${theme.previewBg}`}>
                {/* Simulated Radar Grid Lines */}
                <div className={`absolute inset-0 border-dashed border ${theme.previewGrid} opacity-40`} />
                <div className="w-10 h-10 rounded-full border border-dashed border-current opacity-25" />

                {/* Simulated Geofence Circle */}
                <div className={`w-9 h-9 rounded-full border-2 ${theme.previewRing} flex items-center justify-center`}>
                  {/* Simulated Center Marker */}
                  <div className={`w-2 h-2 rounded-full ${theme.previewAccent}`} />
                </div>

                {/* Simulated User Pin */}
                <div className="absolute bottom-2 left-3 flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white/60 animate-pulse" />
                  <span className="text-[8px] font-bold opacity-75 font-mono">YOU</span>
                </div>

                {/* Mini Theme Tag */}
                <span className="absolute top-1.5 right-2 text-[8px] font-mono uppercase tracking-wider opacity-60">
                  {theme.id}
                </span>
              </div>

              {/* Description */}
              <div>
                <p className="text-[11px] font-semibold text-slate-700">{theme.tagline}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                  {theme.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Helpful context footnote */}
      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-indigo-600 shrink-0" />
          Synchronized with the Radar & Zones view and preserved across sessions.
        </span>
        <span className="font-mono text-[10px] text-slate-400 font-semibold uppercase">
          {currentTheme}
        </span>
      </div>
    </div>
  );
}
