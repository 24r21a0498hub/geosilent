import React, { useEffect } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  Circle,
  useMap,
  useApiLoadingStatus,
  APILoadingStatus,
  ColorScheme,
} from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';
import { MapTheme } from '../types';
import { useMapsEnvironment } from './MapsProviderWrapper';

interface GeofencePickerMapProps {
  centerLat: number;
  centerLng: number;
  radius: number;
  userLat?: number;
  userLng?: number;
  mapTheme?: MapTheme;
  interactive?: boolean;
  editableRadius?: boolean;
  onPickCoordinates?: (lat: number, lng: number) => void;
  onRadiusChange?: (newRadius: number) => void;
  heightClassName?: string;
  label?: string;
}

function PickerCameraSync({ lat, lng, radius }: { lat: number; lng: number; radius: number }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo({ lat, lng });
    const targetZoom =
      radius <= 60 ? 17.5 : radius <= 140 ? 16.5 : radius <= 300 ? 15.5 : radius <= 600 ? 14.5 : 13.5;
    map.setZoom(targetZoom);
  }, [map, lat, lng, radius]);

  return null;
}

export default function GeofencePickerMap({
  centerLat,
  centerLng,
  radius,
  userLat,
  userLng,
  mapTheme = 'light',
  interactive = true,
  editableRadius = false,
  onPickCoordinates,
  onRadiusChange,
  heightClassName = 'h-48',
  label,
}: GeofencePickerMapProps) {
  const { hasMapsKey, mapsQuotaExceeded } = useMapsEnvironment();
  const apiStatus = useApiLoadingStatus();

  const canRenderGoogleMap =
    hasMapsKey &&
    !mapsQuotaExceeded &&
    apiStatus !== APILoadingStatus.FAILED &&
    apiStatus !== APILoadingStatus.AUTH_FAILURE;

  if (!canRenderGoogleMap) {
    return (
      <div
        className={`w-full ${heightClassName} bg-slate-200 rounded-2xl relative overflow-hidden flex items-center justify-center border-2 border-indigo-200`}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="relative flex flex-col items-center">
          <MapPin size={32} className="text-indigo-600 mb-1 drop-shadow" />
          <div className="w-28 h-28 border-2 border-indigo-500 bg-indigo-500/20 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-2 animate-ping opacity-30" />
        </div>
        {label && (
          <div className="absolute bottom-2.5 left-0 right-0 text-center px-2">
            <span className="bg-white/95 backdrop-blur px-3 py-1 rounded-full text-[11px] font-bold text-slate-700 shadow-sm border border-slate-100 truncate inline-block max-w-[90%]">
              {label}
            </span>
          </div>
        )}
      </div>
    );
  }

  const mapTypeId = mapTheme === 'satellite' ? 'hybrid' : 'roadmap';
  const colorScheme = mapTheme === 'dark' ? ColorScheme.DARK : ColorScheme.LIGHT;

  return (
    <div
      className={`w-full ${heightClassName} rounded-2xl relative overflow-hidden border-2 border-indigo-200 bg-slate-900 shadow-inner`}
    >
      <GoogleMap
        defaultCenter={{ lat: centerLat, lng: centerLng }}
        defaultZoom={16}
        mapId="DEMO_MAP_ID"
        mapTypeId={mapTypeId}
        colorScheme={colorScheme}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
        onClick={(ev) => {
          if (!interactive || !onPickCoordinates || !ev.detail.latLng) return;
          onPickCoordinates(ev.detail.latLng.lat, ev.detail.latLng.lng);
        }}
      >
        <PickerCameraSync lat={centerLat} lng={centerLng} radius={radius} />

        {/* Geofence Perimeter Circle */}
        <Circle
          center={{ lat: centerLat, lng: centerLng }}
          radius={Math.max(10, radius)}
          strokeColor="#4f46e5"
          strokeOpacity={0.95}
          strokeWeight={2.2}
          fillColor="#6366f1"
          fillOpacity={0.24}
          editable={editableRadius}
          draggable={interactive && Boolean(onPickCoordinates)}
          onRadiusChanged={(newRadius) => {
            if (onRadiusChange && typeof newRadius === 'number' && !isNaN(newRadius)) {
              onRadiusChange(Math.max(10, Math.min(5000, Math.round(newRadius))));
            }
          }}
          onCenterChanged={(newCenter) => {
            if (interactive && onPickCoordinates && newCenter) {
              onPickCoordinates(newCenter.lat(), newCenter.lng());
            }
          }}
        />

        {/* Selected Geofence Center Marker */}
        <AdvancedMarker
          position={{ lat: centerLat, lng: centerLng }}
          draggable={interactive && Boolean(onPickCoordinates)}
          onDragEnd={(ev) => {
            if (interactive && onPickCoordinates && ev.latLng) {
              onPickCoordinates(ev.latLng.lat(), ev.latLng.lng());
            }
          }}
          title="Silent Zone Center"
        >
          <div className="flex flex-col items-center -translate-y-1/2">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white border-2 border-white shadow-lg flex items-center justify-center">
              <MapPin size={14} />
            </div>
          </div>
        </AdvancedMarker>

        {/* User Current Location Pin (when provided and different from center) */}
        {typeof userLat === 'number' && typeof userLng === 'number' && (
          <AdvancedMarker position={{ lat: userLat, lng: userLng }} title="Your Current GPS">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-md" />
          </AdvancedMarker>
        )}
      </GoogleMap>

      {label && (
        <div className="absolute bottom-2 left-2 right-10 pointer-events-none">
          <span className="bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-[10.5px] font-bold text-slate-800 shadow-sm border border-slate-200/80 truncate inline-block max-w-full">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
