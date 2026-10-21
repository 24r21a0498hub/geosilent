import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  MapPin, 
  CheckCircle2, 
  Layers, 
  Compass, 
  BellOff, 
  Bell,
  Sun,
  Moon,
  Globe,
  LocateFixed,
  Footprints,
  Navigation,
  LogOut,
  Radio,
  Sparkles
} from 'lucide-react';
import { Zone, Location, MapTheme } from '../types';
import { getDistance, formatDistance } from '../utils';

interface ZonesVisualMapProps {
  zones: Zone[];
  location: Location | null;
  activeZone: Zone | null;
  isDndActive: boolean;
  mapTheme?: MapTheme;
  isSimulating?: boolean;
  onMapThemeChange?: (theme: MapTheme) => void;
  onSelectZone?: (zone: Zone) => void;
  onMoveLocation?: (lat: number, lng: number) => void;
  onStepMove?: (dxMeters: number, dyMeters: number) => void;
  onResetToGps?: () => void;
  onToggleManualDnd?: () => void;
  manualOverrideActive?: boolean;
  onOpenDiscovery?: () => void;
}

export default function ZonesVisualMap({
  zones,
  location,
  activeZone,
  isDndActive,
  mapTheme = 'dark',
  isSimulating = false,
  onMapThemeChange,
  onSelectZone,
  onMoveLocation,
  onStepMove,
  onResetToGps,
  onToggleManualDnd,
  manualOverrideActive,
  onOpenDiscovery,
}: ZonesVisualMapProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [lastMoveMsg, setLastMoveMsg] = useState<string | null>(null);

  // Target real/simulated location
  const targetLat = location?.lat ?? 37.7750;
  const targetLng = location?.lng ?? -122.4194;

  // Smoothly animated coordinates for 60fps walking glide transition
  const [displayCoords, setDisplayCoords] = useState<{ lat: number; lng: number }>({
    lat: targetLat,
    lng: targetLng,
  });
  const [isGliding, setIsGliding] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startLat = displayCoords.lat;
    const startLng = displayCoords.lng;
    const distDelta = Math.hypot(targetLat - startLat, targetLng - startLng);

    // If change is tiny, sync immediately
    if (distDelta < 0.0000005) {
      setDisplayCoords({ lat: targetLat, lng: targetLng });
      return;
    }

    setIsGliding(true);
    const startTime = performance.now();
    const duration = 520; // 520ms smooth walking transition

    const stepAnim = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic for a natural walking glide
      const ease = 1 - Math.pow(1 - progress, 3);

      setDisplayCoords({
        lat: startLat + (targetLat - startLat) * ease,
        lng: startLng + (targetLng - startLng) * ease,
      });

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(stepAnim);
      } else {
        setIsGliding(false);
      }
    };

    animFrameRef.current = requestAnimationFrame(stepAnim);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [targetLat, targetLng]);

  // Track previous active zone to detect and animate exit events
  const prevActiveZoneRef = useRef<Zone | null>(activeZone);
  const [exitEvent, setExitEvent] = useState<{ zoneName: string; timestamp: number } | null>(null);
  const [enterEvent, setEnterEvent] = useState<{ zoneName: string; timestamp: number } | null>(null);

  useEffect(() => {
    // Detect Exit
    if (prevActiveZoneRef.current && !activeZone) {
      setExitEvent({
        zoneName: prevActiveZoneRef.current.name,
        timestamp: Date.now(),
      });
      const timer = setTimeout(() => {
        setExitEvent(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
    // Detect Entry
    if (!prevActiveZoneRef.current && activeZone) {
      setEnterEvent({
        zoneName: activeZone.name,
        timestamp: Date.now(),
      });
      const timer = setTimeout(() => {
        setEnterEvent(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
    prevActiveZoneRef.current = activeZone;
  }, [activeZone]);

  // Theme flags
  const isLight = mapTheme === 'light';
  const isSatellite = mapTheme === 'satellite';
  const isDark = !isLight && !isSatellite;

  // Active display coordinates
  const currentLat = displayCoords.lat;
  const currentLng = displayCoords.lng;

  const viewBoxWidth = 360;
  const viewBoxHeight = 220;
  const centerX = viewBoxWidth / 2;
  const centerY = viewBoxHeight / 2;

  // Compute maximum distance from user to determine sensible scaling
  const { scale, maxDistance, sortedZones } = useMemo(() => {
    let maxDist = 200; // minimum radius in meters to frame nicely

    const withDist = zones.map((z) => {
      const d = getDistance(currentLat, currentLng, z.lat, z.lng);
      if (d + z.radius > maxDist) {
        maxDist = d + z.radius;
      }
      return {
        ...z,
        distance: d,
        isInside: d <= z.radius,
      };
    });

    // Sort by proximity
    withDist.sort((a, b) => a.distance - b.distance);

    // Dynamic scale: meters to pixels
    const availableHalfDim = Math.min(viewBoxWidth, viewBoxHeight) * 0.42;
    const baseScale = availableHalfDim / Math.max(maxDist, 180);
    const computedScale = baseScale * zoomLevel;

    return {
      scale: computedScale,
      maxDistance: maxDist,
      sortedZones: withDist,
    };
  }, [zones, currentLat, currentLng, zoomLevel]);

  // Compute screen coordinates for each zone
  const plottedZones = useMemo(() => {
    const latRad = (currentLat * Math.PI) / 180;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(latRad);

    return sortedZones.map((z) => {
      const dxMeters = (z.lng - currentLng) * metersPerDegreeLng;
      const dyMeters = -(z.lat - currentLat) * metersPerDegreeLat; // Inverted Y for SVG (North is up)

      const cx = centerX + dxMeters * scale;
      const cy = centerY + dyMeters * scale;
      const r = Math.max(14, z.radius * scale);

      return {
        ...z,
        cx,
        cy,
        r,
      };
    });
  }, [sortedZones, currentLat, currentLng, scale, centerX, centerY]);

  // Concentric radar range rings based on scale
  const rangeRings = useMemo(() => {
    const intervals = [50, 100, 200, 400, 800];
    return intervals
      .filter((dist) => dist * scale < Math.max(viewBoxWidth, viewBoxHeight) * 0.7)
      .slice(0, 3);
  }, [scale]);

  const closestZone = sortedZones[0] ?? null;
  const inspectedZone = sortedZones.find((z) => z.id === selectedZoneId) ?? null;

  // Handle clicking on the map canvas to move location
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onMoveLocation) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const svgX = (clickX / rect.width) * viewBoxWidth;
    const svgY = (clickY / rect.height) * viewBoxHeight;

    const latRad = (currentLat * Math.PI) / 180;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(latRad);

    const dxMeters = (svgX - centerX) / scale;
    const dyMeters = -(svgY - centerY) / scale; // SVG Y is inverted (North is negative SVG Y)

    const nextLat = currentLat + (dyMeters / metersPerDegreeLat);
    const nextLng = currentLng + (dxMeters / metersPerDegreeLng);

    const movedDist = Math.round(Math.hypot(dxMeters, dyMeters));
    onMoveLocation(nextLat, nextLng);
    setLastMoveMsg(`Walking ${movedDist}m...`);
    setTimeout(() => setLastMoveMsg(null), 2500);
  };

  return (
    <div className={`w-full rounded-2xl overflow-hidden shadow-sm relative flex flex-col mb-4 transition-colors duration-300 border ${
      isLight 
        ? 'bg-white border-slate-200/90' 
        : isSatellite 
        ? 'bg-[#05111a] border-teal-900/60 shadow-md' 
        : 'bg-slate-900 border-slate-800'
    }`}>
      {/* Top Header & Context Bar */}
      <div className={`px-3.5 py-2 flex items-center justify-between z-10 flex-wrap gap-2 border-b transition-colors ${
        isLight
          ? 'bg-slate-50/95 border-slate-200'
          : isSatellite
          ? 'bg-[#091a24]/95 border-teal-900/50'
          : 'bg-slate-900/90 border-slate-800'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <Compass size={14} className={isLight ? 'text-indigo-600' : isSatellite ? 'text-teal-400' : 'text-indigo-400'} />
          <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${
            isLight ? 'text-slate-800' : isSatellite ? 'text-teal-200 tracking-widest' : 'text-slate-300'
          }`}>
            Geofence Radar
          </span>
          {lastMoveMsg && (
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.2 rounded font-medium animate-fade-in flex items-center gap-1">
              <Footprints size={10} className="animate-bounce" />
              {lastMoveMsg}
            </span>
          )}
        </div>

        {/* Right side: Discovery Launcher + Quick Map Theme switcher + animated status chip */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenDiscovery && (
            <button
              type="button"
              onClick={onOpenDiscovery}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-2xs ${
                isLight 
                  ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200' 
                  : isSatellite
                  ? 'bg-teal-900/60 text-teal-300 hover:bg-teal-800/80 border border-teal-700/50'
                  : 'bg-indigo-900/60 text-indigo-300 hover:bg-indigo-800/80 border border-indigo-700/50'
              }`}
              title="Discover nearby quiet places on Google Maps"
            >
              <Sparkles size={11} className={isSatellite ? 'text-teal-300' : 'text-indigo-400'} />
              <span>AI Places</span>
            </button>
          )}
          {/* Theme Quick Selector Switcher */}
          {onMapThemeChange && (
            <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border transition-colors ${
              isLight 
                ? 'bg-slate-200/80 border-slate-300' 
                : isSatellite 
                ? 'bg-black/40 border-teal-800/60' 
                : 'bg-slate-800/90 border-slate-700'
            }`}>
              <button
                type="button"
                onClick={() => onMapThemeChange('light')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                  isLight ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Switch to Light Theme"
                aria-label="Light Theme"
              >
                <Sun size={10} className={isLight ? 'text-amber-500' : ''} />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button
                type="button"
                onClick={() => onMapThemeChange('dark')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                  isDark ? 'bg-slate-700 text-white shadow-2xs font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to Dark Theme"
                aria-label="Dark Theme"
              >
                <Moon size={10} className={isDark ? 'text-indigo-300' : ''} />
                <span className="hidden sm:inline">Dark</span>
              </button>
              <button
                type="button"
                onClick={() => onMapThemeChange('satellite')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                  isSatellite ? 'bg-teal-600 text-white shadow-2xs font-bold' : 'text-slate-400 hover:text-teal-300'
                }`}
                title="Switch to Satellite Theme"
                aria-label="Satellite Theme"
              >
                <Globe size={10} className={isSatellite ? 'text-teal-200' : ''} />
                <span className="hidden sm:inline">Satellite</span>
              </button>
            </div>
          )}

          {/* Current status chip with smooth entry and subtle pop/fade-out exit animations */}
          <AnimatePresence mode="wait">
            {activeZone ? (
              <motion.span
                key={`active-${activeZone.id}`}
                initial={{ opacity: 0, scale: 0.85, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ 
                  opacity: 0, 
                  scale: 1.3, 
                  filter: 'blur(2px)',
                  transition: { duration: 0.35, ease: 'easeOut' }
                }}
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 border shadow-xs ${
                  isLight
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : isSatellite
                    ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                    : 'bg-indigo-500/25 text-indigo-300 border-indigo-500/40'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  isLight ? 'bg-indigo-600' : isSatellite ? 'bg-purple-400' : 'bg-indigo-400'
                }`} />
                {activeZone.name}
              </motion.span>
            ) : exitEvent ? (
              <motion.span
                key={`exit-${exitEvent.timestamp}`}
                initial={{ opacity: 0, scale: 0.85, y: 2 }}
                animate={{ 
                  opacity: 1, 
                  scale: [0.85, 1.1, 1], 
                  y: 0 
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.9, 
                  y: -3,
                  transition: { duration: 0.25, ease: 'easeIn' }
                }}
                transition={{ duration: 0.35 }}
                className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border bg-emerald-500/20 text-emerald-400 dark:text-emerald-300 border-emerald-500/40 shadow-xs"
              >
                <motion.span
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 0.35 }}
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                />
                Exited: {exitEvent.zoneName}
              </motion.span>
            ) : closestZone ? (
              <motion.span
                key={`closest-${closestZone.id}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  isLight
                    ? 'bg-white text-slate-700 border-slate-300 shadow-2xs'
                    : isSatellite
                    ? 'bg-[#0d222f] text-teal-300 border-teal-800/60'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                Nearest: {closestZone.name} ({formatDistance(closestZone.distance)})
              </motion.span>
            ) : (
              <motion.span
                key="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  isLight
                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                    : isSatellite
                    ? 'bg-[#0a1822] text-teal-400/80 border-teal-900/60'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                No geofences set
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* SVG Canvas - Tap anywhere to move with smooth animation */}
      <div className={`relative w-full h-[220px] flex items-center justify-center overflow-hidden select-none transition-colors duration-300 ${
        isLight
          ? 'bg-slate-100/95'
          : isSatellite
          ? 'bg-[#040e16]'
          : 'bg-slate-950'
      }`}>
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-full cursor-crosshair"
          preserveAspectRatio="xMidYMid meet"
          onClick={handleMapClick}
        >
          <defs>
            {/* Standard Grid Pattern */}
            <pattern id="mapGrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path 
                d="M 30 0 L 0 0 0 30" 
                fill="none" 
                stroke={isLight ? '#cbd5e1' : isSatellite ? '#0d323e' : '#1e293b'} 
                strokeWidth={isLight ? 0.8 : 0.6} 
                strokeDasharray={isLight ? '3,3' : '2,3'} 
              />
            </pattern>

            {/* Satellite Topography Pattern */}
            {isSatellite && (
              <pattern id="satelliteTopo" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 0 15 C 20 8, 40 25, 60 15" fill="none" stroke="#115e59" strokeWidth="0.75" opacity="0.35" />
                <path d="M 0 35 C 15 45, 45 30, 60 40" fill="none" stroke="#115e59" strokeWidth="0.75" opacity="0.35" />
                <path d="M 0 55 C 25 50, 35 60, 60 55" fill="none" stroke="#115e59" strokeWidth="0.75" opacity="0.3" />
                <circle cx="30" cy="30" r="1.2" fill="#2dd4bf" opacity="0.45" />
                <circle cx="10" cy="50" r="1" fill="#0d9488" opacity="0.3" />
              </pattern>
            )}

            {/* Satellite Earth Backdrop Gradient */}
            {isSatellite && (
              <radialGradient id="satelliteEarthGrad" cx="50%" cy="50%" r="65%">
                <stop offset="0%" stopColor="#0c2936" />
                <stop offset="55%" stopColor="#061621" />
                <stop offset="100%" stopColor="#030b10" />
              </radialGradient>
            )}

            {/* Active Zone Radial Gradient */}
            <radialGradient id="activeZoneGlow" cx="50%" cy="50%" r="50%">
              <stop 
                offset="0%" 
                stopColor={isLight ? '#4f46e5' : isSatellite ? '#c084fc' : '#6366f1'} 
                stopOpacity={isLight ? 0.35 : isSatellite ? 0.55 : 0.45} 
              />
              <stop 
                offset="75%" 
                stopColor={isLight ? '#4f46e5' : isSatellite ? '#a855f7' : '#6366f1'} 
                stopOpacity={isLight ? 0.15 : isSatellite ? 0.25 : 0.20} 
              />
              <stop 
                offset="100%" 
                stopColor={isLight ? '#4f46e5' : isSatellite ? '#9333ea' : '#6366f1'} 
                stopOpacity={0.01} 
              />
            </radialGradient>

            {/* Inactive Zone Radial Gradient */}
            <radialGradient id="inactiveZoneGlow" cx="50%" cy="50%" r="50%">
              <stop 
                offset="0%" 
                stopColor={isLight ? '#0284c7' : isSatellite ? '#14b8a6' : '#38bdf8'} 
                stopOpacity={isLight ? 0.22 : isSatellite ? 0.35 : 0.25} 
              />
              <stop 
                offset="85%" 
                stopColor={isLight ? '#0284c7' : isSatellite ? '#0d9488' : '#38bdf8'} 
                stopOpacity={isLight ? 0.08 : isSatellite ? 0.12 : 0.08} 
              />
              <stop 
                offset="100%" 
                stopColor={isLight ? '#0284c7' : isSatellite ? '#0f766e' : '#38bdf8'} 
                stopOpacity={0.0} 
              />
            </radialGradient>

            {/* User beacon glow */}
            <radialGradient id="userBeacon" cx="50%" cy="50%" r="50%">
              <stop 
                offset="0%" 
                stopColor={isLight ? '#059669' : isSatellite ? '#10b981' : '#10b981'} 
                stopOpacity={isLight ? 0.45 : 0.6} 
              />
              <stop 
                offset="100%" 
                stopColor={isLight ? '#059669' : isSatellite ? '#10b981' : '#10b981'} 
                stopOpacity={0.0} 
              />
            </radialGradient>
          </defs>

          {/* Background Layer */}
          {isSatellite ? (
            <>
              <rect width={viewBoxWidth} height={viewBoxHeight} fill="url(#satelliteEarthGrad)" />
              <rect width={viewBoxWidth} height={viewBoxHeight} fill="url(#satelliteTopo)" />
              <rect width={viewBoxWidth} height={viewBoxHeight} fill="url(#mapGrid)" opacity="0.6" />
            </>
          ) : (
            <rect width={viewBoxWidth} height={viewBoxHeight} fill="url(#mapGrid)" />
          )}

          {/* Dynamic 360-Degree Animated Radar Scanner Beam */}
          <g transform={`translate(${centerX}, ${centerY})`} className="pointer-events-none opacity-40">
            <g className="animate-radar-sweep">
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={-135}
                stroke={isLight ? '#6366f1' : isSatellite ? '#2dd4bf' : '#38bdf8'}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M 0 0 L 32 -135 A 135 135 0 0 0 0 -135 Z"
                fill={isLight ? 'rgba(99, 102, 241, 0.12)' : isSatellite ? 'rgba(45, 212, 191, 0.14)' : 'rgba(56, 189, 248, 0.12)'}
              />
            </g>
          </g>

          {/* Concentric Proximity Range Rings centered on user */}
          {rangeRings.map((dist) => {
            const ringR = dist * scale;
            const ringStroke = isLight ? '#94a3b8' : isSatellite ? '#134e4a' : '#334155';
            const ringTextFill = isLight ? '#64748b' : isSatellite ? '#2dd4bf' : '#64748b';

            return (
              <g key={`ring-${dist}`} className="pointer-events-none opacity-50">
                <circle
                  cx={centerX}
                  cy={centerY}
                  r={ringR}
                  fill="none"
                  stroke={ringStroke}
                  strokeWidth={isSatellite ? 1.0 : 0.8}
                  strokeDasharray={isSatellite ? '6,3' : '4,4'}
                />
                <text
                  x={centerX + 3}
                  y={centerY - ringR + 10}
                  fill={ringTextFill}
                  fontSize="8"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  {dist}m
                </text>
              </g>
            );
          })}

          {/* Proximity Vectors / Lines connecting user to zones */}
          {plottedZones.map((zone) => {
            const isSelected = selectedZoneId === zone.id;
            const lineStroke = zone.isInside
              ? (isLight ? '#4f46e5' : isSatellite ? '#c084fc' : '#818cf8')
              : isSelected
              ? (isLight ? '#0284c7' : isSatellite ? '#2dd4bf' : '#38bdf8')
              : (isLight ? '#cbd5e1' : isSatellite ? '#0f3d45' : '#334155');

            return (
              <g key={`line-${zone.id}`} className="pointer-events-none">
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={zone.cx}
                  y2={zone.cy}
                  stroke={lineStroke}
                  strokeWidth={zone.isInside ? 1.8 : 1}
                  strokeDasharray={zone.isInside ? 'none' : '3,3'}
                  opacity={zone.isInside ? 0.95 : 0.55}
                />
              </g>
            );
          })}

          {/* Plotted Geofences: Perimeter circles are visual with animated boundary glows */}
          {plottedZones.map((zone) => {
            const isInside = zone.isInside;
            const isSelected = selectedZoneId === zone.id;

            const circleStroke = isInside
              ? (isLight ? '#4f46e5' : isSatellite ? '#c084fc' : '#818cf8')
              : isSelected
              ? (isLight ? '#0284c7' : isSatellite ? '#22d3ee' : '#38bdf8')
              : zone.enabled
              ? (isLight ? '#0284c7' : isSatellite ? '#14b8a6' : '#38bdf8')
              : (isLight ? '#94a3b8' : isSatellite ? '#334155' : '#64748b');

            const centerDotFill = isInside
              ? (isLight ? '#4f46e5' : isSatellite ? '#9333ea' : '#6366f1')
              : zone.enabled
              ? (isLight ? '#0284c7' : isSatellite ? '#0d9488' : '#0284c7')
              : (isLight ? '#94a3b8' : '#64748b');

            const labelRectFill = isInside
              ? (isLight ? '#4338ca' : isSatellite ? '#581c87' : '#4338ca')
              : isSelected
              ? (isLight ? '#0284c7' : isSatellite ? '#0f766e' : '#0369a1')
              : (isLight ? '#ffffff' : isSatellite ? '#042f2e' : '#1e293b');

            const labelRectStroke = isInside
              ? (isLight ? '#818cf8' : isSatellite ? '#c084fc' : '#818cf8')
              : isSelected
              ? (isLight ? '#38bdf8' : isSatellite ? '#2dd4bf' : '#38bdf8')
              : (isLight ? '#cbd5e1' : isSatellite ? '#115e59' : '#334155');

            const labelTextFill = isInside || isSelected
              ? '#ffffff'
              : (isLight ? '#0f172a' : isSatellite ? '#ccfbf1' : '#ffffff');

            const distTextFill = isLight ? '#475569' : isSatellite ? '#5eead4' : '#94a3b8';

            return (
              <g key={`zone-${zone.id}`} className="transition-all duration-200">
                {/* Zone Area Perimeter Fill - pointer-events-none so tapping anywhere on map moves smoothly */}
                <circle
                  cx={zone.cx}
                  cy={zone.cy}
                  r={zone.r}
                  fill={isInside ? 'url(#activeZoneGlow)' : 'url(#inactiveZoneGlow)'}
                  stroke={circleStroke}
                  strokeWidth={isInside || isSelected ? 2.4 : 1.2}
                  strokeDasharray={zone.enabled ? 'none' : '4,3'}
                  className={`pointer-events-none ${isInside ? 'animate-pulse' : ''}`}
                />

                {/* Animated Boundary Entry Ring if user is inside */}
                {isInside && (
                  <circle
                    cx={zone.cx}
                    cy={zone.cy}
                    r={zone.r}
                    fill="none"
                    stroke={isLight ? '#6366f1' : '#a855f7'}
                    strokeWidth="1.8"
                    className="pointer-events-none animate-entry-glow"
                  />
                )}

                {/* Zone Center Anchor Point - Clickable to inspect zone */}
                <circle
                  cx={zone.cx}
                  cy={zone.cy}
                  r={isSelected ? 6.5 : 5}
                  fill={centerDotFill}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="cursor-pointer transition-transform hover:scale-125"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedZoneId(selectedZoneId === zone.id ? null : zone.id);
                    onSelectZone?.(zone);
                  }}
                />

                {/* Zone Label Capsule - Clickable to inspect zone */}
                <g 
                  transform={`translate(${zone.cx}, ${zone.cy - zone.r - 8})`}
                  className="cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedZoneId(selectedZoneId === zone.id ? null : zone.id);
                    onSelectZone?.(zone);
                  }}
                >
                  <rect
                    x={-((zone.name.length * 5.2 + 16) / 2)}
                    y={-9}
                    width={zone.name.length * 5.2 + 16}
                    height={16}
                    rx={8}
                    fill={labelRectFill}
                    stroke={labelRectStroke}
                    strokeWidth="0.8"
                    className="shadow-sm"
                  />
                  <text
                    x={0}
                    y={2}
                    textAnchor="middle"
                    fill={labelTextFill}
                    fontSize="8.5"
                    fontWeight="600"
                    fontFamily="sans-serif"
                  >
                    {zone.name}
                  </text>
                </g>

                {/* Distance Sub-label */}
                <text
                  x={zone.cx}
                  y={zone.cy + zone.r + 11}
                  textAnchor="middle"
                  fill={distTextFill}
                  fontSize="7.5"
                  fontWeight="500"
                  fontFamily="sans-serif"
                  className="pointer-events-none"
                >
                  {formatDistance(zone.distance)} ({zone.radius}m r)
                </text>
              </g>
            );
          })}

          {/* User Location Center Marker with Walking Glide Animation */}
          <g 
            transform={`translate(${centerX}, ${centerY})`} 
            className={`pointer-events-none ${isGliding ? 'animate-walk-bob' : ''}`}
          >
            {/* Walking Motion Ripples when moving */}
            {isGliding && (
              <circle cx={0} cy={0} r={22} fill="none" stroke="#10b981" strokeWidth="1.5" className="animate-ping opacity-60" />
            )}

            {/* Pulsing Beacon Halo */}
            <circle cx={0} cy={0} r={18} fill="url(#userBeacon)" className="animate-ping opacity-60" />
            <circle 
              cx={0} 
              cy={0} 
              r={11} 
              fill={isLight ? '#059669' : '#10b981'} 
              fillOpacity={isLight ? 0.2 : 0.25} 
            />

            {/* Satellite crosshair ring */}
            {isSatellite && (
              <circle cx={0} cy={0} r={15} fill="none" stroke="#2dd4bf" strokeWidth="0.6" strokeDasharray="2,2" />
            )}

            {/* Core User Pin */}
            <circle 
              cx={0} 
              cy={0} 
              r={5.5} 
              fill={isLight ? '#059669' : '#10b981'} 
              stroke="#ffffff" 
              strokeWidth="1.8" 
            />

            {/* "You" Indicator Tag */}
            <g transform="translate(0, 15)">
              <rect 
                x={-15} 
                y={-7} 
                width={30} 
                height={13} 
                rx={6.5} 
                fill={isLight ? '#dcfce7' : isSatellite ? '#042f2e' : '#065f46'} 
                stroke={isLight ? '#16a34a' : isSatellite ? '#14b8a6' : '#34d399'} 
                strokeWidth="0.8" 
              />
              <text 
                x={0} 
                y={2.5} 
                textAnchor="middle" 
                fill={isLight ? '#15803d' : isSatellite ? '#2dd4bf' : '#ffffff'} 
                fontSize="7.5" 
                fontWeight="bold"
              >
                YOU
              </text>
            </g>
          </g>

          {/* Animated Exit Pop Burst Halo on Canvas */}
          {exitEvent && (
            <g transform={`translate(${centerX}, ${centerY})`} className="pointer-events-none">
              <circle
                r={22}
                fill="none"
                stroke={isLight ? '#ef4444' : '#f43f5e'}
                strokeWidth="2.5"
                className="animate-exit-pop"
              />
              <circle
                r={44}
                fill="none"
                stroke={isLight ? '#10b981' : '#34d399'}
                strokeWidth="1.5"
                strokeDasharray="4,4"
                className="animate-ping opacity-60"
              />
              <g className="animate-fade-in">
                <rect
                  x={-34}
                  y={-30}
                  width={68}
                  height={15}
                  rx={7.5}
                  fill={isLight ? '#ffffff' : '#0f172a'}
                  stroke={isLight ? '#cbd5e1' : '#334155'}
                  strokeWidth="0.8"
                  className="shadow-sm"
                />
                <text
                  x={0}
                  y={-20}
                  textAnchor="middle"
                  fill={isLight ? '#059669' : '#34d399'}
                  fontSize="7"
                  fontWeight="bold"
                >
                  EXIT REGISTERED
                </text>
              </g>
            </g>
          )}

          {/* Animated Entry Pop Glow on Canvas */}
          {enterEvent && (
            <g transform={`translate(${centerX}, ${centerY})`} className="pointer-events-none">
              <circle
                r={26}
                fill="none"
                stroke={isLight ? '#4f46e5' : '#818cf8'}
                strokeWidth="2"
                className="animate-ping opacity-75"
              />
              <g className="animate-fade-in">
                <rect
                  x={-34}
                  y={-30}
                  width={68}
                  height={15}
                  rx={7.5}
                  fill={isLight ? '#eef2ff' : '#1e1b4b'}
                  stroke={isLight ? '#c7d2fe' : '#4338ca'}
                  strokeWidth="0.8"
                  className="shadow-sm"
                />
                <text
                  x={0}
                  y={-20}
                  textAnchor="middle"
                  fill={isLight ? '#4338ca' : '#a5b4fc'}
                  fontSize="7"
                  fontWeight="bold"
                >
                  ENTERED ZONE
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Empty state overlay message if no zones exist */}
        {zones.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-slate-950/40 backdrop-blur-[1px] p-4 text-center">
            <Layers size={22} className="text-slate-400 mb-1.5" />
            <p className="text-xs font-semibold text-slate-200">No Geofences Configured</p>
            <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">
              Add a zone to visualize radius boundaries and relative distances.
            </p>
          </div>
        )}

        {/* Floating Controls: Zoom In, Out, Reset, and Recenter/GPS */}
        <div className="absolute right-2.5 bottom-2.5 flex flex-col gap-1 z-20">
          {onResetToGps && isSimulating && (
            <button
              type="button"
              onClick={onResetToGps}
              className="w-7 h-7 rounded-lg flex items-center justify-center border shadow transition active:scale-95 cursor-pointer bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/30"
              title="Return back to your start / GPS location"
              aria-label="Return to My Location"
            >
              <LocateFixed size={13} className="animate-pulse" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.3).toFixed(1))))}
            className={`w-7 h-7 rounded-lg flex items-center justify-center border shadow transition active:scale-95 cursor-pointer ${
              isLight
                ? 'bg-white/95 hover:bg-slate-100 text-slate-700 border-slate-200'
                : isSatellite
                ? 'bg-[#0a2332]/90 hover:bg-[#0e3144] text-teal-200 border-teal-800/60'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Zoom In"
            aria-label="Zoom in map"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.3).toFixed(1))))}
            className={`w-7 h-7 rounded-lg flex items-center justify-center border shadow transition active:scale-95 cursor-pointer ${
              isLight
                ? 'bg-white/95 hover:bg-slate-100 text-slate-700 border-slate-200'
                : isSatellite
                ? 'bg-[#0a2332]/90 hover:bg-[#0e3144] text-teal-200 border-teal-800/60'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Zoom Out"
            aria-label="Zoom out map"
          >
            <ZoomOut size={13} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center border shadow transition active:scale-95 cursor-pointer ${
              isLight
                ? 'bg-white/95 hover:bg-slate-100 text-slate-700 border-slate-200'
                : isSatellite
                ? 'bg-[#0a2332]/90 hover:bg-[#0e3144] text-teal-200 border-teal-800/60'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Reset Zoom"
            aria-label="Reset zoom"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        {/* Map Tap Guide (Bottom-Left) */}
        <div className={`absolute left-2.5 bottom-2.5 backdrop-blur-sm border rounded-md px-2 py-1 text-[9px] flex items-center gap-2 pointer-events-none ${
          isLight
            ? 'bg-white/90 border-slate-200 text-slate-600 shadow-2xs'
            : isSatellite
            ? 'bg-[#0a1f2c]/85 border-teal-800/80 text-teal-300 shadow-2xs'
            : 'bg-slate-900/85 border-slate-800/90 text-slate-400'
        }`}>
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isSimulating ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
            {isSimulating ? 'Simulated' : 'Live GPS'}
          </span>
          <span className="opacity-40">•</span>
          <span className="font-mono">{zoomLevel}x</span>
          <span className="opacity-40">•</span>
          <span>Tap to walk</span>
        </div>
      </div>

      {/* Quick 100m Walk & Come Back Test Bar */}
      <div className={`px-3 py-1.5 flex items-center justify-between gap-1.5 border-t text-[11px] transition-colors ${
        isLight
          ? 'bg-slate-50 border-slate-200 text-slate-700'
          : isSatellite
          ? 'bg-[#081822] border-teal-900/60 text-teal-200'
          : 'bg-slate-900 border-slate-800 text-slate-300'
      }`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Footprints size={13} className={`text-indigo-400 shrink-0 ${isGliding ? 'animate-bounce' : ''}`} />
          <span className="text-[10px] font-semibold truncate">
            {isGliding ? (
              <span className="text-indigo-400 font-bold animate-pulse">Walking to destination...</span>
            ) : isSimulating ? (
              <span className="text-amber-500 font-bold">Simulated • Tap map to walk</span>
            ) : (
              <span className="text-emerald-500 font-bold">Live GPS tracking active</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onStepMove && (
            <button
              type="button"
              onClick={() => onStepMove(0, -100)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                isLight 
                  ? 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border-slate-200 shadow-2xs' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Step 100 meters away into or out of zone"
            >
              <Footprints size={11} />
              Go 100m
            </button>
          )}

          {onResetToGps && isSimulating && (
            <button
              type="button"
              onClick={onResetToGps}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white transition active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Come back to your real GPS / starting location"
            >
              <RotateCcw size={10} />
              Come Back
            </button>
          )}
        </div>
      </div>

      {/* Selected Zone Inspection Card */}
      {inspectedZone && (
        <div className={`px-3.5 py-2.5 border-t flex items-center justify-between gap-2 transition-colors ${
          isLight
            ? 'bg-slate-50 border-slate-200 text-slate-800'
            : isSatellite
            ? 'bg-[#081822]/95 border-teal-900/60 text-slate-100'
            : 'bg-slate-800/90 border-slate-700/80 text-slate-200'
        }`}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                {inspectedZone.name}
              </span>
              {inspectedZone.isInside ? (
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  isLight
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                    : 'bg-indigo-500/30 text-indigo-300'
                }`}>
                  Inside Perimeter
                </span>
              ) : (
                <span className={`text-[9px] font-medium px-1.5 py-0.2 rounded ${
                  isLight
                    ? 'bg-slate-200/80 text-slate-600'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {formatDistance(inspectedZone.distance)} away
                </span>
              )}
            </div>
            <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Radius: {inspectedZone.radius}m • {inspectedZone.isInside ? 'Auto-DND active' : 'Normal ringer outside'}
            </p>
          </div>

          {inspectedZone.isInside && onToggleManualDnd && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onToggleManualDnd}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
                title={isDndActive ? 'Turn DND off manually' : 'Turn DND on'}
              >
                {isDndActive ? <Bell size={11} /> : <BellOff size={11} />}
                {isDndActive ? 'Unmute' : 'Mute'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
