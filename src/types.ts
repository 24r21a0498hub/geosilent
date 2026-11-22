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

export type SmartZoneMode = 'college' | 'library' | 'hospital' | 'meeting' | 'custom';

export type Zone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters (presets: 50, 100, 200, 500)
  enabled: boolean;
  mode?: SmartZoneMode;
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

export type AndroidInterruptionFilter = 'ALL' | 'PRIORITY' | 'NONE' | 'ALARMS' | 'UNKNOWN';

export interface AndroidCompanionDevice {
  deviceId: string;
  deviceName: string;
  pairingCode: string;
  connected: boolean;
  lastHeartbeat: number;
  dndActive: boolean; // Confirmed by Android OS NotificationManager
  interruptionFilter: AndroidInterruptionFilter;
  permissionDndGranted: boolean;
  permissionBackgroundLocation: boolean;
  batteryLevel?: number;
  currentLatitude?: number;
  currentLongitude?: number;
  activeZoneName?: string;
  lastSyncTimestamp?: number;
  appVersion?: string;
  monitoringEnabled?: boolean;
}

export interface AndroidSyncState {
  isConfigured: boolean;
  pairingCode: string;
  deviceId: string;
  device: AndroidCompanionDevice | null;
  lastSyncTime: number | null;
  syncInProgress: boolean;
  errorMessage: string | null;
}

