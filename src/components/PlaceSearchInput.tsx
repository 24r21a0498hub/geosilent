import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Clock, VolumeX, Volume2, Sparkles, X, Loader2, ExternalLink, ShieldCheck } from 'lucide-react';
import { MapsGroundingMetadata } from '../types';

export interface GroundedPlaceResult {
  name: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  operatingHours?: string;
  isOpenNow?: boolean;
  quietnessRating?: 'silent' | 'whisper' | 'normal';
  quietnessSummary?: string;
  recommendedRadius?: number;
  googleMapsUrl?: string;
  placeCategory?: string;
}

interface PlaceSearchInputProps {
  currentLat?: number;
  currentLng?: number;
  placeholder?: string;
  onSelectPlace: (place: GroundedPlaceResult) => void;
  className?: string;
}

export default function PlaceSearchInput({
  currentLat,
  currentLng,
  placeholder = 'Search library, hospital, cinema on Google Maps...',
  onSelectPlace,
  className = '',
}: PlaceSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GroundedPlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSearchError(null);

    try {
      const res = await fetch('/api/maps/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchTerm.trim(),
          lat: currentLat,
          lng: currentLng,
        }),
      });

      if (!res.ok) {
        throw new Error(`Search failed: ${res.statusText}`);
      }

      const data = await res.json();
      if (data && Array.isArray(data.places)) {
        setResults(data.places);
        setIsOpen(data.places.length > 0);
      } else {
        setResults([]);
      }
    } catch (err: any) {
      console.error('Error searching places:', err);
      setSearchError('Could not reach Google Maps. Try typing more specifically.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length >= 2) {
      setIsLoading(true);
      debounceTimerRef.current = setTimeout(() => {
        performSearch(val);
      }, 450);
    } else {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleSelect = (place: GroundedPlaceResult) => {
    setQuery(place.name);
    setIsOpen(false);
    onSelectPlace(place);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center gap-1">
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-indigo-600" />
          ) : (
            <Search size={16} className="text-slate-400" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full bg-white border border-slate-200/90 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Grounding Source Badge */}
      <div className="flex items-center justify-between px-1 mt-1 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Sparkles size={10} className="text-indigo-500" />
          Grounded with Google Maps &amp; Gemini 3.8
        </span>
        {isLoading && <span className="text-indigo-600 font-medium animate-pulse">Searching Google Maps...</span>}
      </div>

      {/* Dropdown Results Menu */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
          <div className="p-2 bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Google Maps Verified Places</span>
            <span>{results.length} found</span>
          </div>

          {results.map((place, idx) => (
            <button
              key={`${place.name}-${idx}`}
              type="button"
              onClick={() => handleSelect(place)}
              className="w-full p-3 text-left hover:bg-indigo-50/60 transition flex items-start gap-3 cursor-pointer group active:bg-indigo-100/50"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition">
                <MapPin size={16} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-950 transition">
                    {place.name}
                  </h4>
                  {place.quietnessRating && (
                    <span className="text-[9px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                      <VolumeX size={9} />
                      {place.quietnessRating === 'silent' ? 'Silent' : 'Quiet'}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {place.formattedAddress}
                </p>

                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                  {place.operatingHours && (
                    <span className="flex items-center gap-1 text-slate-600 font-medium">
                      <Clock size={10} className="text-slate-400" />
                      {place.operatingHours}
                    </span>
                  )}
                  {place.placeCategory && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{place.placeCategory}</span>
                    </>
                  )}
                </div>

                {place.quietnessSummary && (
                  <p className="text-[10px] text-indigo-600/90 font-medium mt-1 line-clamp-1 italic">
                    "{place.quietnessSummary}"
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {searchError && (
        <div className="p-2 mt-1 bg-amber-50 text-amber-800 rounded-xl text-[11px] border border-amber-200">
          {searchError}
        </div>
      )}
    </div>
  );
}
