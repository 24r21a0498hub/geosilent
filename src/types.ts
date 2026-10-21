export interface MapsGroundingMetadata {
  placeId?: string;
  formattedAddress: string;
  operatingHours?: string;
  isOpenNow?: boolean;
  quietnessRating?: 'silent' | 'whisper' | 'normal';
  quietnessSummary?: string;
  googleMapsUrl?: string;
  placeCategory?: string;
  rating?: number;
}

export type SilenceMode = 'silent' | 'vibrate' | 'priority';

export type Zone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters
  enabled: boolean;
  icon?: string;
  silenceMode?: SilenceMode; // 'silent' (total silence), 'vibrate' (vibrate only), or 'priority' (alarms/vip only)
  wifiSsid?: string; // Optional WiFi SSID beacon pairing for indoor geofencing
  mapsMetadata?: MapsGroundingMetadata; // Google Maps Grounding metadata
  // Visit & duration statistics
  totalVisits?: number;
  totalDurationSeconds?: number;
  lastEnteredAt?: number | null;
  // Dynamic runtime properties
  distance?: number | null;
  isInside?: boolean;
};

export type ZoneStatistic = {
  id: string;
  name: string;
  totalVisits: number;
  totalDurationSeconds: number;
  totalDurationMinutes: number;
  averageDurationMinutes: number;
  averageDurationFormatted: string;
  totalDurationFormatted: string;
  enabled: boolean;
  color?: string;
};

export type Location = {
  lat: number;
  lng: number;
  accuracy: number;
};

export type DndEvent = {
  id: string;
  timestamp: string;
  type: 'enter' | 'exit';
  zoneName: string;
  detail: string;
};

export type ZoneBackupData = {
  app?: string;
  version: string;
  exportedAt: string;
  totalZones: number;
  zones: Zone[];
};

export interface TimeScheduleOverride {
  enabled: boolean;
  startTime: string; // "HH:MM" e.g. "23:00"
  endTime: string;   // "HH:MM" e.g. "07:00"
  days: number[];    // 0=Sun, 1=Mon, ..., 6=Sat
  testForceActive?: boolean; // Force active mode for testing/preview in UI
}

export interface QuickMuteSession {
  active: boolean;
  durationMinutes: number;
  startedAt: number;
  expiresAt: number;
}

export type MapTheme = 'light' | 'dark' | 'satellite';

export interface VipContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export interface EmergencyBypassConfig {
  repeatCallersEnabled: boolean;
  vipContactsEnabled: boolean;
  contacts: VipContact[];
}

export interface PhoneBridgeConfig {
  enabled: boolean;
  webhookUrl: string;
  vibratePhone: boolean;
  notifyOnSync: boolean;
}
