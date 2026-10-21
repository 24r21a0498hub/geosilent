import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  MapPin, 
  Clock, 
  VolumeX, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  X, 
  Building, 
  BookOpen, 
  Film, 
  HeartPulse, 
  Church, 
  Compass, 
  Search,
  Plus,
  Sliders,
  CheckCheck,
  Radio
} from 'lucide-react';
import { Zone, SilenceMode, MapsGroundingMetadata } from '../types';
import { getDistance, formatDistance } from '../utils';
import PlaceSearchInput, { GroundedPlaceResult } from './PlaceSearchInput';

interface QuietPlaceDiscoveryModalProps {
  isOpen: boolean;
  onClose?: () => void;
  currentLat: number;
  currentLng: number;
  existingZones: Zone[];
  onAddZone: (newZone: {
    name: string;
    lat: number;
    lng: number;
    radius: number;
    silenceMode: SilenceMode;
    mapsMetadata: MapsGroundingMetadata;
  }) => void;
  isEmbeddedTab?: boolean;
}

export default function QuietPlaceDiscoveryModal({
  isOpen,
  onClose,
  currentLat,
  currentLng,
  existingZones,
  onAddZone,
  isEmbeddedTab = false,
}: QuietPlaceDiscoveryModalProps) {
  const [nearbyPlaces, setNearbyPlaces] = useState<GroundedPlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [lastScannedTime, setLastScannedTime] = useState<string | null>(null);
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('smart_silent_auto_scan_maps') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleAutoScan = () => {
    setAutoScanEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('smart_silent_auto_scan_maps', String(next));
      } catch {}
      return next;
    });
  };

  const fetchNearbyQuietPlaces = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/maps/nearby-quiet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: currentLat,
          lng: currentLng,
        }),
      });

      if (!res.ok) throw new Error(`HTTP error: ${res.statusText}`);
      const data = await res.json();
      if (data && Array.isArray(data.places)) {
        setNearbyPlaces(data.places);
        setLastScannedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      console.error('Failed to load nearby quiet places:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && nearbyPlaces.length === 0) {
      fetchNearbyQuietPlaces();
    }
  }, [isOpen, currentLat, currentLng]);

  if (!isOpen) return null;

  const isPlaceAlreadyAdded = (place: GroundedPlaceResult) => {
    return existingZones.some((z) => {
      if (z.name.toLowerCase() === place.name.toLowerCase()) return true;
      const d = getDistance(z.lat, z.lng, place.lat, place.lng);
      return d < 40; // within 40m
    });
  };

  const handleAddDiscoveredPlace = (place: GroundedPlaceResult) => {
    const silenceMode: SilenceMode = place.quietnessRating === 'whisper' ? 'vibrate' : 'silent';
    onAddZone({
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      radius: place.recommendedRadius || 100,
      silenceMode,
      mapsMetadata: {
        formattedAddress: place.formattedAddress,
        operatingHours: place.operatingHours,
        isOpenNow: place.isOpenNow,
        quietnessRating: place.quietnessRating,
        quietnessSummary: place.quietnessSummary,
        googleMapsUrl: place.googleMapsUrl,
        placeCategory: place.placeCategory,
      },
    });

    setAddedIds((prev) => new Set(prev).add(place.name));
  };

  const handleAutoAddAll = () => {
    filteredPlaces.forEach((place) => {
      if (!isPlaceAlreadyAdded(place) && !addedIds.has(place.name)) {
        handleAddDiscoveredPlace(place);
      }
    });
  };

  const categories = [
    { id: 'all', label: 'All Quiet' },
    { id: 'library', label: 'Libraries & Study' },
    { id: 'health', label: 'Hospitals' },
    { id: 'cinema', label: 'Cinemas' },
    { id: 'focus', label: 'Worship / Focus' },
  ];

  const filteredPlaces = nearbyPlaces.filter((p) => {
    if (activeCategory === 'all') return true;
    const cat = (p.placeCategory || '').toLowerCase();
    const name = p.name.toLowerCase();
    if (activeCategory === 'library') return cat.includes('library') || cat.includes('study') || name.includes('library');
    if (activeCategory === 'health') return cat.includes('hospital') || cat.includes('health') || cat.includes('clinic');
    if (activeCategory === 'cinema') return cat.includes('cinema') || cat.includes('theater') || cat.includes('movie');
    if (activeCategory === 'focus') return cat.includes('worship') || cat.includes('church') || cat.includes('temple') || cat.includes('working') || cat.includes('focus');
    return true;
  });

  const unaddedCount = filteredPlaces.filter((p) => !isPlaceAlreadyAdded(p) && !addedIds.has(p.name)).length;

  const content = (
    <div className={`flex flex-col h-full bg-slate-50 ${isEmbeddedTab ? 'pb-24' : ''}`}>
      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
            <Compass size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                AI Quiet Place Discovery
              </h2>
              <span className="text-[9px] font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                <Sparkles size={8} /> Google Maps
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Grounded with Gemini 3.8 Flash
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchNearbyQuietPlaces}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
            title="Rescan nearby quiet places"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          {!isEmbeddedTab && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Google Maps Search Bar on Top */}
      <div className="p-3 bg-white border-b border-slate-200/80 shadow-2xs">
        <PlaceSearchInput
          currentLat={currentLat}
          currentLng={currentLng}
          placeholder="Search any specific library, clinic, cinema..."
          onSelectPlace={(place) => {
            handleAddDiscoveredPlace(place);
          }}
        />
      </div>

      {/* Auto-Scan Status & Batch Add Strip */}
      <div className="px-4 py-2.5 bg-indigo-50/70 border-b border-indigo-100/80 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${autoScanEnabled ? 'bg-emerald-400' : 'bg-slate-300'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${autoScanEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          </span>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-[11px] truncate flex items-center gap-1.5">
              <span>Automatic Quiet Discovery</span>
              {lastScannedTime && <span className="text-[10px] font-normal text-slate-400">· Scanned {lastScannedTime}</span>}
            </p>
            <p className="text-[10px] text-slate-500 truncate">
              {autoScanEnabled ? 'Scans Google Maps when GPS coordinates update' : 'Manual scan mode only'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {unaddedCount > 0 && (
            <button
              type="button"
              onClick={handleAutoAddAll}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-2xs transition active:scale-95 cursor-pointer flex items-center gap-1"
              title="Automatically add all discovered quiet spots as geofences"
            >
              <CheckCheck size={11} />
              <span>Auto-Add All ({unaddedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="px-3.5 py-2 border-b border-slate-200/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-white">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
              activeCategory === c.id
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Discovered Places List */}
      <div className="p-3.5 flex-1 overflow-y-auto space-y-3">
        {isLoading && nearbyPlaces.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center animate-pulse">
              <Sparkles size={24} className="animate-spin text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Grounding Google Maps Places...</p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-[260px]">
                Querying Gemini 3.8 Flash to evaluate live opening hours and silence profiles nearby.
              </p>
            </div>
          </div>
        ) : filteredPlaces.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <p className="font-semibold text-slate-700">No quiet spots found in this category.</p>
            <button
              type="button"
              onClick={fetchNearbyQuietPlaces}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition cursor-pointer"
            >
              Rescan with Google Maps
            </button>
          </div>
        ) : (
          filteredPlaces.map((place, idx) => {
            const alreadyAdded = isPlaceAlreadyAdded(place) || addedIds.has(place.name);
            const distanceMeters = getDistance(currentLat, currentLng, place.lat, place.lng);

            return (
              <div
                key={`${place.name}-${idx}`}
                className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition space-y-2 group"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100 shadow-2xs group-hover:bg-indigo-600 group-hover:text-white transition">
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {place.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {place.formattedAddress}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => handleAddDiscoveredPlace(place)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 ${
                      alreadyAdded
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
                    }`}
                  >
                    {alreadyAdded ? (
                      <>
                        <Check size={12} />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        <span>Add Zone</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Telemetry: Distance, Real-time Operating Hours, Quietness Rating, Google Maps Link */}
                <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                  <span className="font-semibold text-slate-700">
                    {formatDistance(distanceMeters)} away
                  </span>

                  {place.operatingHours && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Clock size={10} className="text-slate-400" />
                        {place.operatingHours}
                      </span>
                    </>
                  )}

                  {place.quietnessRating && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="font-semibold text-indigo-700 flex items-center gap-0.5">
                        <VolumeX size={10} />
                        {place.quietnessRating === 'silent' ? 'Strictly Silent' : 'Low Noise'}
                      </span>
                    </>
                  )}

                  {place.googleMapsUrl && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <a
                        href={place.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline flex items-center gap-0.5 ml-auto font-medium"
                      >
                        Google Maps <ExternalLink size={9} />
                      </a>
                    </>
                  )}
                </div>

                {place.quietnessSummary && (
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] text-slate-600 leading-relaxed italic">
                    "{place.quietnessSummary}"
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer (Modal Mode only) */}
      {!isEmbeddedTab && onClose && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>{filteredPlaces.length} quiet spots recommended</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );

  if (isEmbeddedTab) {
    return <div className="h-full flex flex-col">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100"
      >
        {content}
      </motion.div>
    </div>
  );
}
