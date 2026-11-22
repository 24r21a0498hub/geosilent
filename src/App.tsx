/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  BellOff, 
  Bell, 
  Settings, 
  Plus, 
  Map as MapIcon, 
  Home, 
  Wifi, 
  Battery, 
  Signal, 
  CheckCircle2, 
  Trash2, 
  ChevronLeft,
  Volume2,
  VolumeX,
  Radio,
  Footprints,
  Sparkles,
  X,
  History,
  ShieldCheck,
  Check,
  Download,
  Upload,
  LogOut,
  BarChart3,
  Clock,
  Layers,
  Navigation,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Compass,
  Sliders,
  Timer,
  Moon,
  Zap,
  Hourglass,
  WifiOff,
  Vibrate,
  Star,
  ShieldAlert,
  PhoneCall,
  Smartphone,
  ExternalLink,
  Lock,
  Unlock,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { Zone, Location, DndEvent, TimeScheduleOverride, MapTheme, QuickMuteSession, SilenceMode, VipContact, EmergencyBypassConfig, PhoneBridgeConfig, MapsGroundingMetadata } from './types';
import { 
  getDistance, 
  formatDistance, 
  playDndChime, 
  formatDurationSeconds,
  formatTimeTo12Hour,
  isScheduleActiveNow
} from './utils';
import ZonesVisualMap from './components/ZonesVisualMap';
import { MapsProviderWrapper } from './components/MapsProviderWrapper';
import GeofencePickerMap from './components/GeofencePickerMap';
import ZoneBackupModal from './components/ZoneBackupModal';
import ZoneStatistics from './components/ZoneStatistics';
import EditRadiusModal from './components/EditRadiusModal';
import DwellTimeModal from './components/DwellTimeModal';
import TimeOverrideCard from './components/TimeOverrideCard';
import MapThemeSelectorCard from './components/MapThemeSelectorCard';
import QuickMuteModal from './components/QuickMuteModal';
import GpsAccuracySparkline, { GpsAccuracyPoint } from './components/GpsAccuracySparkline';
import EmergencyBypassCard from './components/EmergencyBypassCard';
import IncomingCallModal from './components/IncomingCallModal';
import PhoneHardwareCard from './components/PhoneHardwareCard';
import PhoneHardwareBridgeModal from './components/PhoneHardwareBridgeModal';
import PlaceSearchInput, { GroundedPlaceResult } from './components/PlaceSearchInput';
import QuietPlaceDiscoveryModal from './components/QuietPlaceDiscoveryModal';
import SmartModesSelector, { SMART_MODE_PRESETS } from './components/SmartModesSelector';
import { 
  getOrCreatePairingInfo, 
  initializeDeviceDocument, 
  syncZonesToFirestore, 
} from './services/firebaseSync';
import { testFirestoreConnection } from './firebase';
import { SmartZoneMode } from './types';
import {
  isInbuiltApkEnvironment,
  getInbuiltDndStatus,
  requestInbuiltDndPermission,
  requestInbuiltEmergencyCallPermissions,
  setInbuiltDndState,
  syncZonesToInbuiltApk,
  syncEmergencyConfigToInbuiltApk,
  triggerInbuiltEmergencyTestRing,
  InbuiltDndStatus,
} from './utils/nativeDndBridge';

const STORAGE_KEY = 'smart_silent_zones_v2';
const DWELL_TIME_STORAGE_KEY = 'smart_silent_dwell_time_seconds';
const AUTO_ZONES_PURGED_FLAG = 'smart_silent_auto_zones_purged_v2';
const TIME_OVERRIDE_STORAGE_KEY = 'smart_silent_time_override_v2';
const MAP_THEME_STORAGE_KEY = 'smart_silent_map_theme_v1';
const QUICK_MUTE_STORAGE_KEY = 'smart_silent_quick_mute_v1';
const GPS_ACCURACY_STORAGE_KEY = 'smart_silent_gps_accuracy_history_v1';
const EMERGENCY_BYPASS_STORAGE_KEY = 'smart_silent_emergency_bypass_v1';
const WIFI_SSID_STORAGE_KEY = 'smart_silent_wifi_ssid_v1';
const PHONE_BRIDGE_STORAGE_KEY = 'smart_silent_phone_bridge_v1';
const LAST_KNOWN_LOCATION_KEY = 'smart_silent_last_known_location_v2';
const CLASSROOM_LOCK_STORAGE_KEY = 'smart_silent_classroom_lock_v1';
const EXIT_GRACE_STORAGE_KEY = 'smart_silent_exit_grace_seconds_v1';
const FILTER_COARSE_GPS_STORAGE_KEY = 'smart_silent_filter_coarse_gps_v1';

const getStoredExitGraceSeconds = (): number => {
  try {
    const saved = localStorage.getItem(EXIT_GRACE_STORAGE_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 60) return parsed;
    }
  } catch {}
  return 25; // 25 seconds default exit grace verification period
};

const getStoredClassroomLockPref = (): boolean => {
  try {
    const saved = localStorage.getItem(CLASSROOM_LOCK_STORAGE_KEY);
    if (saved !== null) return saved === 'true';
  } catch {}
  return true; // Default to true so classroom / quiet zones are automatically shielded from indoor drift
};

const getStoredFilterCoarseGps = (): boolean => {
  try {
    const saved = localStorage.getItem(FILTER_COARSE_GPS_STORAGE_KEY);
    if (saved !== null) return saved === 'true';
  } catch {}
  return true; // Default to true
};

const getStoredLastKnownLocation = (savedZones: Zone[]): Location => {
  try {
    const saved = localStorage.getItem(LAST_KNOWN_LOCATION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        return parsed;
      }
    }
  } catch {}

  // If user has saved zones (e.g. Class), anchor to the first zone
  if (savedZones.length > 0 && typeof savedZones[0].lat === 'number') {
    return {
      lat: savedZones[0].lat,
      lng: savedZones[0].lng,
      accuracy: 10,
    };
  }

  // Fallback to a neutral coordinate
  return { lat: 17.3850, lng: 78.4867, accuracy: 10 };
};

const DEFAULT_PHONE_BRIDGE_CONFIG: PhoneBridgeConfig = {
  enabled: false,
  webhookUrl: '',
  vibratePhone: true,
  notifyOnSync: true,
};

const getStoredPhoneBridgeConfig = (): PhoneBridgeConfig => {
  try {
    const saved = localStorage.getItem(PHONE_BRIDGE_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_PHONE_BRIDGE_CONFIG;
};

const DEFAULT_EMERGENCY_CONFIG: EmergencyBypassConfig = {
  repeatCallersEnabled: true,
  vipContactsEnabled: true,
  contacts: [
    { id: '1', name: 'Mom', phone: '(555) 234-5678', relation: 'Family' },
    { id: '2', name: 'Dr. Davis', phone: '(555) 890-1234', relation: 'Doctor' },
    { id: '3', name: 'Alex (Spouse)', phone: '(555) 432-1098', relation: 'Family' },
  ],
};

const getStoredEmergencyConfig = (): EmergencyBypassConfig => {
  try {
    const saved = localStorage.getItem(EMERGENCY_BYPASS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_EMERGENCY_CONFIG;
};

const getStoredWifiSsid = (): string => {
  try {
    const saved = localStorage.getItem(WIFI_SSID_STORAGE_KEY);
    if (saved) return saved;
  } catch {}
  return 'Campus_Library_5G';
};

const getInitialGpsHistory = (): GpsAccuracyPoint[] => {
  try {
    const saved = localStorage.getItem(GPS_ACCURACY_STORAGE_KEY);
    if (saved) {
      const parsed: GpsAccuracyPoint[] = JSON.parse(saved);
      const tenMinsAgo = Date.now() - 10 * 60 * 1000;
      const recent = parsed.filter((p) => p.timestamp >= tenMinsAgo);
      if (recent.length >= 4) return recent;
    }
  } catch {
    // fallback to seed
  }

  const now = Date.now();
  const points: GpsAccuracyPoint[] = [];
  const baseAcc = 8;
  for (let i = 10; i >= 0; i--) {
    const t = now - i * 60 * 1000;
    const noise = Math.sin(i * 1.5) * 3 + Math.cos(i * 0.7) * 2;
    const acc = Math.max(4, Math.round(baseAcc + noise));
    points.push({
      timestamp: t,
      timeStr: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      accuracy: acc,
      lat: 37.7750,
      lng: -122.4194,
    });
  }
  return points;
};

const getStoredQuickMuteSession = (): QuickMuteSession | null => {
  try {
    const saved = localStorage.getItem(QUICK_MUTE_STORAGE_KEY);
    if (!saved) return null;
    const parsed: QuickMuteSession = JSON.parse(saved);
    if (parsed && parsed.active && parsed.expiresAt > Date.now()) {
      return parsed;
    }
    localStorage.removeItem(QUICK_MUTE_STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
};

const getStoredMapTheme = (): MapTheme => {
  try {
    const stored = localStorage.getItem(MAP_THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'satellite') {
      return stored;
    }
  } catch {
    // fallback
  }
  return 'dark'; // default theme
};

const getStoredTimeOverride = (): TimeScheduleOverride => {
  try {
    const stored = localStorage.getItem(TIME_OVERRIDE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return {
          enabled: Boolean(parsed.enabled),
          startTime: typeof parsed.startTime === 'string' ? parsed.startTime : '23:00',
          endTime: typeof parsed.endTime === 'string' ? parsed.endTime : '07:00',
          days: Array.isArray(parsed.days) ? parsed.days : [0, 1, 2, 3, 4, 5, 6],
          testForceActive: Boolean(parsed.testForceActive),
        };
      }
    }
  } catch {
    // fallback
  }
  return {
    enabled: false,
    startTime: '23:00',
    endTime: '07:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    testForceActive: false,
  };
};

const getStoredDwellTime = (): number => {
  try {
    const stored = localStorage.getItem(DWELL_TIME_STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 120) {
        return parsed;
      }
    }
  } catch {
    // Fall back to default dwell time
  }
  return 15; // default 15 seconds recommended
};

const DEFAULT_INITIAL_ZONES: Zone[] = [];

const getStoredZones = (): Zone[] => {
  try {
    // Purge any automatic saved zones from previous sessions so user starts with a clean slate
    if (!localStorage.getItem(AUTO_ZONES_PURGED_FLAG)) {
      localStorage.setItem(AUTO_ZONES_PURGED_FLAG, 'true');
      localStorage.removeItem('smart_silent_zones');
      localStorage.removeItem('smart_silent_zones_v1');
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Filter out any automatic sample zones
        const userZones = parsed.filter((z) => {
          if (!z || typeof z !== 'object' || !z.name) return false;
          const id = String(z.id || '');
          if (id.startsWith('zone_sample_') || id === '1' || id === '2' || id === '3') return false;
          const name = String(z.name).toLowerCase();
          if (name.includes('library') || name.includes('sample') || name.includes('office')) {
            if (name === 'city central library' || name === 'city library annex' || name === 'downtown office' || name === 'main office hq') {
              return false;
            }
          }
          return true;
        });
        return userZones.map((z) => ({
          ...z,
          totalVisits: typeof z.totalVisits === 'number' ? z.totalVisits : 0,
          totalDurationSeconds: typeof z.totalDurationSeconds === 'number' 
            ? z.totalDurationSeconds 
            : 0,
        }));
      }
    }
  } catch {
    // Fall back to empty list
  }
  return [];
};

type AndroidNotification = {
  id: string;
  title: string;
  message: string;
  type: 'silent' | 'normal';
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'zones' | 'discover' | 'settings'>('home');
  const [zonesSubTab, setZonesSubTab] = useState<'list' | 'statistics'>('list');
  const [zones, setZones] = useState<Zone[]>(getStoredZones);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupModalTab, setBackupModalTab] = useState<'export' | 'import'>('export');
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [selectedMapsPlace, setSelectedMapsPlace] = useState<GroundedPlaceResult | null>(null);
  const [nearbySuggestedQuietSpot, setNearbySuggestedQuietSpot] = useState<GroundedPlaceResult | null>(null);
  const [dismissedSuggestedSpots, setDismissedSuggestedSpots] = useState<Set<string>>(new Set());
  const [realLocation, setRealLocation] = useState<Location | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedLocation, setSimulatedLocation] = useState<Location>(() => getStoredLastKnownLocation(getStoredZones()));
  const [error, setError] = useState<string | null>(null);
  const userManuallySimulatingRef = useRef(false);
  const [initialAnchorLocation, setInitialAnchorLocation] = useState<Location | null>(null);
  const [recentExitZone, setRecentExitZone] = useState<{ name: string; timestamp: number } | null>(null);
  
  // Exit Verification Grace Period (Anti-Drift Filter for Classroom / Indoor GPS Fluctuation)
  const [exitGraceSeconds, setExitGraceSeconds] = useState<number>(getStoredExitGraceSeconds);
  const [exitPendingZone, setExitPendingZone] = useState<Zone | null>(null);
  const [exitSecondsRemaining, setExitSecondsRemaining] = useState<number>(0);
  const exitTargetTimeRef = useRef<number | null>(null);

  // Indoor Classroom Anti-Drift Shield (Anchors coordinates & stabilizes GPS in class)
  const [classroomLockEnabled, setClassroomLockEnabled] = useState<boolean>(getStoredClassroomLockPref);
  const [classroomLockActive, setClassroomLockActive] = useState<boolean>(false);
  const [filterCoarseGps, setFilterCoarseGps] = useState<boolean>(getStoredFilterCoarseGps);

  // Settings
  const [autoDndEnabled, setAutoDndEnabled] = useState(true);
  const [soundFeedbackEnabled, setSoundFeedbackEnabled] = useState(true);
  const [headsUpAlertsEnabled, setHeadsUpAlertsEnabled] = useState(true);
  const [dwellTimeSeconds, setDwellTimeSeconds] = useState<number>(getStoredDwellTime);
  const [isDwellModalOpen, setIsDwellModalOpen] = useState(false);
  const [mapTheme, setMapTheme] = useState<MapTheme>(getStoredMapTheme);

  // Quick Mute (Instant Silence without geofence)
  const [quickMuteSession, setQuickMuteSession] = useState<QuickMuteSession | null>(getStoredQuickMuteSession);
  const [quickMuteSecondsRemaining, setQuickMuteSecondsRemaining] = useState<number>(() => {
    const session = getStoredQuickMuteSession();
    return session ? Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000)) : 0;
  });
  const [isQuickMuteModalOpen, setIsQuickMuteModalOpen] = useState(false);

  // GPS Accuracy History for Sparkline & Drift Diagnostics (Last 10 minutes)
  const [gpsAccuracyHistory, setGpsAccuracyHistory] = useState<GpsAccuracyPoint[]>(getInitialGpsHistory);

  // Emergency VIP & Repeat Callers Breakthrough
  const [emergencyConfig, setEmergencyConfig] = useState<EmergencyBypassConfig>(getStoredEmergencyConfig);
  const [incomingCallState, setIncomingCallState] = useState<{
    isOpen: boolean;
    caller: VipContact | null;
    isRepeatCaller: boolean;
  }>({ isOpen: false, caller: null, isRepeatCaller: false });

  // Background Firestore Sync & Built-in DND State
  const [pairingInfo] = useState<{ deviceId: string; pairingCode: string }>(getOrCreatePairingInfo);
  const [selectedSmartMode, setSelectedSmartMode] = useState<SmartZoneMode>('college');
  const [inbuiltApkMode] = useState<boolean>(() => isInbuiltApkEnvironment());
  const [inbuiltDndStatus, setInbuiltDndStatus] = useState<InbuiltDndStatus | null>(() => getInbuiltDndStatus());
  const [defaultRadiusMode, setDefaultRadiusMode] = useState<'silent' | 'vibrate'>(() => {
    try {
      const saved = localStorage.getItem('smart_silent_default_radius_mode_v1');
      if (saved === 'vibrate' || saved === 'silent') return saved;
    } catch {}
    return 'silent';
  });
  const hasAutoPromptedDndRef = useRef(false);

  // Refresh inbuilt Android NotificationManager DND status when running on Android WebView
  useEffect(() => {
    if (!inbuiltApkMode) return;
    const refreshInbuiltStatus = () => {
      setInbuiltDndStatus(getInbuiltDndStatus());
    };
    refreshInbuiltStatus();
    window.addEventListener('android-native-dnd-update', refreshInbuiltStatus);
    window.addEventListener('focus', refreshInbuiltStatus);
    return () => {
      window.removeEventListener('android-native-dnd-update', refreshInbuiltStatus);
      window.removeEventListener('focus', refreshInbuiltStatus);
    };
  }, [inbuiltApkMode]);

  // Keep emergency contacts & repeat-caller rules synced with inbuilt Call Receiver
  useEffect(() => {
    if (inbuiltApkMode) {
      syncEmergencyConfigToInbuiltApk(emergencyConfig);
    }
  }, [emergencyConfig, inbuiltApkMode]);

  // Direct DND Permission prompt (no extra app installations)
  const askDndPermissionDirect = () => {
    if (inbuiltApkMode) {
      requestInbuiltDndPermission();
      setTimeout(() => setInbuiltDndStatus(getInbuiltDndStatus()), 400);
      return;
    }
    const isAndroidBrowser = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    if (isAndroidBrowser) {
      try {
        window.location.href = 'intent:#Intent;action=android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS;end';
        return;
      } catch {}
    }
    setIsPhoneBridgeModalOpen(true);
  };

  // Initialize Firestore background sync cleanly
  useEffect(() => {
    testFirestoreConnection();
    initializeDeviceDocument(pairingInfo.deviceId, pairingInfo.pairingCode).catch((err) => {
      console.error('Device initialization failed:', err);
    });
  }, [pairingInfo.deviceId, pairingInfo.pairingCode]);

  // Synchronize zones to native geofencer & Firestore whenever zones list changes
  useEffect(() => {
    if (inbuiltApkMode) {
      syncZonesToInbuiltApk(zones);
    }
    if (!pairingInfo.deviceId) return;
    syncZonesToFirestore(pairingInfo.deviceId, zones).catch((err) => {
      console.error('Error syncing zones to Firestore:', err);
    });
  }, [zones, pairingInfo.deviceId, inbuiltApkMode]);

  // Physical Phone Hardware Bridge (Built-in DND & Vibration Sync)
  const [phoneBridgeConfig, setPhoneBridgeConfig] = useState<PhoneBridgeConfig>(getStoredPhoneBridgeConfig);
  const [isPhoneBridgeModalOpen, setIsPhoneBridgeModalOpen] = useState(false);
  const isFirstDndMountRef = useRef(true);

  // WiFi SSID Beacon Pairing (Indoor Geofencing)
  const [connectedWifiSsid, setConnectedWifiSsid] = useState<string>(getStoredWifiSsid);
  const [isWifiConnected, setIsWifiConnected] = useState<boolean>(true);

  // Sync Physical Phone Hardware (Built-in NotificationManager DND, Vibration Mode & Optional Webhook)
  const triggerPhoneHardwareSync = async (turnOn: boolean, zoneName?: string, silenceMode?: SilenceMode): Promise<boolean> => {
    const resolvedMode = silenceMode || defaultRadiusMode;

    // 1. Physical Device Haptic Vibration (distinct stronger pattern when Vibration Mode activates)
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        if (turnOn && resolvedMode === 'vibrate') {
          navigator.vibrate([220, 90, 220, 90, 220]);
        } else if (turnOn) {
          navigator.vibrate([120, 60, 120]);
        } else {
          navigator.vibrate([80]);
        }
      } catch {}
    }

    // 1b. Inbuilt Android NotificationManager DND / AudioManager Vibration (Zero extra apps)
    if (inbuiltApkMode) {
      const res = setInbuiltDndState(turnOn, resolvedMode, zoneName || 'Smart Silent Zone');
      setInbuiltDndStatus(getInbuiltDndStatus());
      if (res && res.granted) {
        return res.success && (turnOn ? res.dndActive : !res.dndActive);
      }
      if (turnOn && !hasAutoPromptedDndRef.current) {
        hasAutoPromptedDndRef.current = true;
        requestInbuiltDndPermission();
      } else if (headsUpAlertsEnabled) {
        setNotification({
          id: Date.now().toString(),
          title: 'Allow DND Permission',
          message: 'Allow Do Not Disturb access in Android Settings so your phone can switch DND / Vibration automatically.',
          type: 'normal',
        });
      }
      return false;
    }

    // 2. Automated Webhook Bridge (if configured)
    if (phoneBridgeConfig.enabled && phoneBridgeConfig.webhookUrl) {
      try {
        const targetUrl = new URL(phoneBridgeConfig.webhookUrl);
        targetUrl.searchParams.set('state', turnOn ? 'on' : 'off');
        targetUrl.searchParams.set('dnd', turnOn ? 'true' : 'false');
        targetUrl.searchParams.set('zone', zoneName || (turnOn ? 'Silent Zone' : 'Outside'));
        targetUrl.searchParams.set('mode', resolvedMode);

        await fetch(targetUrl.toString(), {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: turnOn ? 'DND_ACTIVATED' : 'DND_DEACTIVATED',
            state: turnOn ? 'on' : 'off',
            zone: zoneName || 'Smart Silent Zone',
            mode: resolvedMode,
            timestamp: Date.now(),
          }),
        });
        return true;
      } catch (err) {
        console.warn('Phone bridge webhook ping sent (or no-cors mode)', err);
        return true;
      }
    }

    return false;
  };

  const handleSavePhoneBridgeConfig = (updated: PhoneBridgeConfig) => {
    setPhoneBridgeConfig(updated);
    try {
      localStorage.setItem(PHONE_BRIDGE_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: updated.enabled ? 'Phone DND Sync Enabled' : 'Phone Sync Updated',
        message: updated.enabled 
          ? 'Automated phone hardware webhook bridge is now active.' 
          : 'Saved phone bridge configuration.',
        type: 'normal',
      });
    }
  };

  // Time-Based Global Schedule Override Settings
  const [timeOverride, setTimeOverride] = useState<TimeScheduleOverride>(getStoredTimeOverride);
  const [isScheduleActive, setIsScheduleActive] = useState<boolean>(() => isScheduleActiveNow(getStoredTimeOverride()));

  // Dwell Verification (Anti-Toggling Filter for brief pass-throughs)
  const [dwellPendingZone, setDwellPendingZone] = useState<Zone | null>(null);
  const [dwellSecondsRemaining, setDwellSecondsRemaining] = useState<number>(0);
  const dwellTargetTimeRef = useRef<number | null>(null);

  const [activeZone, setActiveZone] = useState<Zone | null>(null);

  // Active Location (Simulated or Real)
  const rawLocation = isSimulating ? simulatedLocation : realLocation;

  // Stabilized Location with Classroom Anti-Drift Shield
  const location = useMemo(() => {
    if (!rawLocation) return null;
    // When classroom lock is active and inside a zone, anchor coordinates to zone center to prevent indoor GPS jitter
    if (classroomLockActive && activeZone) {
      const dist = getDistance(rawLocation.lat, rawLocation.lng, activeZone.lat, activeZone.lng);
      if (dist <= activeZone.radius * 2.5) {
        return {
          lat: activeZone.lat,
          lng: activeZone.lng,
          accuracy: Math.min(rawLocation.accuracy || 10, 15),
        };
      }
    }
    return rawLocation;
  }, [rawLocation, classroomLockActive, activeZone]);

  const toggleClassroomLock = () => {
    setClassroomLockActive((prev) => {
      const next = !prev;
      if (headsUpAlertsEnabled) {
        setNotification({
          id: Date.now().toString(),
          title: next ? 'Classroom Shield Engaged' : 'Classroom Shield Disengaged',
          message: next
            ? 'GPS drift locked to classroom perimeter. Phone ringer stays protected.'
            : 'Classroom drift lock turned off. Standard GPS tracking active.',
          type: next ? 'silent' : 'normal',
        });
      }
      return next;
    });
  };

  // Set initial anchor when realLocation or initial simulatedLocation is available
  useEffect(() => {
    if (location && !initialAnchorLocation) {
      setInitialAnchorLocation(location);
    }
  }, [location, initialAnchorLocation]);

  // DND State
  const [isDndActive, setIsDndActive] = useState(() => {
    const initialSession = getStoredQuickMuteSession();
    if (initialSession && initialSession.active) return true;
    return isScheduleActiveNow(getStoredTimeOverride());
  });
  const [manualOverrideDndOff, setManualOverrideDndOff] = useState(false);
  const prevZoneRef = useRef<Zone | null>(null);
  const zoneEntryTimesRef = useRef<Record<string, number>>({});

  // Automatically trigger physical phone sync whenever DND state, active zone, or mode changes
  useEffect(() => {
    if (isFirstDndMountRef.current) {
      isFirstDndMountRef.current = false;
      return;
    }
    triggerPhoneHardwareSync(isDndActive, activeZone?.name, activeZone?.silenceMode || defaultRadiusMode);
  }, [isDndActive, activeZone?.id, activeZone?.silenceMode, defaultRadiusMode]);

  // Persist Map Theme setting
  useEffect(() => {
    try {
      localStorage.setItem(MAP_THEME_STORAGE_KEY, mapTheme);
    } catch (e) {
      console.error('Failed to save map theme', e);
    }
  }, [mapTheme]);

  // Track GPS accuracy history for sparkline and drift diagnostics
  useEffect(() => {
    if (!location) return;
    const now = Date.now();
    const newPoint: GpsAccuracyPoint = {
      timestamp: now,
      timeStr: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      accuracy: Math.round(location.accuracy || 8),
      lat: location.lat,
      lng: location.lng,
    };

    setGpsAccuracyHistory((prev) => {
      const tenMinsAgo = now - 10 * 60 * 1000;
      const filtered = prev.filter((p) => p.timestamp >= tenMinsAgo);
      const updated = [...filtered, newPoint];
      try {
        localStorage.setItem(GPS_ACCURACY_STORAGE_KEY, JSON.stringify(updated.slice(-35)));
      } catch {
        // ignore
      }
      return updated;
    });
  }, [location?.lat, location?.lng, location?.accuracy]);

  // Request fresh high-accuracy GPS fix to re-calibrate accuracy
  const refreshGpsFix = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const fresh = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setRealLocation(fresh);
          setIsSimulating(false);
          setNotification({
            id: Date.now().toString(),
            title: 'GPS Signal Calibrated',
            message: `Current accuracy fix: ±${Math.round(pos.coords.accuracy)}m. Drift analysis updated.`,
            type: 'normal',
          });
        },
        (err) => {
          setNotification({
            id: Date.now().toString(),
            title: 'GPS Calibration Failed',
            message: err.message,
            type: 'normal',
          });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setNotification({
        id: Date.now().toString(),
        title: 'GPS Unavailable',
        message: 'Browser geolocation is not available.',
        type: 'normal',
      });
    }
  };

  // Persist Time-Based Override settings
  useEffect(() => {
    try {
      localStorage.setItem(TIME_OVERRIDE_STORAGE_KEY, JSON.stringify(timeOverride));
    } catch (e) {
      console.error('Failed to save time override', e);
    }
  }, [timeOverride]);

  // Quick Mute countdown timer and storage sync
  useEffect(() => {
    if (!quickMuteSession?.active) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((quickMuteSession.expiresAt - Date.now()) / 1000));
      setQuickMuteSecondsRemaining(remaining);
      if (remaining <= 0) {
        endQuickMute(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [quickMuteSession]);

  useEffect(() => {
    try {
      if (quickMuteSession?.active) {
        localStorage.setItem(QUICK_MUTE_STORAGE_KEY, JSON.stringify(quickMuteSession));
      } else {
        localStorage.removeItem(QUICK_MUTE_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save quick mute session', e);
    }
  }, [quickMuteSession]);

  const formatDurationRemaining = (seconds: number): string => {
    if (seconds <= 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    }
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const startQuickMute = (minutes: number) => {
    const expiresAt = Date.now() + minutes * 60 * 1000;
    const session: QuickMuteSession = {
      active: true,
      durationMinutes: minutes,
      startedAt: Date.now(),
      expiresAt,
    };

    setQuickMuteSession(session);
    setQuickMuteSecondsRemaining(minutes * 60);
    setManualOverrideDndOff(false);
    setIsDndActive(true);
    setIsQuickMuteModalOpen(false);

    if (soundFeedbackEnabled) {
      playDndChime('silent');
    }

    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: 'Quick Mute Started',
        message: `Phone silenced for ${minutes} minutes (no geofence needed). Ringer restores automatically at ${new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        type: 'silent',
      });
    }

    setActivityLogs((prev) => [
      {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'enter',
        zoneName: 'Quick Mute',
        detail: `Silenced phone for ${minutes}m without geofence (ends at ${new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      },
      ...prev.slice(0, 9),
    ]);
  };

  const extendQuickMute = (extraMinutes: number) => {
    if (!quickMuteSession) return;
    const newExpiresAt = quickMuteSession.expiresAt + extraMinutes * 60 * 1000;
    const newTotalMinutes = quickMuteSession.durationMinutes + extraMinutes;

    const updatedSession: QuickMuteSession = {
      ...quickMuteSession,
      durationMinutes: newTotalMinutes,
      expiresAt: newExpiresAt,
    };

    setQuickMuteSession(updatedSession);
    setQuickMuteSecondsRemaining((prev) => prev + extraMinutes * 60);

    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: 'Quick Mute Extended',
        message: `Added +${extraMinutes} minutes. Silent mode extended until ${new Date(newExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        type: 'silent',
      });
    }
  };

  const endQuickMute = (isNaturalExpiry = false) => {
    setQuickMuteSession(null);
    setQuickMuteSecondsRemaining(0);

    // If still inside active geofence or schedule, keep DND on
    if (activeZone) {
      if (headsUpAlertsEnabled) {
        setNotification({
          id: Date.now().toString(),
          title: 'Quick Mute Finished',
          message: `Timer completed, but Do Not Disturb remains active because you are inside "${activeZone.name}".`,
          type: 'silent',
        });
      }
      return;
    }

    if (isScheduleActive && !manualOverrideDndOff) {
      if (headsUpAlertsEnabled) {
        setNotification({
          id: Date.now().toString(),
          title: 'Quick Mute Finished',
          message: 'Timer completed, but Do Not Disturb remains active due to Global Quiet Hours schedule.',
          type: 'silent',
        });
      }
      return;
    }

    setIsDndActive(false);

    if (soundFeedbackEnabled) {
      playDndChime('normal');
    }

    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: isNaturalExpiry ? 'Quick Mute Completed' : 'Quick Mute Cancelled',
        message: isNaturalExpiry 
          ? 'Quick Mute duration finished. Normal ringer mode restored automatically.' 
          : 'Quick Mute stopped early. Normal ringer mode restored.',
        type: 'normal',
      });
    }

    setActivityLogs((prev) => [
      {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'exit',
        zoneName: 'Quick Mute',
        detail: isNaturalExpiry 
          ? 'Timer expired naturally. Normal ringer restored.' 
          : 'User cancelled Quick Mute early. Normal ringer restored.',
      },
      ...prev.slice(0, 9),
    ]);
  };

  // Periodic engine to check global time schedule override
  useEffect(() => {
    const checkSchedule = () => {
      const active = isScheduleActiveNow(timeOverride, new Date());
      setIsScheduleActive((prev) => {
        if (prev !== active) {
          if (active) {
            // Schedule override engaged
            if (!manualOverrideDndOff) {
              setIsDndActive(true);
              if (soundFeedbackEnabled) {
                playDndChime('silent');
              }
              if (headsUpAlertsEnabled) {
                setNotification({
                  id: Date.now().toString(),
                  title: 'Overridden by Schedule',
                  message: `Global quiet hours active (${formatTimeTo12Hour(timeOverride.startTime)} – ${formatTimeTo12Hour(timeOverride.endTime)}). DND active regardless of location.`,
                  type: 'silent',
                });
              }
              setActivityLogs((curr) => [
                {
                  id: Date.now().toString(),
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  type: 'enter',
                  zoneName: 'Global Schedule',
                  detail: `Overridden by Schedule: DND locked ON (${formatTimeTo12Hour(timeOverride.startTime)} – ${formatTimeTo12Hour(timeOverride.endTime)}) regardless of location`,
                },
                ...curr.slice(0, 9),
              ]);
            }
          } else {
            // Schedule override ended
            if (!activeZone && autoDndEnabled) {
              setIsDndActive(false);
              if (soundFeedbackEnabled) {
                playDndChime('normal');
              }
              if (headsUpAlertsEnabled) {
                setNotification({
                  id: Date.now().toString(),
                  title: 'Schedule Override Ended',
                  message: 'Global quiet hours ended. Normal ringer restored outside zones.',
                  type: 'normal',
                });
              }
              setActivityLogs((curr) => [
                {
                  id: Date.now().toString(),
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  type: 'exit',
                  zoneName: 'Global Schedule',
                  detail: 'Quiet hours completed. Reverted to standard geofence automation',
                },
                ...curr.slice(0, 9),
              ]);
            }
          }
        }
        return active;
      });
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 1000);
    return () => clearInterval(interval);
  }, [timeOverride, soundFeedbackEnabled, headsUpAlertsEnabled, activeZone, autoDndEnabled, manualOverrideDndOff]);

  // Android Heads-Up Notification Banner
  const [notification, setNotification] = useState<AndroidNotification | null>(null);

  // Auto-DND Activity Logs
  const [activityLogs, setActivityLogs] = useState<DndEvent[]>([]);

  // Google Maps Quota Banner State (Case A Demo Key)
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Add Zone State
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState('100');
  const [newZoneSilenceMode, setNewZoneSilenceMode] = useState<SilenceMode>(defaultRadiusMode);
  const [newZoneWifiSsid, setNewZoneWifiSsid] = useState('');
  const [placementType, setPlacementType] = useState<'current' | 'ahead'>('current');
  const [customZoneCoords, setCustomZoneCoords] = useState<{ lat: number; lng: number } | null>(null);

  const handleUpdateEmergencyConfig = (updated: EmergencyBypassConfig) => {
    setEmergencyConfig(updated);
    try {
      localStorage.setItem(EMERGENCY_BYPASS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    if (inbuiltApkMode) {
      syncEmergencyConfigToInbuiltApk(updated);
    }
  };

  const handleToggleWifi = () => {
    setIsWifiConnected((prev) => {
      const next = !prev;
      if (headsUpAlertsEnabled) {
        setNotification({
          id: Date.now().toString(),
          title: next ? 'WiFi Beacon Connected' : 'WiFi Disconnected',
          message: next 
            ? `Connected to "${connectedWifiSsid}". Indoor geofencing active.` 
            : 'Disconnected from WiFi. Falling back to satellite GPS.',
          type: 'normal',
        });
      }
      return next;
    });
  };

  const triggerSimulateCall = (contact: VipContact, isRepeatCaller = false) => {
    if (inbuiltApkMode) {
      triggerInbuiltEmergencyTestRing(contact.name, contact.phone);
    }
    playDndChime('ring');
    setIncomingCallState({
      isOpen: true,
      caller: contact,
      isRepeatCaller,
    });
  };

  const handleSelectRadiusMode = (mode: 'silent' | 'vibrate') => {
    setDefaultRadiusMode(mode);
    setNewZoneSilenceMode(mode);
    try {
      localStorage.setItem('smart_silent_default_radius_mode_v1', mode);
    } catch {}

    if (activeZone) {
      const updatedActive = { ...activeZone, silenceMode: mode };
      setActiveZone(updatedActive);
      prevZoneRef.current = updatedActive;
      setZones((prev) =>
        prev.map((z) => (z.id === activeZone.id ? { ...z, silenceMode: mode } : z))
      );
      if (isDndActive) {
        triggerPhoneHardwareSync(true, activeZone.name, mode);
        if (soundFeedbackEnabled) {
          playDndChime(mode === 'vibrate' ? 'vibrate' : 'silent');
        }
      }
      if (headsUpAlertsEnabled) {
        setNotification({
          id: Date.now().toString(),
          title: mode === 'vibrate' ? 'Switched to Vibration Mode' : 'Switched to DND Mode',
          message: `"${activeZone.name}" will use ${mode === 'vibrate' ? 'Vibration Only' : 'Total Silence (DND)'}.`,
          type: 'silent',
        });
      }
    }
  };

  const cycleZoneSilenceMode = (zoneId: string) => {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id === zoneId) {
          const current = z.silenceMode || 'silent';
          const next: SilenceMode = current === 'silent' ? 'vibrate' : current === 'vibrate' ? 'priority' : 'silent';
          if (activeZone?.id === zoneId) {
            const updated = { ...z, silenceMode: next };
            setActiveZone(updated);
            prevZoneRef.current = updated;
          }
          if (headsUpAlertsEnabled) {
            setNotification({
              id: Date.now().toString(),
              title: `${z.name} Mode Updated`,
              message: `Switched to ${next === 'silent' ? 'DND Mode (Total Silence)' : next === 'vibrate' ? 'Vibration Mode' : 'Priority Only'}`,
              type: 'normal',
            });
          }
          return { ...z, silenceMode: next };
        }
        return z;
      })
    );
  };
  const [zoneSortBy, setZoneSortBy] = useState<'proximity' | 'name' | 'visits' | 'radius'>('proximity');
  const [zoneSortOrder, setZoneSortOrder] = useState<'asc' | 'desc'>('asc');

  // Edit Radius Quick Modal State
  const [editingRadiusZone, setEditingRadiusZone] = useState<Zone | null>(null);

  // Dynamically sorted zones based on user location & proximity (auto-refreshes as user moves)
  const sortedZones = useMemo(() => {
    const list = zones.map((zone) => {
      const distance = location ? getDistance(location.lat, location.lng, zone.lat, zone.lng) : null;
      const isInsideGps = distance !== null && distance <= zone.radius;
      const isInsideWifi = isWifiConnected && Boolean(zone.wifiSsid && connectedWifiSsid && zone.wifiSsid.toLowerCase() === connectedWifiSsid.toLowerCase());
      const isInside = isInsideGps || isInsideWifi;
      return {
        ...zone,
        distance,
        isInside,
      };
    });

    list.sort((a, b) => {
      if (zoneSortBy === 'proximity') {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return zoneSortOrder === 'asc' ? a.distance - b.distance : b.distance - a.distance;
      }
      if (zoneSortBy === 'name') {
        const cmp = a.name.localeCompare(b.name);
        return zoneSortOrder === 'asc' ? cmp : -cmp;
      }
      if (zoneSortBy === 'visits') {
        const vA = a.totalVisits ?? 0;
        const vB = b.totalVisits ?? 0;
        return zoneSortOrder === 'asc' ? vA - vB : vB - vA;
      }
      if (zoneSortBy === 'radius') {
        return zoneSortOrder === 'asc' ? a.radius - b.radius : b.radius - a.radius;
      }
      return 0;
    });

    return list;
  }, [zones, location?.lat, location?.lng, zoneSortBy, zoneSortOrder]);

  // Track user location with Indoor GPS Spike Filtering and Local Persistence
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser');
      setIsSimulating(true);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fresh: Location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };

        // Cache last known good fix to localStorage for instantaneous recovery
        try {
          localStorage.setItem(LAST_KNOWN_LOCATION_KEY, JSON.stringify(fresh));
        } catch {}

        // Indoor Noise Filter: if inside an active zone and filterCoarseGps is on,
        // ignore wild indoor spikes (e.g. coarse cell-tower triangulation with accuracy > 65m)
        if (filterCoarseGps && pos.coords.accuracy > 65 && activeZone) {
          const jumpDist = getDistance(fresh.lat, fresh.lng, activeZone.lat, activeZone.lng);
          if (jumpDist > activeZone.radius * 2) {
            console.log(`Suppressed coarse indoor GPS spike (±${Math.round(pos.coords.accuracy)}m, jump: ${Math.round(jumpDist)}m)`);
            return;
          }
        }

        setRealLocation(fresh);
        setError(null);
        // If user hasn't explicitly clicked to simulate, keep following real GPS
        if (!userManuallySimulatingRef.current) {
          setIsSimulating(false);
        }
      },
      (err) => {
        setError(err.message);
        // Retain previous location if GPS drops out inside thick walls
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeZone, filterCoarseGps]);

  // Dismiss notification automatically after 4.5s
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [notification]);

  // Confirm Final Zone Exit (Called after exit grace period or manual confirmation)
  const confirmZoneExit = (exitingZone: Zone) => {
    setExitPendingZone(null);
    exitTargetTimeRef.current = null;
    setExitSecondsRemaining(0);
    setClassroomLockActive(false);

    prevZoneRef.current = null;
    setActiveZone(null);
    setManualOverrideDndOff(false);

    setRecentExitZone({
      name: exitingZone.name,
      timestamp: Date.now(),
    });
    setTimeout(() => setRecentExitZone(null), 4000);

    const entryTime = zoneEntryTimesRef.current[exitingZone.id] || (Date.now() - 45000);
    const elapsed = Math.max(20, Math.round((Date.now() - entryTime) / 1000));
    delete zoneEntryTimesRef.current[exitingZone.id];

    setZones((curr) =>
      curr.map((z) =>
        z.id === exitingZone.id
          ? {
              ...z,
              totalDurationSeconds: (z.totalDurationSeconds ?? 0) + elapsed,
              lastEnteredAt: null,
            }
          : z
      )
    );

    if (autoDndEnabled) {
      if (quickMuteSession?.active) {
        setIsDndActive(true);
      } else if (isScheduleActive && !manualOverrideDndOff) {
        setIsDndActive(true);
      } else {
        setIsDndActive(false);
        if (soundFeedbackEnabled) {
          playDndChime('normal');
        }
        if (headsUpAlertsEnabled) {
          setNotification({
            id: Date.now().toString(),
            title: 'Normal Mode Restored',
            message: `Left "${exitingZone.name}". Do Not Disturb turned off automatically.`,
            type: 'normal',
          });
        }
        setActivityLogs((prev) => [
          {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'exit',
            zoneName: exitingZone.name,
            detail: `Exit verified (${exitGraceSeconds}s debounce): Normal ringer restored after leaving perimeter`,
          },
          ...prev.slice(0, 9),
        ]);
      }
    }
  };

  // Cancel Exit Grace Period (User is still in class / GPS bounced back)
  const cancelExitGrace = () => {
    if (exitPendingZone) {
      const zoneName = exitPendingZone.name;
      setExitPendingZone(null);
      exitTargetTimeRef.current = null;
      setExitSecondsRemaining(0);
      setClassroomLockActive(true);

      if (headsUpAlertsEnabled) {
        setNotification({
          id: Date.now().toString(),
          title: 'Classroom Shield Engaged',
          message: `Exit cancelled. Position re-anchored inside "${zoneName}". DND remains securely active.`,
          type: 'silent',
        });
      }

      setActivityLogs((prev) => [
        {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'enter',
          zoneName,
          detail: 'Indoor GPS drift absorbed: User confirmed still inside classroom perimeter',
        },
        ...prev.slice(0, 9),
      ]);
    }
  };

  // Live Exit Grace Countdown Interval Engine
  useEffect(() => {
    if (!exitPendingZone || !exitTargetTimeRef.current) return;

    const interval = setInterval(() => {
      if (!exitTargetTimeRef.current) return;
      const remainingMs = exitTargetTimeRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setExitSecondsRemaining(remainingSec);

      if (remainingSec <= 0) {
        clearInterval(interval);
        confirmZoneExit(exitPendingZone);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [exitPendingZone, autoDndEnabled, manualOverrideDndOff, soundFeedbackEnabled, headsUpAlertsEnabled, exitGraceSeconds]);

  // Core Geofencing & Automatic DND Engine with Hysteresis & Classroom Anti-Drift Guard
  useEffect(() => {
    if (!location) return;

    // Check if location falls inside any active geofence
    let foundActiveZone: Zone | null = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      if (!zone.enabled) continue;
      const distance = getDistance(location.lat, location.lng, zone.lat, zone.lng);

      // Hysteresis buffer: 25% extra cushion (20m - 50m) when already inside this zone
      const isCurrentlyActiveInThisZone = activeZone?.id === zone.id || prevZoneRef.current?.id === zone.id || exitPendingZone?.id === zone.id;
      const hysteresisBuffer = isCurrentlyActiveInThisZone ? Math.min(50, Math.max(20, zone.radius * 0.25)) : 0;
      
      // Accuracy cushion: account for indoor GPS uncertainty (±8m to ±30m)
      const accuracyCushion = Math.min(location.accuracy ? location.accuracy * 0.5 : 8, 30);
      const effectiveDistance = Math.max(0, distance - accuracyCushion);

      const isInsideGps = effectiveDistance <= (zone.radius + hysteresisBuffer);
      const isInsideWifi = isWifiConnected && Boolean(zone.wifiSsid && connectedWifiSsid && zone.wifiSsid.toLowerCase() === connectedWifiSsid.toLowerCase());
      
      // Classroom drift lock: if active and distance is within 2.5x radius, hold presence
      const isClassroomHold = classroomLockActive && isCurrentlyActiveInThisZone && distance <= zone.radius * 2.5;

      if ((isInsideGps || isInsideWifi || isClassroomHold) && distance < minDistance) {
        minDistance = distance;
        foundActiveZone = zone;
      }
    }

    const previousZone = prevZoneRef.current;

    if (foundActiveZone) {
      // INSIDE A GEOFENCED ZONE
      // If an exit grace countdown was active, cancel it immediately!
      if (exitPendingZone) {
        setExitPendingZone(null);
        exitTargetTimeRef.current = null;
        setExitSecondsRemaining(0);
      }

      const isNewZone = previousZone?.id !== foundActiveZone.id;
      prevZoneRef.current = foundActiveZone;
      setActiveZone(foundActiveZone);

      if (isNewZone) {
        // Reset manual override whenever entering a distinct zone
        setManualOverrideDndOff(false);

        // Auto-engage Classroom Anti-Drift Lock if enabled or zone is academic/quiet
        const isAcademic = /class|lecture|room|school|college|uni|study|lib|exam|lab/i.test(foundActiveZone.name);
        if (classroomLockEnabled || isAcademic) {
          setClassroomLockActive(true);
        }

        // If switching from another zone, finalize duration for previous zone
        if (previousZone && previousZone.id !== foundActiveZone.id) {
          const prevEntry = zoneEntryTimesRef.current[previousZone.id] || (Date.now() - 45000);
          const elapsed = Math.max(20, Math.round((Date.now() - prevEntry) / 1000));
          delete zoneEntryTimesRef.current[previousZone.id];

          setZones((curr) =>
            curr.map((z) =>
              z.id === previousZone.id
                ? {
                    ...z,
                    totalDurationSeconds: (z.totalDurationSeconds ?? 0) + elapsed,
                    lastEnteredAt: null,
                  }
                : z
            )
          );
        }

        // Check configurable Dwell Time delay before triggering DND
        if (autoDndEnabled && !manualOverrideDndOff) {
          if (dwellTimeSeconds > 0) {
            // Start Dwell Verification Delay to prevent pass-through toggles
            setDwellPendingZone(foundActiveZone);
            dwellTargetTimeRef.current = Date.now() + dwellTimeSeconds * 1000;
            setDwellSecondsRemaining(dwellTimeSeconds);

            if (headsUpAlertsEnabled) {
              setNotification({
                id: Date.now().toString(),
                title: 'Zone Entered: Verifying Dwell',
                message: `Entered "${foundActiveZone.name}". Waiting ${dwellTimeSeconds}s to ensure you stay before muting ringer.`,
                type: 'normal',
              });
            }

            setActivityLogs((prev) => [
              {
                id: Date.now().toString(),
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                type: 'enter',
                zoneName: foundActiveZone.name,
                detail: `Entered perimeter. Dwell filter started (${dwellTimeSeconds}s delay before DND triggers)`,
              },
              ...prev.slice(0, 9),
            ]);
          } else {
            // Dwell is 0 (Instant Mode) - Trigger immediately
            setDwellPendingZone(null);
            dwellTargetTimeRef.current = null;
            setDwellSecondsRemaining(0);

            const now = Date.now();
            zoneEntryTimesRef.current[foundActiveZone.id] = now;
            setZones((curr) =>
              curr.map((z) =>
                z.id === foundActiveZone.id
                  ? {
                      ...z,
                      totalVisits: (z.totalVisits ?? 0) + 1,
                      lastEnteredAt: now,
                    }
                  : z
              )
            );

            if (!isDndActive) {
              const zoneMode = foundActiveZone.silenceMode || defaultRadiusMode;
              setIsDndActive(true);

              if (zoneMode === 'vibrate' && 'vibrate' in navigator) {
                try { navigator.vibrate([220, 90, 220]); } catch {}
              }
              if (soundFeedbackEnabled) {
                playDndChime(zoneMode === 'vibrate' ? 'vibrate' : 'silent');
              }

              if (headsUpAlertsEnabled) {
                setNotification({
                  id: Date.now().toString(),
                  title: zoneMode === 'vibrate' ? 'Vibration Mode Switched ON' : 'DND Mode Switched ON',
                  message: `Entered "${foundActiveZone.name}" (${foundActiveZone.radius}m radius). Mobile switched to ${zoneMode === 'vibrate' ? 'Vibration Mode' : 'Do Not Disturb'}.`,
                  type: 'silent',
                });
              }

              setActivityLogs((prev) => [
                {
                  id: Date.now().toString(),
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  type: 'enter',
                  zoneName: foundActiveZone.name,
                  detail: zoneMode === 'vibrate'
                    ? 'Automatic Vibration Mode activated upon entering Google Maps radius'
                    : 'Automatic DND activated upon entering Google Maps radius',
                },
                ...prev.slice(0, 9),
              ]);
            }
          }
        }
      }
    } else {
      // OUTSIDE ALL ACTIVE ZONES
      const exitingZone = previousZone || activeZone || dwellPendingZone || exitPendingZone;

      // Check if exiting while dwell delay was in progress (PASS-THROUGH PREVENTED)
      if (dwellPendingZone) {
        const cancelledZone = dwellPendingZone;
        const dwellElapsed = dwellTargetTimeRef.current 
          ? Math.max(1, Math.round((Date.now() - (dwellTargetTimeRef.current - dwellTimeSeconds * 1000)) / 1000))
          : 0;

        setRecentExitZone({
          name: cancelledZone.name,
          timestamp: Date.now(),
        });
        setTimeout(() => setRecentExitZone(null), 4000);

        setDwellPendingZone(null);
        dwellTargetTimeRef.current = null;
        setDwellSecondsRemaining(0);

        if (headsUpAlertsEnabled) {
          setNotification({
            id: Date.now().toString(),
            title: 'Pass-Through Filtered',
            message: `Left "${cancelledZone.name}" before ${dwellTimeSeconds}s dwell delay completed (${dwellElapsed}s inside). DND was not toggled.`,
            type: 'normal',
          });
        }

        setActivityLogs((prev) => [
          {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'exit',
            zoneName: cancelledZone.name,
            detail: `Pass-through prevented (${dwellElapsed}s < ${dwellTimeSeconds}s dwell delay). Ringer was never toggled.`,
          },
          ...prev.slice(0, 9),
        ]);
        return;
      }

      // If we were inside an active zone and just drifted outside:
      if (activeZone || previousZone) {
        const zoneToVerify = activeZone || previousZone;

        // If classroom lock is on and we are within 250m, hold the zone (absorb indoor drift)
        if (classroomLockActive && minDistance < 250) {
          return;
        }

        // If exit grace period is enabled (> 0) and not yet started:
        if (exitGraceSeconds > 0 && (!exitPendingZone || exitPendingZone.id !== zoneToVerify.id)) {
          setExitPendingZone(zoneToVerify);
          exitTargetTimeRef.current = Date.now() + exitGraceSeconds * 1000;
          setExitSecondsRemaining(exitGraceSeconds);

          if (headsUpAlertsEnabled) {
            setNotification({
              id: Date.now().toString(),
              title: 'Verifying Zone Exit',
              message: `GPS drifted outside "${zoneToVerify.name}". Verifying for ${exitGraceSeconds}s to protect against indoor drift. DND remains active.`,
              type: 'silent',
            });
          }

          setActivityLogs((prev) => [
            {
              id: Date.now().toString(),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              type: 'exit',
              zoneName: zoneToVerify.name,
              detail: `GPS coordinates fluctuated outside perimeter. Exit grace period started (${exitGraceSeconds}s verification before unmuting)`,
            },
            ...prev.slice(0, 9),
          ]);
          return; // KEEP DND ON! Do not proceed to deactivation!
        }

        // If already in exit grace period and countdown hasn't finished:
        if (exitPendingZone && exitSecondsRemaining > 0) {
          return; // Still waiting for countdown
        }
      }

      // If exit grace period is 0 or finished, finalize exit
      if (exitingZone && (isDndActive || activeZone !== null || previousZone !== null)) {
        confirmZoneExit(exitingZone);
      }
    }
  }, [
    location,
    zones,
    autoDndEnabled,
    soundFeedbackEnabled,
    headsUpAlertsEnabled,
    isDndActive,
    activeZone,
    manualOverrideDndOff,
    dwellTimeSeconds,
    dwellPendingZone,
    isScheduleActive,
    timeOverride,
    classroomLockActive,
    classroomLockEnabled,
    exitGraceSeconds,
    exitPendingZone,
    exitSecondsRemaining,
  ]);

  // Live Dwell Countdown Interval Engine
  useEffect(() => {
    if (!dwellPendingZone || !dwellTargetTimeRef.current) return;

    const interval = setInterval(() => {
      if (!dwellTargetTimeRef.current) return;
      const remainingMs = dwellTargetTimeRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setDwellSecondsRemaining(remainingSec);

      if (remainingSec <= 0) {
        clearInterval(interval);
        const zoneToActivate = dwellPendingZone;
        dwellTargetTimeRef.current = null;
        setDwellPendingZone(null);
        setDwellSecondsRemaining(0);

        // Verify that the user is still physically inside this zone and auto-DND is allowed
        if (prevZoneRef.current?.id === zoneToActivate.id && autoDndEnabled && !manualOverrideDndOff) {
          const now = Date.now();
          zoneEntryTimesRef.current[zoneToActivate.id] = now;
          setZones((curr) =>
            curr.map((z) =>
              z.id === zoneToActivate.id
                ? {
                    ...z,
                    totalVisits: (z.totalVisits ?? 0) + 1,
                    lastEnteredAt: now,
                  }
                : z
            )
          );

          const zoneMode = zoneToActivate.silenceMode || defaultRadiusMode;
          setIsDndActive(true);

          if (zoneMode === 'vibrate' && 'vibrate' in navigator) {
            try { navigator.vibrate([220, 90, 220]); } catch {}
          }
          if (soundFeedbackEnabled) {
            playDndChime(zoneMode === 'vibrate' ? 'vibrate' : 'silent');
          }

          if (headsUpAlertsEnabled) {
            setNotification({
              id: Date.now().toString(),
              title: zoneMode === 'vibrate' ? 'Vibration Mode Switched ON' : 'DND Mode Switched ON',
              message: `Reached "${zoneToActivate.name}" (${dwellTimeSeconds}s dwell verified). Switched to ${zoneMode === 'vibrate' ? 'Vibration Mode' : 'Do Not Disturb'}.`,
              type: 'silent',
            });
          }

          setActivityLogs((prev) => [
            {
              id: Date.now().toString(),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              type: 'enter',
              zoneName: zoneToActivate.name,
              detail: zoneMode === 'vibrate'
                ? `Dwell verified (${dwellTimeSeconds}s): Vibration Mode switched ON`
                : `Dwell verified (${dwellTimeSeconds}s): Automatic DND switched ON`,
            },
            ...prev.slice(0, 9),
          ]);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [
    dwellPendingZone, 
    autoDndEnabled, 
    manualOverrideDndOff, 
    soundFeedbackEnabled, 
    headsUpAlertsEnabled, 
    dwellTimeSeconds
  ]);

  const handleUpdateDwellTime = (newDwell: number) => {
    const clamped = Math.max(0, Math.min(60, Math.round(newDwell)));
    setDwellTimeSeconds(clamped);
    try {
      localStorage.setItem(DWELL_TIME_STORAGE_KEY, String(clamped));
    } catch {
      // Ignore storage errors
    }
    setIsDwellModalOpen(false);

    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: 'Dwell Delay Updated',
        message: clamped === 0 
          ? 'Dwell delay disabled. DND engages immediately upon entering a zone.' 
          : `Entry dwell delay set to ${clamped}s to prevent brief pass-through toggling.`,
        type: 'normal',
      });
    }
  };

  const handleUpdateExitGrace = (seconds: number) => {
    const clamped = Math.max(0, Math.min(60, Math.round(seconds)));
    setExitGraceSeconds(clamped);
    try {
      localStorage.setItem(EXIT_GRACE_STORAGE_KEY, String(clamped));
    } catch {}
    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: 'Exit Grace Period Updated',
        message: clamped === 0
          ? 'Instant exit enabled. Unmutes immediately when leaving perimeter.'
          : `Exit grace set to ${clamped}s. Indoor GPS drift won't accidentally unmute phone.`,
        type: 'normal',
      });
    }
  };

  const handleToggleClassroomLockPref = (enabled: boolean) => {
    setClassroomLockEnabled(enabled);
    try {
      localStorage.setItem(CLASSROOM_LOCK_STORAGE_KEY, String(enabled));
    } catch {}
    if (!enabled) {
      setClassroomLockActive(false);
    }
  };

  const handleToggleFilterCoarseGps = (filter: boolean) => {
    setFilterCoarseGps(filter);
    try {
      localStorage.setItem(FILTER_COARSE_GPS_STORAGE_KEY, String(filter));
    } catch {}
  };

  const handleSkipDwellDelay = () => {
    if (!dwellPendingZone) return;
    const zoneToActivate = dwellPendingZone;
    dwellTargetTimeRef.current = null;
    setDwellPendingZone(null);
    setDwellSecondsRemaining(0);

    const now = Date.now();
    zoneEntryTimesRef.current[zoneToActivate.id] = now;
    setZones((curr) =>
      curr.map((z) =>
        z.id === zoneToActivate.id
          ? {
              ...z,
              totalVisits: (z.totalVisits ?? 0) + 1,
              lastEnteredAt: now,
            }
          : z
      )
    );

    const zoneMode = zoneToActivate.silenceMode || defaultRadiusMode;
    setIsDndActive(true);
    if (zoneMode === 'vibrate' && 'vibrate' in navigator) {
      try { navigator.vibrate([220, 90, 220]); } catch {}
    }
    if (soundFeedbackEnabled) {
      playDndChime(zoneMode === 'vibrate' ? 'vibrate' : 'silent');
    }
    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: zoneMode === 'vibrate' ? 'Vibration Mode Switched ON' : 'DND Mode Switched ON',
        message: `Dwell bypassed: ${zoneMode === 'vibrate' ? 'Vibration Mode' : 'Silent Mode'} activated inside "${zoneToActivate.name}".`,
        type: 'silent',
      });
    }
    setActivityLogs((prev) => [
      {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'enter',
        zoneName: zoneToActivate.name,
        detail: `Manual skip: ${zoneMode === 'vibrate' ? 'Vibration Mode' : 'DND'} activated immediately`,
      },
      ...prev.slice(0, 9),
    ]);
  };

  const toggleZone = (id: string) => {
    setZones(zones.map(z => z.id === id ? { ...z, enabled: !z.enabled } : z));
  };

  const deleteZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
  };

  const handleUpdateZoneRadius = (zoneId: string, newRadius: number) => {
    const clampedRadius = Math.max(10, Math.min(5000, Math.round(newRadius)));
    setZones(prev => prev.map(z => z.id === zoneId ? { ...z, radius: clampedRadius } : z));
    
    const target = zones.find(z => z.id === zoneId);
    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: 'Perimeter Radius Updated',
        message: `${target?.name || 'Silent Zone'} perimeter set to ${clampedRadius}m.`,
        type: 'normal',
      });
    }
  };

  // Persist zones to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
    } catch {
      // Ignore storage errors
    }
  }, [zones]);

  const handleImportZones = (importedZones: Zone[], mode: 'merge' | 'replace') => {
    if (mode === 'replace') {
      setZones(importedZones);
    } else {
      const existingIds = new Set(zones.map((z) => z.id));
      const merged = [...zones];
      importedZones.forEach((z, idx) => {
        let id = z.id;
        if (!id || existingIds.has(id)) {
          id = `zone_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
        }
        existingIds.add(id);
        merged.push({ ...z, id });
      });
      setZones(merged);
    }

    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: 'Silent Zones Imported',
        message: `${importedZones.length} quiet location${importedZones.length === 1 ? '' : 's'} ${
          mode === 'replace' ? 'replaced all existing zones' : 'merged into saved list'
        }.`,
        type: 'normal',
      });
    }
  };

  const handleAddZoneFromDiscoveredPlace = (place: GroundedPlaceResult | {
    name: string;
    lat: number;
    lng: number;
    radius: number;
    silenceMode: SilenceMode;
    mapsMetadata: MapsGroundingMetadata;
  }) => {
    const silenceMode: SilenceMode = 'silenceMode' in place ? place.silenceMode : (place.quietnessRating === 'whisper' ? 'vibrate' : 'silent');
    const radius = 'radius' in place ? place.radius : (place.recommendedRadius || 100);
    const mapsMetadata: MapsGroundingMetadata = 'mapsMetadata' in place ? place.mapsMetadata : {
      formattedAddress: place.formattedAddress,
      operatingHours: place.operatingHours,
      isOpenNow: place.isOpenNow,
      quietnessRating: place.quietnessRating,
      quietnessSummary: place.quietnessSummary,
      googleMapsUrl: place.googleMapsUrl,
      placeCategory: place.placeCategory,
    };

    const newZone: Zone = {
      id: `zone_maps_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      radius,
      enabled: true,
      silenceMode,
      mapsMetadata,
      totalVisits: 0,
      totalDurationSeconds: 0,
      lastEnteredAt: null,
    };

    setZones((prev) => [...prev, newZone]);
    setNearbySuggestedQuietSpot(null);

    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: 'Google Maps Zone Added',
        message: `"${place.name}" (${mapsMetadata.operatingHours || 'Verified'}) is now monitored.`,
        type: 'normal',
      });
    }
  };

  const handleAddZone = () => {
    if (!location || !newZoneName.trim()) return;

    // Use map-picked pin first, then Google Maps searched place, then placement offset
    const targetLat = customZoneCoords
      ? customZoneCoords.lat
      : selectedMapsPlace
      ? selectedMapsPlace.lat
      : placementType === 'ahead'
      ? location.lat + 0.0022
      : location.lat;
    const targetLng = customZoneCoords
      ? customZoneCoords.lng
      : selectedMapsPlace
      ? selectedMapsPlace.lng
      : placementType === 'ahead'
      ? location.lng + 0.0022
      : location.lng;
    
    const newZone: Zone = {
      id: Date.now().toString(),
      name: newZoneName.trim(),
      lat: targetLat,
      lng: targetLng,
      radius: parseInt(newZoneRadius) || (selectedMapsPlace?.recommendedRadius || 100),
      enabled: true,
      mode: selectedSmartMode,
      silenceMode: newZoneSilenceMode,
      wifiSsid: newZoneWifiSsid.trim() || undefined,
      mapsMetadata: selectedMapsPlace ? {
        formattedAddress: selectedMapsPlace.formattedAddress,
        operatingHours: selectedMapsPlace.operatingHours,
        isOpenNow: selectedMapsPlace.isOpenNow,
        quietnessRating: selectedMapsPlace.quietnessRating,
        quietnessSummary: selectedMapsPlace.quietnessSummary,
        googleMapsUrl: selectedMapsPlace.googleMapsUrl,
        placeCategory: selectedMapsPlace.placeCategory,
      } : undefined,
      totalVisits: 0,
      totalDurationSeconds: 0,
      lastEnteredAt: null,
    };
    
    setZones([...zones, newZone]);
    setIsAddingZone(false);
    setNewZoneName('');
    setSelectedMapsPlace(null);
    setCustomZoneCoords(null);
    setNewZoneSilenceMode(defaultRadiusMode);
    setNewZoneWifiSsid('');
    setPlacementType('current');

    if (headsUpAlertsEnabled) {
      setNotification({
        id: Date.now().toString(),
        title: 'Silent Zone Added & Synced',
        message: `"${newZone.name}" (${newZone.radius}m) saved and pushed to Android phone.`,
        type: 'normal',
      });
    }
  };

  // Automated Quiet Zone Scanning via Google Maps Grounding as user moves
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const dismissedRef = useRef(dismissedSuggestedSpots);
  dismissedRef.current = dismissedSuggestedSpots;
  const lastScannedGpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastScanTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (!location) return;
    try {
      const autoScan = localStorage.getItem('smart_silent_auto_scan_maps') !== 'false';
      if (!autoScan) return;
    } catch {}

    const now = Date.now();
    // Throttle to at most once every 45 seconds to preserve rate limits
    if (now - lastScanTimestampRef.current < 45000) {
      return;
    }

    if (lastScannedGpsRef.current) {
      const dist = getDistance(location.lat, location.lng, lastScannedGpsRef.current.lat, lastScannedGpsRef.current.lng);
      if (dist < 350) return;
    }

    lastScannedGpsRef.current = { lat: location.lat, lng: location.lng };
    lastScanTimestampRef.current = now;

    const scanQuietZones = async () => {
      try {
        const res = await fetch('/api/maps/nearby-quiet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: location.lat, lng: location.lng }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.places) && data.places.length > 0) {
          const candidate = data.places.find((p: GroundedPlaceResult) => {
            if (dismissedRef.current.has(p.name)) return false;
            const isAdded = zonesRef.current.some((z) => {
              if (z.name.toLowerCase() === p.name.toLowerCase()) return true;
              return getDistance(z.lat, z.lng, p.lat, p.lng) < 50;
            });
            if (isAdded) return false;
            const dist = getDistance(location.lat, location.lng, p.lat, p.lng);
            return dist <= 350;
          });
          if (candidate) {
            setNearbySuggestedQuietSpot(candidate);
          }
        }
      } catch {
        // Silently handle any offline / network errors
      }
    };

    const timer = setTimeout(scanQuietZones, 2000);
    return () => clearTimeout(timer);
  }, [location?.lat, location?.lng]);

  const moveLocationTo = (lat: number, lng: number) => {
    userManuallySimulatingRef.current = true;
    setIsSimulating(true);
    setSimulatedLocation({ lat, lng, accuracy: 10 });
  };

  const stepLocation = (dxMeters: number, dyMeters: number) => {
    userManuallySimulatingRef.current = true;
    const cur = location || { lat: 37.7750, lng: -122.4194 };
    const latRad = (cur.lat * Math.PI) / 180;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(latRad);

    const targetLat = cur.lat + (dyMeters / metersPerDegreeLat);
    const targetLng = cur.lng + (dxMeters / metersPerDegreeLng);
    moveLocationTo(targetLat, targetLng);
  };

  const resetToRealGpsLocation = () => {
    userManuallySimulatingRef.current = false;
    if (realLocation) {
      setIsSimulating(false);
      setSimulatedLocation(realLocation);
    } else if (initialAnchorLocation) {
      setSimulatedLocation(initialAnchorLocation);
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const fresh = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setRealLocation(fresh);
          setIsSimulating(false);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    setNotification({
      id: Date.now().toString(),
      title: 'Location Reset',
      message: 'Returned back to your home/GPS location.',
      type: 'normal',
    });
  };

  const jumpToZone = (lat: number, lng: number) => {
    moveLocationTo(lat, lng);
  };

  const toggleManualDnd = () => {
    // If a dwell timer was currently pending, cancel it on manual user interaction
    if (dwellPendingZone) {
      setDwellPendingZone(null);
      dwellTargetTimeRef.current = null;
      setDwellSecondsRemaining(0);
    }

    // If Quick Mute is currently active, cancel it on manual unmute
    if (quickMuteSession?.active && isDndActive) {
      endQuickMute(false);
      return;
    }

    if (isDndActive) {
      // Turn DND off
      setIsDndActive(false);
      if (activeZone || isScheduleActive) {
        setManualOverrideDndOff(true);
      }
      if (soundFeedbackEnabled) {
        playDndChime('normal');
      }
      if (headsUpAlertsEnabled) {
        setNotification({
          id: Date.now().toString(),
          title: 'Normal Mode Restored',
          message: isScheduleActive
            ? 'Manual override: Paused schedule override; ringer restored.'
            : activeZone 
            ? `Manual override: DND turned off inside ${activeZone.name}.` 
            : 'Do Not Disturb deactivated manually.',
          type: 'normal',
        });
      }
      setActivityLogs((prev) => [
        {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'exit',
          zoneName: isScheduleActive ? 'Global Schedule' : (activeZone?.name || 'Manual Override'),
          detail: isScheduleActive 
            ? 'Manual override: DND paused while schedule was active' 
            : 'DND deactivated manually by user',
        },
        ...prev.slice(0, 9),
      ]);
    } else {
      // Turn DND / Vibration on
      const targetMode = activeZone?.silenceMode || defaultRadiusMode;
      setIsDndActive(true);
      setManualOverrideDndOff(false);
      if (soundFeedbackEnabled) {
        playDndChime(targetMode === 'vibrate' ? 'vibrate' : 'silent');
      }
      if (headsUpAlertsEnabled) {
        setNotification({
          id: Date.now().toString(),
          title: targetMode === 'vibrate' ? 'Vibration Mode Switched On' : 'Do Not Disturb Turned On',
          message: isScheduleActive 
            ? `Silent mode engaged (Overridden by Schedule ${formatTimeTo12Hour(timeOverride.startTime)} - ${formatTimeTo12Hour(timeOverride.endTime)}).` 
            : `${targetMode === 'vibrate' ? 'Vibration mode' : 'Silent mode'} activated manually.`,
          type: 'silent',
        });
      }
      setActivityLogs((prev) => [
        {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'enter',
          zoneName: isScheduleActive ? 'Global Schedule' : (activeZone?.name || 'Manual Control'),
          detail: isScheduleActive 
            ? 'DND reactivated (Schedule override resumed)' 
            : `${targetMode === 'vibrate' ? 'Vibration mode' : 'DND'} activated manually by user`,
        },
        ...prev.slice(0, 9),
      ]);
    }
  };

  // Simulated Android Status Bar
  const AndroidStatusBar = () => (
    <div className="bg-slate-900 text-white px-4 py-1.5 flex justify-between items-center text-xs font-medium z-40 relative select-none">
      <div>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="flex items-center gap-2">
        {quickMuteSession?.active && (
          <span className="flex items-center gap-1 bg-amber-500/40 text-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold animate-pulse border border-amber-400/40">
            <Zap size={10} className="fill-current text-amber-300" /> MUTE {Math.ceil(quickMuteSecondsRemaining / 60)}m
          </span>
        )}
        {isScheduleActive && (
          <span className="flex items-center gap-1 bg-purple-500/40 text-purple-200 px-1.5 py-0.5 rounded text-[10px] font-semibold animate-pulse border border-purple-400/40">
            <Moon size={10} /> SCHEDULE DND
          </span>
        )}
        {dwellPendingZone && !isScheduleActive && (
          <span className="flex items-center gap-1 bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-semibold animate-pulse">
            <Timer size={10} /> {dwellSecondsRemaining}s DWELL
          </span>
        )}
        {isDndActive && !isScheduleActive && (
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
            activeZone?.silenceMode === 'vibrate'
              ? 'bg-amber-500/30 text-amber-300'
              : activeZone?.silenceMode === 'priority'
              ? 'bg-purple-500/30 text-purple-200'
              : 'bg-indigo-500/30 text-indigo-300'
          }`}>
            {activeZone?.silenceMode === 'vibrate' ? (
              <><Vibrate size={11} /> VIBRATE</>
            ) : activeZone?.silenceMode === 'priority' ? (
              <><Star size={11} className="fill-purple-300" /> PRIORITY</>
            ) : (
              <><BellOff size={11} /> DND</>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={handleToggleWifi}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
            isWifiConnected ? 'text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30' : 'text-slate-400 bg-slate-800'
          }`}
          title={isWifiConnected ? `WiFi: Connected to ${connectedWifiSsid} (Click to toggle)` : 'WiFi disconnected (Click to connect)'}
        >
          {isWifiConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
          <span className="text-[9px] max-w-[60px] truncate">{isWifiConnected ? connectedWifiSsid : 'Off'}</span>
        </button>
        <Signal size={13} />
        <Battery size={13} />
      </div>
    </div>
  );

  return (
    <MapsProviderWrapper>
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans antialiased select-none">
        {mapsQuotaExceeded && (
          <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        <div className="w-full flex-1 flex items-center justify-center p-2 sm:p-4">
          {/* Mobile Device Mockup Container */}
          <div className="w-full max-w-[410px] h-[860px] max-h-[96vh] bg-slate-50 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative ring-8 ring-slate-900 border border-slate-800">
            <AndroidStatusBar />

        {/* Android Heads-Up Notification Banner */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -45, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -35, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute top-8 left-3 right-3 z-50 bg-slate-900/95 text-white backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-slate-700/80"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${notification.type === 'silent' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                  {notification.type === 'silent' ? <BellOff size={18} /> : <Bell size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Radio size={10} className="text-indigo-400 animate-pulse" />
                      Smart Silent • Automatic
                    </span>
                    <span className="text-[10px] text-slate-500">Just now</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-0.5">{notification.title}</p>
                  <p className="text-[11px] text-slate-300 leading-snug mt-0.5">{notification.message}</p>
                </div>
                <button 
                  onClick={() => setNotification(null)} 
                  className="text-slate-400 hover:text-white p-1 -mr-1 -mt-1 transition"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* App Header */}
        <header className="bg-white px-6 pt-5 pb-3.5 shadow-sm z-10 flex items-center justify-between border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Smart Silent Zone</h1>
              <span className={`w-2 h-2 rounded-full ${autoDndEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Automatic DND Geofencing</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isScheduleActive
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : isDndActive 
                ? (activeZone?.silenceMode || defaultRadiusMode) === 'vibrate'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-indigo-100 text-indigo-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {isScheduleActive ? (
                <>
                  <Moon size={13} className="text-purple-600 animate-pulse" />
                  <span>Overridden by Schedule</span>
                </>
              ) : isDndActive ? (
                (activeZone?.silenceMode || defaultRadiusMode) === 'vibrate' ? (
                  <>
                    <Vibrate size={13} />
                    <span>Vibrate</span>
                  </>
                ) : (
                  <>
                    <VolumeX size={13} />
                    <span>DND</span>
                  </>
                )
              ) : (
                <>
                  <Volume2 size={13} />
                  <span>Ringer</span>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 pb-24 relative">
          <AnimatePresence mode="wait">
            
            {/* HOME TAB */}
            {activeTab === 'home' && !isAddingZone && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                className="p-5 flex flex-col items-center"
              >
                {/* Main Visual Status Orb */}
                <div className="relative mt-3 mb-4 flex flex-col items-center">
                  {/* Expanding state change ripple wave */}
                  <motion.div
                    key={isScheduleActive ? 'schedule-wave' : isDndActive ? 'dnd-on-wave' : 'dnd-off-wave'}
                    initial={{ scale: 0.85, opacity: 0.8 }}
                    animate={{ scale: 1.45, opacity: 0 }}
                    transition={{ duration: 0.75, ease: 'easeOut' }}
                    className={`absolute inset-0 rounded-full border-2 pointer-events-none ${
                      isScheduleActive
                        ? 'border-purple-400'
                        : isDndActive
                        ? 'border-indigo-400'
                        : 'border-emerald-400'
                    }`}
                  />

                  <motion.div 
                    animate={{ 
                      scale: isDndActive ? [1, 1.08, 1] : 1,
                      opacity: isDndActive ? [0.45, 0.75, 0.45] : 0.2
                    }}
                    transition={{ repeat: Infinity, duration: 2.4 }}
                    className={`absolute inset-0 rounded-full ${
                      isScheduleActive 
                        ? 'bg-purple-600' 
                        : isDndActive 
                        ? 'bg-indigo-500' 
                        : 'bg-emerald-400'
                    } blur-2xl pointer-events-none`}
                  />
                  
                    <button
                    id="main-dnd-toggle-orb"
                    type="button"
                    onClick={toggleManualDnd}
                    className={`relative w-44 h-44 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all duration-300 cursor-pointer active:scale-95 focus:outline-none focus:ring-4 focus:ring-indigo-300 text-center px-2 ${
                      isScheduleActive
                        ? 'bg-gradient-to-br from-purple-700 via-indigo-800 to-slate-900 hover:from-purple-600 hover:to-indigo-700'
                        : isDndActive 
                        ? (activeZone?.silenceMode || defaultRadiusMode) === 'vibrate'
                          ? 'bg-gradient-to-br from-amber-600 via-orange-700 to-slate-900 hover:from-amber-500 hover:to-orange-600'
                          : activeZone?.silenceMode === 'priority'
                          ? 'bg-gradient-to-br from-purple-600 via-indigo-700 to-slate-900 hover:from-purple-500 hover:to-indigo-600'
                          : 'bg-gradient-to-br from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700' 
                        : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500'
                    }`}
                    title="Tap to toggle Do Not Disturb / Vibration manually"
                  >
                    <motion.div
                      key={isScheduleActive ? 'schedule' : isDndActive ? (activeZone?.silenceMode || defaultRadiusMode) : 'normal'}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25 }}
                      className="flex flex-col items-center select-none"
                    >
                      {isScheduleActive ? (
                        <Moon size={42} className="mb-1.5 drop-shadow text-purple-200" />
                      ) : isDndActive ? (
                        (activeZone?.silenceMode || defaultRadiusMode) === 'vibrate' ? (
                          <Vibrate size={42} className="mb-1.5 drop-shadow text-amber-200 animate-pulse" />
                        ) : activeZone?.silenceMode === 'priority' ? (
                          <Star size={42} className="mb-1.5 drop-shadow text-amber-300 fill-amber-300 animate-pulse" />
                        ) : (
                          <BellOff size={44} className="mb-1.5 drop-shadow" />
                        )
                      ) : (
                        <Bell size={44} className="mb-1.5 drop-shadow" />
                      )}
                      <span className="font-bold text-lg tracking-wide leading-tight text-center">
                        {isScheduleActive
                          ? 'Overridden by Schedule'
                          : isDndActive
                          ? (activeZone?.silenceMode || defaultRadiusMode) === 'vibrate'
                            ? 'Vibration Mode'
                            : activeZone?.silenceMode === 'priority'
                            ? 'Priority Mode'
                            : 'DND Mode'
                          : 'Normal Mode'}
                      </span>
                      <span className="text-[11px] opacity-90 font-medium leading-tight mt-0.5 max-w-[155px] text-center">
                        {isScheduleActive 
                          ? `${formatTimeTo12Hour(timeOverride.startTime)} – ${formatTimeTo12Hour(timeOverride.endTime)} • DND Locked ON` 
                          : isDndActive 
                          ? (activeZone?.silenceMode || defaultRadiusMode) === 'vibrate'
                            ? activeZone ? `Vibration ON in ${activeZone.name}` : 'Vibration ON'
                            : activeZone?.silenceMode === 'priority'
                            ? `Alarms & VIP allowed in ${activeZone?.name || 'zone'}`
                            : 'Do Not Disturb ON'
                          : 'Ringer Restored'}
                      </span>
                    </motion.div>
                  </button>

                  <span className="text-[10px] text-slate-400 font-medium mt-2 flex items-center gap-1 select-none">
                    {quickMuteSession?.active
                      ? `Quick Mute: ${formatDurationRemaining(quickMuteSecondsRemaining)} remaining`
                      : isScheduleActive 
                      ? `Quiet hours: ${formatTimeTo12Hour(timeOverride.startTime)} – ${formatTimeTo12Hour(timeOverride.endTime)}`
                      : 'Tap orb to manually toggle DND'}
                  </span>
                </div>

                {/* Radius Entry Mode Switcher (DND Mode or Vibration Mode) */}
                <div className="w-full bg-white rounded-2xl p-3 shadow-sm border border-slate-200/90 mb-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-700">
                      On Reaching Location Radius
                    </span>
                    <button
                      type="button"
                      onClick={askDndPermissionDirect}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      {inbuiltApkMode && inbuiltDndStatus?.granted ? 'OS DND Active' : 'Ask DND Access →'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectRadiusMode('silent')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        (activeZone?.silenceMode || defaultRadiusMode) !== 'vibrate'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <BellOff size={14} />
                      DND Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectRadiusMode('vibrate')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        (activeZone?.silenceMode || defaultRadiusMode) === 'vibrate'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <Vibrate size={14} />
                      Vibration Mode
                    </button>
                  </div>
                </div>

                {/* ACTIVE QUICK MUTE LIVE COUNTDOWN CARD */}
                {quickMuteSession?.active && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    className="w-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border-2 border-amber-400 rounded-2xl p-4 mb-4 shadow-sm relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                          <Zap size={20} className="fill-current text-amber-100" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-sm text-slate-900">
                              Quick Mute Active
                            </h4>
                            <span className="text-[10px] font-mono font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                              {formatDurationRemaining(quickMuteSecondsRemaining)} left
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Silenced without geofence • Restores at {new Date(quickMuteSession.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => endQuickMute(false)}
                        className="text-[10px] text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg font-bold shrink-0 transition active:scale-95 cursor-pointer shadow-2xs"
                        title="Cancel Quick Mute now and restore normal ringer"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Live animated progress bar */}
                    <div className="mt-3 w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(3, ((quickMuteSession.durationMinutes * 60 - quickMuteSecondsRemaining) / Math.max(1, quickMuteSession.durationMinutes * 60)) * 100))}%`
                        }}
                      />
                    </div>

                    {/* Quick Extension Action Buttons */}
                    <div className="mt-3 flex items-center justify-between gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Add Extra Time:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => extendQuickMute(15)}
                          className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-bold rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                          title="Add 15 minutes"
                        >
                          +15m
                        </button>
                        <button
                          type="button"
                          onClick={() => extendQuickMute(30)}
                          className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-bold rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                          title="Add 30 minutes"
                        >
                          +30m
                        </button>
                        <button
                          type="button"
                          onClick={() => endQuickMute(false)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold rounded-lg transition active:scale-95 cursor-pointer shadow-2xs flex items-center gap-1"
                        >
                          <Volume2 size={11} /> Unmute
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* QUICK MUTE DASHBOARD ACTION STRIP (When not currently in quick mute) */}
                {!quickMuteSession?.active && (
                  <div className="w-full bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200/90 mb-4 transition-all">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                          <Zap size={15} className="fill-current text-amber-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                            Quick Mute
                            <span className="text-[9px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded-full">
                              No zone needed
                            </span>
                          </h4>
                        </div>
                      </div>
                      <button
                        type="button"
                        id="quick-mute-custom-modal-btn"
                        onClick={() => setIsQuickMuteModalOpen(true)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      >
                        Custom duration...
                      </button>
                    </div>

                    {/* 1-Tap Preset Buttons (30m, 60m, 90m) */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        id="quick-mute-30m-btn"
                        onClick={() => startQuickMute(30)}
                        className="py-1.5 px-2 bg-slate-50 hover:bg-amber-50/80 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer flex flex-col items-center justify-center shadow-2xs"
                        title="Silence for 30 minutes"
                      >
                        <span className="text-[11px] font-bold">30 min</span>
                        <span className="text-[8px] text-slate-400 font-normal">Meeting</span>
                      </button>
                      <button
                        type="button"
                        id="quick-mute-60m-btn"
                        onClick={() => startQuickMute(60)}
                        className="py-1.5 px-2 bg-slate-50 hover:bg-amber-50/80 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer flex flex-col items-center justify-center shadow-2xs"
                        title="Silence for 60 minutes"
                      >
                        <span className="text-[11px] font-bold">60 min</span>
                        <span className="text-[8px] text-slate-400 font-normal">1 Hour</span>
                      </button>
                      <button
                        type="button"
                        id="quick-mute-90m-btn"
                        onClick={() => startQuickMute(90)}
                        className="py-1.5 px-2 bg-slate-50 hover:bg-amber-50/80 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer flex flex-col items-center justify-center shadow-2xs"
                        title="Silence for 90 minutes"
                      >
                        <span className="text-[11px] font-bold">90 min</span>
                        <span className="text-[8px] text-slate-400 font-normal">Deep work</span>
                      </button>
                      <button
                        type="button"
                        id="quick-mute-more-btn"
                        onClick={() => setIsQuickMuteModalOpen(true)}
                        className="py-1.5 px-2 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer flex flex-col items-center justify-center shadow-2xs"
                        title="Choose custom duration"
                      >
                        <span className="text-[11px] font-bold">+ Custom</span>
                        <span className="text-[8px] text-indigo-400 font-normal">More...</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* AUTOMATED QUIET SPOT DETECTED BANNER (Google Maps Grounding) */}
                <AnimatePresence>
                  {nearbySuggestedQuietSpot && (
                    <motion.div
                      key={nearbySuggestedQuietSpot.name}
                      initial={{ opacity: 0, scale: 0.96, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -6 }}
                      className="w-full bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border-2 border-indigo-400/80 rounded-2xl p-3.5 mb-4 shadow-lg text-white relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                            <Compass size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                                <Sparkles size={10} className="text-indigo-400" />
                                Quiet Spot Detected Nearby
                              </span>
                              <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-1.5 py-0.2 rounded-full">
                                Automatic
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-white truncate mt-0.5">
                              {nearbySuggestedQuietSpot.name}
                            </h4>
                            <p className="text-[10.5px] text-slate-300 truncate mt-0.5">
                              {nearbySuggestedQuietSpot.formattedAddress}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-300 flex-wrap">
                              {location && (
                                <span className="font-semibold text-indigo-200">
                                  {formatDistance(getDistance(location.lat, location.lng, nearbySuggestedQuietSpot.lat, nearbySuggestedQuietSpot.lng))} away
                                </span>
                              )}
                              {nearbySuggestedQuietSpot.operatingHours && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-0.5 text-slate-200 font-medium">
                                    <Clock size={10} className="text-slate-400" />
                                    {nearbySuggestedQuietSpot.operatingHours}
                                  </span>
                                </>
                              )}
                              {nearbySuggestedQuietSpot.quietnessRating && (
                                <>
                                  <span>·</span>
                                  <span className="text-indigo-300 font-semibold flex items-center gap-0.5">
                                    <VolumeX size={10} />
                                    {nearbySuggestedQuietSpot.quietnessRating === 'silent' ? 'Strictly Silent' : 'Low Noise'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setDismissedSuggestedSpots((prev) => new Set(prev).add(nearbySuggestedQuietSpot.name));
                            setNearbySuggestedQuietSpot(null);
                          }}
                          className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
                          title="Dismiss suggestion"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-indigo-800/60 flex items-center justify-between gap-2">
                        {nearbySuggestedQuietSpot.googleMapsUrl && (
                          <a
                            href={nearbySuggestedQuietSpot.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-300 hover:text-indigo-100 flex items-center gap-0.5"
                          >
                            View on Google Maps <ExternalLink size={9} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAddZoneFromDiscoveredPlace(nearbySuggestedQuietSpot)}
                          className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer flex items-center gap-1.5 ml-auto"
                        >
                          <Plus size={12} />
                          <span>Add to Silent Zones</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* GOOGLE MAPS QUIET ZONE DISCOVERY QUICK LAUNCHER */}
                <div className="w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-3.5 mb-4 shadow-sm border border-indigo-900/60 transition-all relative overflow-hidden group">
                  <div className="flex items-center justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-400/30">
                        <Compass size={18} className="text-indigo-300 group-hover:rotate-45 transition-transform duration-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-xs text-white">Find Nearby Quiet Spots</h4>
                          <span className="text-[9px] font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                            <Sparkles size={8} /> Google Maps
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-300 truncate mt-0.5">
                          Discover real-world libraries, clinics &amp; quiet study halls
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="home-discover-quiet-btn"
                      onClick={() => setActiveTab('discover')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shrink-0 transition active:scale-95 shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>Explore</span>
                      <Sparkles size={11} />
                    </button>
                  </div>
                </div>

                {/* Overridden by Schedule Live Dashboard Banner */}
                {isScheduleActive && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="w-full bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 mb-4 shadow-md border border-purple-500/35 relative overflow-hidden"
                  >
                    <div className="absolute -right-6 -top-6 w-28 h-28 bg-purple-500/20 rounded-full blur-xl pointer-events-none" />
                    
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/30 text-purple-200 border border-purple-400/40 flex items-center justify-center shrink-0 shadow-inner">
                          <Moon size={22} className="text-purple-300 animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-wider bg-purple-500/40 text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/40">
                              Overridden by Schedule
                            </span>
                            <span className="text-[10px] font-mono text-purple-300">
                              {formatTimeTo12Hour(timeOverride.startTime)} – {formatTimeTo12Hour(timeOverride.endTime)}
                            </span>
                          </div>
                          <p className="text-xs text-purple-100 font-medium mt-1 leading-snug">
                            Global quiet hours active. DND remains forced on regardless of your location.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition shrink-0 active:scale-95 cursor-pointer"
                        title="Configure Time-Based Override schedule in Settings"
                      >
                        Adjust
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Dwell Verification Live Countdown Banner */}
                {dwellPendingZone && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="w-full bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-amber-500/10 border-2 border-amber-300 rounded-2xl p-4 mb-4 shadow-sm relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                          <Timer size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-sm text-slate-900">
                              Dwell Verification Active
                            </h4>
                            <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                              {dwellSecondsRemaining}s left
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Inside <strong>"{dwellPendingZone.name}"</strong>. DND triggers once {dwellTimeSeconds}s dwell is verified.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsDwellModalOpen(true)}
                        className="text-[10px] text-indigo-700 hover:text-indigo-900 bg-white/90 border border-indigo-200 px-2 py-1 rounded-lg font-bold shrink-0 transition cursor-pointer"
                        title="Adjust dwell time"
                      >
                        {dwellTimeSeconds}s Delay ⚙️
                      </button>
                    </div>

                    {/* Live animated progress bar */}
                    <div className="mt-3 w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-indigo-600 rounded-full transition-all duration-200"
                        style={{
                          width: `${Math.min(100, Math.max(5, ((dwellTimeSeconds - dwellSecondsRemaining) / Math.max(1, dwellTimeSeconds)) * 100))}%`
                        }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        id="dwell-skip-wait-btn"
                        onClick={handleSkipDwellDelay}
                        className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                        title="Bypass remaining dwell countdown and mute ringer immediately"
                      >
                        <Sparkles size={13} />
                        Mute Now (Skip Dwell Delay)
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Exit Verification Grace Period Active Banner (Indoor GPS Anti-Drift Guard) */}
                {exitPendingZone && (
                  <motion.div
                    key="exit-grace-banner"
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-400 rounded-2xl p-4 mb-4 shadow-md relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                          <AlertTriangle size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-sm text-slate-900">
                              Classroom GPS Drift Detected
                            </h4>
                            <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full border border-amber-300">
                              Unmuting in {exitSecondsRemaining}s
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 mt-0.5">
                            Signal drifted outside <strong>"{exitPendingZone.name}"</strong>. DND remains locked ON during grace period.
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                        <ShieldCheck size={11} />
                        DND PROTECTED
                      </span>
                    </div>

                    {/* Live countdown progress */}
                    <div className="mt-3 w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full transition-all duration-200"
                        style={{
                          width: `${Math.min(100, Math.max(5, (exitSecondsRemaining / Math.max(1, exitGraceSeconds)) * 100))}%`
                        }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cancelExitGrace}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                        title="Keep ringer muted and anchor position to classroom"
                      >
                        <ShieldCheck size={14} />
                        I'm Still In Class (Stay Muted)
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmZoneExit(exitPendingZone)}
                        className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                        title="Unmute ringer immediately"
                      >
                        Unmute Now
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Manual Override Active Indicator */}
                {manualOverrideDndOff && activeZone && (
                  <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-center justify-between text-xs animate-fade-in">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-amber-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-900">Manual Override Active</p>
                        <p className="text-[10px] text-amber-700">Silent mode paused inside {activeZone.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setManualOverrideDndOff(false);
                        setIsDndActive(true);
                      }}
                      className="text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded-lg transition active:scale-95"
                    >
                      Resume Auto-DND
                    </button>
                  </div>
                )}

                {/* Auto-DND Banner */}
                <div className="w-full bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 mb-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-slate-800">Automatic DND Automation</p>
                        <button
                          type="button"
                          onClick={() => setIsDwellModalOpen(true)}
                          className="text-[9px] bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold px-1.5 py-0.5 rounded border border-indigo-200 flex items-center gap-0.5 cursor-pointer transition active:scale-95"
                          title="Configure entry dwell time delay"
                        >
                          <Timer size={9} className="text-indigo-700" />
                          {dwellTimeSeconds > 0 ? `${dwellTimeSeconds}s Dwell Filter` : 'Instant DND'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {dwellTimeSeconds > 0 
                          ? `Requires ${dwellTimeSeconds}s continuous presence before muting to filter pass-throughs` 
                          : 'Mutes immediately on entry, unmutes on exit'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full shrink-0">
                    {autoDndEnabled ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>

                {/* Active Geofence Card */}
                <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Geofence Status</h3>
                    </div>
                    <AnimatePresence mode="wait">
                      {isScheduleActive ? (
                        <motion.span 
                          key="schedule-badge"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 bg-purple-100 text-purple-900 border border-purple-300"
                        >
                          <Moon size={11} className="text-purple-600 animate-pulse" />
                          Overridden by Schedule
                        </motion.span>
                      ) : activeZone ? (
                        <motion.span 
                          key={`active-badge-${activeZone.id}`}
                          initial={{ opacity: 0, scale: 0.85, y: -2 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ 
                            opacity: 0, 
                            scale: 1.25, 
                            filter: 'blur(2px)', 
                            transition: { duration: 0.35, ease: 'easeOut' } 
                          }}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            dwellPendingZone 
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold' 
                              : 'bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dwellPendingZone ? 'bg-amber-600 animate-ping' : 'bg-indigo-600 animate-pulse'}`} />
                          {dwellPendingZone ? `Dwelling (${dwellSecondsRemaining}s)` : 'Inside Perimeter'}
                        </motion.span>
                      ) : recentExitZone ? (
                        <motion.span
                          key={`exit-badge-${recentExitZone.timestamp}`}
                          initial={{ opacity: 0, scale: 0.85, y: 2 }}
                          animate={{ opacity: 1, scale: [0.85, 1.1, 1], y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
                          transition={{ duration: 0.35 }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
                        >
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          Exited: {recentExitZone.name}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </div>
                  
                  <AnimatePresence mode="wait">
                    {activeZone ? (
                      <motion.div 
                        key={`active-zone-${activeZone.id}`}
                        initial={{ opacity: 0, scale: 0.96, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ 
                          opacity: 0, 
                          scale: 1.05, 
                          y: -8, 
                          filter: 'blur(2px)', 
                          transition: { duration: 0.35, ease: 'easeOut' } 
                        }}
                        className="space-y-3"
                      >
                        <div className={`flex items-center gap-3.5 p-3 rounded-xl border ${
                          dwellPendingZone 
                            ? 'bg-amber-50/70 border-amber-200' 
                            : isScheduleActive
                            ? 'bg-purple-50/70 border-purple-200'
                            : 'bg-indigo-50/60 border-indigo-100/70'
                        }`}>
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${
                            dwellPendingZone 
                              ? 'bg-amber-500 text-white' 
                              : isScheduleActive
                              ? 'bg-purple-600 text-white'
                              : isDndActive 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-300 text-slate-700'
                          }`}>
                            {dwellPendingZone ? (
                              <Timer size={22} className="animate-spin" />
                            ) : isScheduleActive ? (
                              <Moon size={22} />
                            ) : isDndActive ? (
                              <CheckCircle2 size={22} />
                            ) : (
                              <Bell size={22} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-slate-900 font-bold text-sm truncate">{activeZone.name}</p>
                            <p className={`text-xs font-medium ${dwellPendingZone ? 'text-amber-800' : isScheduleActive ? 'text-purple-800' : 'text-indigo-700'}`}>
                              {dwellPendingZone
                                ? `Dwell filter active • ${dwellSecondsRemaining}s remaining before muting`
                                : isScheduleActive
                                ? `Inside zone • Also Overridden by Schedule (${formatTimeTo12Hour(timeOverride.startTime)} - ${formatTimeTo12Hour(timeOverride.endTime)})`
                                : isDndActive 
                                ? `Automatic DND ON • ${activeZone.radius}m perimeter` 
                                : `DND Paused inside perimeter (${activeZone.radius}m)`}
                            </p>
                          </div>
                        </div>

                        {/* Action Controls inside the active zone card */}
                        <div className="pt-1 flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={toggleClassroomLock}
                            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs shadow-2xs transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer border ${
                              classroomLockActive
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200 hover:border-emerald-200'
                            }`}
                            title="Anchor your GPS location to this room while in class"
                          >
                            {classroomLockActive ? <Lock size={13} /> : <Unlock size={13} />}
                            {classroomLockActive ? 'Classroom Shield ON' : 'Lock to Class (Anti-Drift)'}
                          </button>

                          {dwellPendingZone ? (
                            <button
                              id="active-zone-skip-dwell-btn"
                              type="button"
                              onClick={handleSkipDwellDelay}
                              className="flex-1 py-2 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                              title="Skip remaining delay and mute ringer right away"
                            >
                              <Sparkles size={13} />
                              Mute Now (Skip Dwell Delay)
                            </button>
                          ) : (
                            <button
                              id="active-zone-toggle-dnd-btn"
                              type="button"
                              onClick={toggleManualDnd}
                              className="flex-1 py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                              title="Override and toggle DND state"
                            >
                              {isDndActive ? <Bell size={13} /> : <BellOff size={13} />}
                              {isDndActive ? 'Pause DND (Override)' : 'Resume Silent Mode'}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ) : recentExitZone ? (
                      <motion.div
                        key={`recent-exit-${recentExitZone.timestamp}`}
                        initial={{ opacity: 0, scale: 0.9, y: 6 }}
                        animate={{ 
                          opacity: 1, 
                          scale: [0.9, 1.04, 1],
                          y: 0 
                        }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/90 text-emerald-950 flex items-center justify-between shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <CheckCircle2 size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                              Exit Registered Successfully
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            </p>
                            <p className="text-[11px] text-emerald-700 mt-0.5">
                              Exited <strong>"{recentExitZone.name}"</strong> • Normal ringer restored
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-white text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full shrink-0 shadow-2xs">
                          NORMAL MODE
                        </span>
                      </motion.div>
                    ) : isScheduleActive ? (
                      <motion.div 
                        key="schedule-override-active"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex items-center justify-between gap-3 bg-purple-50/80 p-3.5 rounded-xl border border-purple-200/90"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                            <Moon size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-purple-950 font-bold text-xs truncate">
                              Outside Zones • Overridden by Schedule
                            </p>
                            <p className="text-purple-800 text-[11px] truncate mt-0.5">
                              DND forced ON by global quiet hours ({formatTimeTo12Hour(timeOverride.startTime)} – {formatTimeTo12Hour(timeOverride.endTime)})
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('settings')}
                          className="px-2.5 py-1.5 bg-white hover:bg-purple-100/70 text-purple-900 border border-purple-200 font-bold text-xs rounded-xl shadow-2xs transition shrink-0 active:scale-95 cursor-pointer"
                        >
                          Adjust
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="outside-zones"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-slate-200 text-slate-500 rounded-xl flex items-center justify-center shrink-0">
                            <MapPin size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-slate-800 font-bold text-xs truncate">
                              {zones.length > 0 ? 'Outside of Silent Zones' : 'No Silent Zones Configured'}
                            </p>
                            <p className="text-slate-500 text-[11px] truncate">
                              {zones.length > 0 ? 'Normal ringer active' : 'Add your first zone to automate DND'}
                            </p>
                          </div>
                        </div>
                        {zones.length === 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('zones');
                              setIsAddingZone(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shrink-0 active:scale-95 cursor-pointer shadow-2xs"
                          >
                            + Add Zone
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* GPS Location Accuracy & Drift Sparkline Chart (Last 10 minutes) */}
                <GpsAccuracySparkline
                  history={gpsAccuracyHistory}
                  currentLocation={location}
                  isSimulating={isSimulating}
                  onRefreshGps={refreshGpsFix}
                />

                {/* Auto-DND Activity Log */}
                <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <History size={13} />
                      Automation History
                    </h3>
                    <span className="text-[10px] text-slate-400">{activityLogs.length} events</span>
                  </div>

                  {activityLogs.length > 0 ? (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2.5 text-xs border-b border-slate-50 pb-1.5 last:border-none">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${log.type === 'enter' ? 'bg-indigo-600' : 'bg-emerald-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 leading-tight">
                              {log.type === 'enter' ? `Entered ${log.zoneName}` : `Exited ${log.zoneName}`}
                            </p>
                            <p className="text-[10px] text-slate-500">{log.detail}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">{log.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-3">
                      No transitions recorded yet. Entering a zone perimeter will automatically trigger DND.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ZONES TAB */}
            {activeTab === 'zones' && !isAddingZone && (
              <motion.div 
                key="zones"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                className="p-5"
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Saved Silent Zones</h2>
                    <p className="text-xs text-slate-500">Automatically activates DND within perimeter</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      id="export-zones-header-btn"
                      onClick={() => {
                        setBackupModalTab('export');
                        setIsBackupModalOpen(true);
                      }}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shadow-xs transition active:scale-95"
                      title="Export Zones to JSON"
                      aria-label="Export zones JSON backup"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      id="import-zones-header-btn"
                      onClick={() => {
                        setBackupModalTab('import');
                        setIsBackupModalOpen(true);
                      }}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shadow-xs transition active:scale-95"
                      title="Import Zones from JSON"
                      aria-label="Import zones JSON"
                    >
                      <Upload size={15} />
                    </button>
                    <button
                      id="discover-quiet-header-btn"
                      onClick={() => setActiveTab('discover')}
                      className="w-8 h-8 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs transition active:scale-95"
                      title="Discover Nearby Quiet Spots on Google Maps"
                      aria-label="Discover quiet places"
                    >
                      <Compass size={15} />
                    </button>
                    <button 
                      id="add-zone-header-btn"
                      onClick={() => setIsAddingZone(true)}
                      className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-700 transition active:scale-95"
                      title="Add Silent Zone"
                      aria-label="Add silent zone"
                    >
                      <Plus size={18} />
                    </button>
                    {zones.length > 0 && (
                      <button
                        id="clear-all-zones-header-btn"
                        onClick={() => {
                          setZones([]);
                          if (headsUpAlertsEnabled) {
                            setNotification({
                              id: Date.now().toString(),
                              title: 'Zones Cleared',
                              message: 'All saved silent zones have been removed.',
                              type: 'normal',
                            });
                          }
                        }}
                        className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center shadow-xs transition active:scale-95"
                        title="Delete All Saved Zones"
                        aria-label="Delete all saved zones"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-tab switcher between Radar & List and Statistics */}
                <div className="flex bg-slate-200/80 p-1 rounded-xl mb-4 text-xs font-semibold">
                  <button
                    id="zones-subtab-list-btn"
                    type="button"
                    onClick={() => setZonesSubTab('list')}
                    className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
                      zonesSubTab === 'list'
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers size={14} className={zonesSubTab === 'list' ? 'text-indigo-600' : ''} />
                    Radar & Zones ({zones.length})
                  </button>
                  <button
                    id="zones-subtab-stats-btn"
                    type="button"
                    onClick={() => setZonesSubTab('statistics')}
                    className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
                      zonesSubTab === 'statistics'
                        ? 'bg-indigo-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 size={14} />
                    Statistics
                  </button>
                </div>

                {/* STATISTICS SECTION */}
                {zonesSubTab === 'statistics' && (
                  <motion.div
                    key="zones-statistics-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ZoneStatistics
                      zones={zones}
                      activityLogs={activityLogs}
                      onUpdateZones={setZones}
                      onSelectZone={(z) => {
                        jumpToZone(z.lat, z.lng);
                        setZonesSubTab('list');
                      }}
                    />
                  </motion.div>
                )}

                {/* RADAR & ZONES LIST VIEW */}
                {zonesSubTab === 'list' && (
                  <>
                    {/* SVG-based Geofence Proximity Map */}
                    <ZonesVisualMap
                      zones={zones}
                      location={location}
                      activeZone={activeZone}
                      isDndActive={isDndActive}
                      mapTheme={mapTheme}
                      isSimulating={isSimulating}
                      onMapThemeChange={setMapTheme}
                      onSelectZone={(z) => jumpToZone(z.lat, z.lng)}
                      onMoveLocation={moveLocationTo}
                      onStepMove={stepLocation}
                      onResetToGps={resetToRealGpsLocation}
                      onToggleManualDnd={toggleManualDnd}
                      manualOverrideActive={manualOverrideDndOff}
                      onOpenDiscovery={() => setActiveTab('discover')}
                      classroomLockActive={classroomLockActive}
                      onToggleClassroomLock={toggleClassroomLock}
                      exitPendingZone={exitPendingZone}
                      exitSecondsRemaining={exitSecondsRemaining}
                      onCancelExitGrace={cancelExitGrace}
                      onConfirmImmediateExit={() => exitPendingZone && confirmZoneExit(exitPendingZone)}
                    />

                    {/* DYNAMIC PROXIMITY & SORTING CONTROLS */}
                    <div className="bg-white rounded-2xl p-3.5 shadow-2xs border border-slate-200/90 mb-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <ArrowUpDown size={15} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-800">Zone Ordering</span>
                              {zoneSortBy === 'proximity' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Live Proximity Auto-Sort
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                  Manual Sort
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin size={10} className="text-indigo-500 shrink-0" />
                              {location 
                                ? `Current GPS: ${location.lat.toFixed(4)}°N, ${location.lng.toFixed(4)}°W • ${sortedZones.length} zones`
                                : 'Acquiring GPS location...'}
                            </p>
                          </div>
                        </div>

                        {/* Controls: Dwell Config & Sort Order */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => setIsDwellModalOpen(true)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center gap-1 transition active:scale-95 cursor-pointer"
                            title="Configure Entry Dwell Time Delay"
                          >
                            <Timer size={11} className="text-indigo-600" />
                            <span>Dwell: {dwellTimeSeconds > 0 ? `${dwellTimeSeconds}s` : 'Off'}</span>
                          </button>

                          <button
                            id="toggle-sort-order-btn"
                            type="button"
                            onClick={() => setZoneSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition active:scale-95"
                            title={
                              zoneSortBy === 'proximity' 
                                ? (zoneSortOrder === 'asc' ? 'Order: Closest first (click for furthest first)' : 'Order: Furthest first (click for closest first)')
                                : (zoneSortOrder === 'asc' ? 'Ascending (click for descending)' : 'Descending (click for ascending)')
                            }
                          >
                            {zoneSortOrder === 'asc' ? (
                              <>
                                <ArrowUp size={12} className="text-indigo-600" />
                                <span>{zoneSortBy === 'proximity' ? 'Nearest First' : 'Ascending'}</span>
                              </>
                            ) : (
                              <>
                                <ArrowDown size={12} className="text-amber-600" />
                                <span>{zoneSortBy === 'proximity' ? 'Furthest First' : 'Descending'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Sort Mode Pill Selector */}
                      <div className="grid grid-cols-4 gap-1.5 pt-2.5 text-center">
                        <button
                          id="sort-mode-proximity-btn"
                          type="button"
                          onClick={() => {
                            setZoneSortBy('proximity');
                            setZoneSortOrder('asc');
                          }}
                          className={`py-1.5 px-1 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
                            zoneSortBy === 'proximity'
                              ? 'bg-indigo-600 text-white shadow-xs font-bold'
                              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                          }`}
                          title="Sort dynamically by proximity to your current location (closest first)"
                        >
                          <Navigation size={12} className={zoneSortBy === 'proximity' ? 'text-white' : 'text-indigo-600'} />
                          <span>Proximity</span>
                        </button>

                        <button
                          id="sort-mode-name-btn"
                          type="button"
                          onClick={() => setZoneSortBy('name')}
                          className={`py-1.5 px-1 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
                            zoneSortBy === 'name'
                              ? 'bg-indigo-600 text-white shadow-xs font-bold'
                              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                          }`}
                          title="Sort alphabetically by zone name"
                        >
                          <ArrowUpDown size={12} />
                          <span>Name (A-Z)</span>
                        </button>

                        <button
                          id="sort-mode-visits-btn"
                          type="button"
                          onClick={() => {
                            setZoneSortBy('visits');
                            setZoneSortOrder('desc');
                          }}
                          className={`py-1.5 px-1 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
                            zoneSortBy === 'visits'
                              ? 'bg-indigo-600 text-white shadow-xs font-bold'
                              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                          }`}
                          title="Sort by most frequently visited zones"
                        >
                          <Footprints size={12} />
                          <span>Visits</span>
                        </button>

                        <button
                          id="sort-mode-radius-btn"
                          type="button"
                          onClick={() => setZoneSortBy('radius')}
                          className={`py-1.5 px-1 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
                            zoneSortBy === 'radius'
                              ? 'bg-indigo-600 text-white shadow-xs font-bold'
                              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                          }`}
                          title="Sort by zone radius perimeter size"
                        >
                          <Maximize2 size={12} />
                          <span>Radius</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      {sortedZones.map((zone, index) => {
                        const distance = zone.distance;
                        const isHere = zone.isInside;
                        const visits = zone.totalVisits ?? 0;
                        const avgSeconds = visits > 0 ? Math.round((zone.totalDurationSeconds ?? 0) / visits) : 0;
                        const avgFormatted = formatDurationSeconds(avgSeconds);

                        return (
                          <motion.div 
                            key={zone.id}
                            layout
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ 
                              layout: { type: "spring", stiffness: 350, damping: 28 },
                              duration: 0.25 
                            }}
                            className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${
                              isHere 
                                ? 'border-indigo-400 ring-2 ring-indigo-500/15 bg-gradient-to-br from-indigo-50/20 to-white' 
                                : index === 0 && zoneSortBy === 'proximity'
                                ? 'border-indigo-200 ring-1 ring-indigo-300/40'
                                : 'border-slate-100'
                            } flex items-center gap-3.5`}
                          >
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${zone.enabled ? (isHere ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600') : 'bg-slate-100 text-slate-400'}`}>
                              {isHere ? <CheckCircle2 size={22} /> : <MapIcon size={22} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className={`font-bold text-sm truncate ${zone.enabled ? 'text-slate-800' : 'text-slate-400'}`}>{zone.name}</h3>
                                
                                {isHere ? (
                                  dwellPendingZone?.id === zone.id ? (
                                    <span className="text-[9px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                      <Timer size={9} />
                                      DWELLING ({dwellSecondsRemaining}s)
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                      DND ACTIVE
                                    </span>
                                  )
                                ) : zoneSortBy === 'proximity' && index === 0 && distance !== null ? (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                    #1 CLOSEST
                                  </span>
                                ) : null}

                                {/* Proximity or Category Rank Chip */}
                                {zoneSortBy === 'proximity' && (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 font-semibold px-1 py-0.5 rounded">
                                    Rank #{index + 1}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center text-xs text-slate-500 mt-0.5 gap-2 flex-wrap">
                                <span className="font-semibold text-slate-700">{zone.radius}m perimeter</span>
                                <button
                                  id={`edit-radius-badge-${zone.id}`}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingRadiusZone(zone);
                                  }}
                                  className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200/80 rounded-md text-[10px] font-semibold flex items-center gap-1 transition active:scale-95 shadow-2xs cursor-pointer"
                                  title={`Edit perimeter radius for ${zone.name}`}
                                >
                                  <Sliders size={10} className="text-indigo-600" />
                                  Edit Radius
                                </button>
                                {distance !== null && (
                                  <>
                                    <span>•</span>
                                    <span className={isHere ? 'text-indigo-600 font-semibold' : 'text-slate-700 font-medium'}>
                                      {isHere ? 'Inside zone' : `${formatDistance(distance)} away`}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Live Distance Meter Progress Bar */}
                              {distance !== null && (
                                <div className="mt-1.5 flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        isHere ? 'bg-indigo-600 w-full' : 'bg-indigo-400'
                                      }`}
                                      style={{
                                        width: isHere 
                                          ? '100%' 
                                          : `${Math.max(8, Math.min(100, Math.round((zone.radius / distance) * 100)))}%`
                                      }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                    {isHere ? '0m away' : `${Math.round(distance)}m`}
                                  </span>
                                </div>
                              )}

                              {/* Visit & Average Duration Stats Chips */}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {/* Silence Mode Quick Toggle Pill */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cycleZoneSilenceMode(zone.id);
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border transition cursor-pointer active:scale-95 shadow-2xs ${
                                    zone.silenceMode === 'vibrate'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                      : zone.silenceMode === 'priority'
                                      ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                                      : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                                  }`}
                                  title="Click to cycle silence profile (Total Silence -> Vibrate Only -> Priority Only)"
                                >
                                  {zone.silenceMode === 'vibrate' ? (
                                    <><Vibrate size={10} className="text-amber-600" /> Vibrate Only</>
                                  ) : zone.silenceMode === 'priority' ? (
                                    <><Star size={10} className="text-purple-600 fill-purple-500" /> Priority Only</>
                                  ) : (
                                    <><BellOff size={10} className="text-indigo-600" /> Total Silence</>
                                  )}
                                </button>

                                {/* WiFi Beacon Chip */}
                                {zone.wifiSsid && (
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">
                                    <Wifi size={10} className="text-emerald-600" />
                                    {zone.wifiSsid}
                                  </span>
                                )}
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                                  <Footprints size={10} className="text-indigo-600" />
                                  {visits} {visits === 1 ? 'visit' : 'visits'}
                                </span>
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                                  <Clock size={10} className="text-teal-600" />
                                  Avg: {avgFormatted}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZonesSubTab('statistics');
                                  }}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 ml-auto"
                                  title="View in Statistics bar chart"
                                >
                                  <BarChart3 size={10} />
                                  Chart
                                </button>
                              </div>

                              {/* Quick Perimeter Actions: Edit Radius & +/- Stepper */}
                              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                {dwellPendingZone?.id === zone.id && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSkipDwellDelay();
                                    }}
                                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center gap-1 transition active:scale-95 shadow-2xs"
                                    title="Skip remaining dwell delay and mute now"
                                  >
                                    <Sparkles size={10} />
                                    Mute Now
                                  </button>
                                )}

                                <button
                                  id={`edit-radius-btn-${zone.id}`}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingRadiusZone(zone);
                                  }}
                                  className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded text-[10px] font-semibold flex items-center gap-1 transition active:scale-95 shadow-2xs"
                                  title="Open quick perimeter adjustment dialog"
                                >
                                  <Sliders size={10} className="text-indigo-600" />
                                  Edit Radius
                                </button>

                                <div className="inline-flex items-center bg-slate-100/90 rounded border border-slate-200 text-[10px] font-mono overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateZoneRadius(zone.id, Math.max(10, zone.radius - 10));
                                    }}
                                    className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-bold transition active:scale-95"
                                    title="Quickly decrease perimeter radius by 10m"
                                  >
                                    -10m
                                  </button>
                                  <span className="px-1 py-0.5 font-semibold text-slate-700 bg-white border-x border-slate-200 text-[9px]">
                                    {zone.radius}m
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateZoneRadius(zone.id, zone.radius + 10);
                                    }}
                                    className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-bold transition active:scale-95"
                                    title="Quickly increase perimeter radius by 10m"
                                  >
                                    +10m
                                  </button>
                                </div>
                              </div>

                              {/* Google Maps Grounding Metadata Card (Hours, Quietness, Address) */}
                              {zone.mapsMetadata && (
                                <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] space-y-1">
                                  <div className="flex items-center justify-between text-slate-500 gap-2">
                                    <span className="truncate flex items-center gap-1 font-medium text-slate-700">
                                      <MapPin size={10} className="text-indigo-600 shrink-0" />
                                      <span className="truncate">{zone.mapsMetadata.formattedAddress}</span>
                                    </span>
                                    {zone.mapsMetadata.googleMapsUrl && (
                                      <a
                                        href={zone.mapsMetadata.googleMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 shrink-0 font-semibold"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Google Maps <ExternalLink size={9} />
                                      </a>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-500 flex-wrap">
                                    {zone.mapsMetadata.operatingHours && (
                                      <span className="flex items-center gap-1 font-medium text-slate-600">
                                        <Clock size={10} className="text-slate-400" />
                                        {zone.mapsMetadata.operatingHours}
                                      </span>
                                    )}
                                    {zone.mapsMetadata.quietnessRating && (
                                      <>
                                        <span>·</span>
                                        <span className="text-indigo-700 font-semibold flex items-center gap-0.5">
                                          <VolumeX size={9} />
                                          {zone.mapsMetadata.quietnessRating === 'silent' ? 'Strictly Silent' : 'Low Noise'}
                                        </span>
                                      </>
                                    )}
                                    {zone.mapsMetadata.placeCategory && (
                                      <>
                                        <span>·</span>
                                        <span className="text-slate-400">{zone.mapsMetadata.placeCategory}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2.5 shrink-0">
                              {/* Toggle Switch */}
                              <button 
                                onClick={() => toggleZone(zone.id)}
                                className={`w-11 h-6 rounded-full transition-colors relative ${zone.enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                title={zone.enabled ? 'Disable Zone' : 'Enable Zone'}
                              >
                                <motion.div 
                                  layout
                                  className={`w-4 h-4 bg-white rounded-full absolute top-1 ${zone.enabled ? 'right-1' : 'left-1'}`}
                                />
                              </button>
                              <button 
                                onClick={() => deleteZone(zone.id)} 
                                className="text-slate-400 hover:text-red-500 transition p-0.5"
                                title="Delete Zone"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                      {zones.length === 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                          className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500"
                        >
                          <MapIcon size={44} className="mx-auto text-slate-300 mb-3" />
                          <p className="font-bold text-slate-700">No Silent Zones Configured</p>
                          <p className="text-xs text-slate-400 mt-1 mb-4">Add a quiet location or restore from a JSON backup file.</p>
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsAddingZone(true)}
                              className="px-4 py-2 bg-indigo-600 text-white font-semibold text-xs rounded-xl hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                            >
                              <Plus size={14} />
                              Add Silent Zone
                            </button>
                            <button
                              id="empty-state-import-json-btn"
                              onClick={() => {
                                setBackupModalTab('import');
                                setIsBackupModalOpen(true);
                              }}
                              className="px-3.5 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-200 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <Upload size={13} />
                              Import JSON
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ADD ZONE SCREEN */}
            {isAddingZone && (
              <motion.div
                key="add-zone"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute inset-0 bg-slate-50 z-30 flex flex-col"
              >
                <header className="bg-white px-4 py-3.5 shadow-sm flex items-center gap-3 border-b border-slate-100">
                  <button onClick={() => { setIsAddingZone(false); setCustomZoneCoords(null); }} className="p-1.5 -ml-1 text-slate-600 hover:bg-slate-100 rounded-full transition">
                    <ChevronLeft size={22} />
                  </button>
                  <h2 className="text-base font-bold text-slate-900">Add Silent Zone</h2>
                </header>
                
                <div className="p-5 flex-1 overflow-y-auto space-y-5">
                  {/* Interactive Google Maps Geofence Picker & Radius Preview */}
                  <GeofencePickerMap
                    centerLat={
                      customZoneCoords
                        ? customZoneCoords.lat
                        : selectedMapsPlace
                        ? selectedMapsPlace.lat
                        : placementType === 'ahead'
                        ? (location?.lat ?? 37.775) + 0.0022
                        : location?.lat ?? 37.775
                    }
                    centerLng={
                      customZoneCoords
                        ? customZoneCoords.lng
                        : selectedMapsPlace
                        ? selectedMapsPlace.lng
                        : placementType === 'ahead'
                        ? (location?.lng ?? -122.4194) + 0.0022
                        : location?.lng ?? -122.4194
                    }
                    radius={parseInt(newZoneRadius, 10) || 100}
                    userLat={location?.lat}
                    userLng={location?.lng}
                    mapTheme={mapTheme}
                    interactive={true}
                    onPickCoordinates={(lat, lng) => setCustomZoneCoords({ lat, lng })}
                    heightClassName="h-44"
                    label={
                      customZoneCoords
                        ? `Pinned on Map (${customZoneCoords.lat.toFixed(4)}°, ${customZoneCoords.lng.toFixed(4)}°)`
                        : selectedMapsPlace
                        ? `Grounded: ${selectedMapsPlace.name} (${selectedMapsPlace.lat.toFixed(4)}°, ${selectedMapsPlace.lng.toFixed(4)}°)`
                        : placementType === 'current'
                        ? 'Tap map to move pin • Current Location'
                        : 'Tap map to move pin • ~200m Ahead'
                    }
                  />

                  {/* Google Maps Place Search & Grounding Autocomplete */}
                  <div className="bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/40 border border-indigo-200/90 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-indigo-600" />
                        Search Google Maps Verified Venue
                      </label>
                      <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-100/70 px-2 py-0.5 rounded-full">
                        Auto-Fills Details
                      </span>
                    </div>
                    <PlaceSearchInput
                      currentLat={location?.lat}
                      currentLng={location?.lng}
                      placeholder="Search library, clinic, hospital, theater on Google Maps..."
                      onSelectPlace={(place) => {
                        setSelectedMapsPlace(place);
                        setCustomZoneCoords(null);
                        setNewZoneName(place.name);
                        if (place.recommendedRadius) {
                          setNewZoneRadius(String(place.recommendedRadius));
                        }
                        if (place.quietnessRating === 'whisper') {
                          setNewZoneSilenceMode('vibrate');
                        } else {
                          setNewZoneSilenceMode('silent');
                        }
                      }}
                    />

                    {selectedMapsPlace && (
                      <div className="bg-white rounded-xl p-3 border border-indigo-200 text-xs space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span className="truncate text-slate-900">{selectedMapsPlace.name}</span>
                          <span className="text-[9.5px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5 shrink-0 font-semibold">
                            <Check size={10} /> Maps Grounded
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{selectedMapsPlace.formattedAddress}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-600 flex-wrap">
                          {selectedMapsPlace.operatingHours && (
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <Clock size={10} className="text-slate-400" />
                              {selectedMapsPlace.operatingHours}
                            </span>
                          )}
                          {selectedMapsPlace.quietnessRating && (
                            <>
                              <span>·</span>
                              <span className="text-indigo-700 font-bold flex items-center gap-0.5">
                                <VolumeX size={10} />
                                {selectedMapsPlace.quietnessRating === 'silent' ? 'Strictly Silent' : 'Low Noise'}
                              </span>
                            </>
                          )}
                          {selectedMapsPlace.placeCategory && (
                            <>
                              <span>·</span>
                              <span className="text-slate-400">{selectedMapsPlace.placeCategory}</span>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedMapsPlace(null)}
                          className="text-[10px] text-rose-600 hover:underline pt-0.5"
                        >
                          Clear selected venue
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Zone Name</label>
                    <input 
                      type="text" 
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      placeholder="e.g. University Library, Office, Clinic"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  </div>

                  {/* Silence Profile Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Silence Profile
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewZoneSilenceMode('silent')}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          newZoneSilenceMode === 'silent'
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold ring-1 ring-indigo-500'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <BellOff size={16} className="mx-auto mb-1 text-indigo-600" />
                        <span className="text-xs block font-bold">Total Silence</span>
                        <span className="text-[9px] text-slate-400">Full DND</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewZoneSilenceMode('vibrate')}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          newZoneSilenceMode === 'vibrate'
                            ? 'bg-amber-50 border-amber-600 text-amber-900 font-bold ring-1 ring-amber-500'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <Vibrate size={16} className="mx-auto mb-1 text-amber-600" />
                        <span className="text-xs block font-bold">Vibrate Only</span>
                        <span className="text-[9px] text-slate-400">Haptics on</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewZoneSilenceMode('priority')}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          newZoneSilenceMode === 'priority'
                            ? 'bg-purple-50 border-purple-600 text-purple-900 font-bold ring-1 ring-purple-500'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <Star size={16} className="mx-auto mb-1 text-purple-600 fill-purple-400" />
                        <span className="text-xs block font-bold">Priority Only</span>
                        <span className="text-[9px] text-slate-400">Alarms/VIP</span>
                      </button>
                    </div>
                  </div>

                  {/* WiFi SSID Beacon Pairing (Indoor Geofencing) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <Wifi size={13} className="text-indigo-600" />
                        WiFi SSID Beacon (Optional)
                      </label>
                      <span className="text-[9px] text-slate-400 font-medium">Indoor Assist</span>
                    </div>
                    <input
                      type="text"
                      value={newZoneWifiSsid}
                      onChange={(e) => setNewZoneWifiSsid(e.target.value)}
                      placeholder="e.g. Campus_Library_5G or Office_HQ"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[9.5px] text-slate-400">Quick suggestions:</span>
                      {['Campus_Library_5G', 'Office_Work_5G', 'Home_Fiber'].map((ssid) => (
                        <button
                          key={ssid}
                          type="button"
                          onClick={() => setNewZoneWifiSsid(ssid)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9.5px] font-mono transition"
                        >
                          {ssid}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Zone Placement</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setPlacementType('current'); setCustomZoneCoords(null); }}
                        className={`p-3 rounded-xl border text-left transition ${placementType === 'current' && !customZoneCoords ? 'bg-indigo-50/80 border-indigo-600 text-indigo-900' : 'bg-white border-slate-200 text-slate-700'}`}
                      >
                        <p className="font-bold text-xs flex items-center gap-1">
                          <MapPin size={12} className="text-indigo-600" />
                          My Current Spot
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Turns DND on right now</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPlacementType('ahead'); setCustomZoneCoords(null); }}
                        className={`p-3 rounded-xl border text-left transition ${placementType === 'ahead' && !customZoneCoords ? 'bg-indigo-50/80 border-indigo-600 text-indigo-900' : 'bg-white border-slate-200 text-slate-700'}`}
                      >
                        <p className="font-bold text-xs flex items-center gap-1">
                          <Footprints size={12} className="text-indigo-600" />
                          ~200m Ahead
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Offset 200m from current spot</p>
                      </button>
                    </div>
                  </div>
                  
                  {/* Smart Modes Selector (College, Library, Hospital, Meeting, Custom) */}
                  <SmartModesSelector
                    selectedMode={selectedSmartMode}
                    onSelectMode={(mode, suggestedRadius) => {
                      setSelectedSmartMode(mode);
                      setNewZoneRadius(String(suggestedRadius));
                      const preset = SMART_MODE_PRESETS.find(p => p.id === mode);
                      if (preset) {
                        setNewZoneSilenceMode(preset.silenceMode);
                        if (!newZoneName) {
                          setNewZoneName(preset.name.replace(' Mode', ''));
                        }
                      }
                    }}
                  />

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Perimeter Radius</label>
                      <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{newZoneRadius} meters</span>
                    </div>

                    {/* Quick Radius Selection (50m, 100m, 200m, 500m) */}
                    <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                      {[50, 100, 200, 500].map((rad) => (
                        <button
                          key={rad}
                          type="button"
                          onClick={() => setNewZoneRadius(String(rad))}
                          className={`py-1.5 rounded-xl text-xs font-bold font-mono transition cursor-pointer border ${
                            parseInt(newZoneRadius, 10) === rad
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {rad}m
                        </button>
                      ))}
                    </div>

                    <input 
                      type="range" 
                      min="50" max="600" step="25"
                      value={newZoneRadius}
                      onChange={(e) => setNewZoneRadius(e.target.value)}
                      className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-medium">
                      <span>50m (Room)</span>
                      <span>200m (Building)</span>
                      <span>600m (Campus)</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-100">
                  <button 
                    onClick={handleAddZone}
                    disabled={!newZoneName.trim() || !location}
                    className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm active:scale-98"
                  >
                    Activate Silent Zone
                  </button>
                </div>
              </motion.div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && !isAddingZone && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                className="p-5 space-y-4"
              >
                <h2 className="text-xl font-bold text-slate-900 mb-1">Automation Settings</h2>
                <p className="text-xs text-slate-500 mb-4">Configure automatic DND behavior & feedback</p>
                
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Automations</h3>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Auto-DND on Zone Entry</p>
                      <p className="text-xs text-slate-500">Mute ringer when entering zone perimeter</p>
                    </div>
                    <button 
                      onClick={() => setAutoDndEnabled(!autoDndEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${autoDndEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <motion.div 
                        layout
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 ${autoDndEnabled ? 'right-1' : 'left-1'}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Audio & Vibration Feedback</p>
                      <p className="text-xs text-slate-500">Chime when DND turns on/off automatically</p>
                    </div>
                    <button 
                      onClick={() => setSoundFeedbackEnabled(!soundFeedbackEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${soundFeedbackEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <motion.div 
                        layout
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 ${soundFeedbackEnabled ? 'right-1' : 'left-1'}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Heads-Up Android Alerts</p>
                      <p className="text-xs text-slate-500">Show push banner when entering or exiting</p>
                    </div>
                    <button 
                      onClick={() => setHeadsUpAlertsEnabled(!headsUpAlertsEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${headsUpAlertsEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <motion.div 
                        layout
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 ${headsUpAlertsEnabled ? 'right-1' : 'left-1'}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Visual Map Theme Selector Card */}
                <MapThemeSelectorCard
                  currentTheme={mapTheme}
                  onChange={setMapTheme}
                />

                {/* Visual Time-Based Override (Global Quiet Hours) Card */}
                <TimeOverrideCard
                  schedule={timeOverride}
                  onChange={setTimeOverride}
                  isCurrentlyActive={isScheduleActive}
                />

                {/* Entry Dwell Time Delay Card */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Timer size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Entry Dwell Time Delay</h3>
                        <p className="text-xs text-slate-500">Anti-flicker delay for brief pass-throughs</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                      dwellTimeSeconds > 0 
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {dwellTimeSeconds > 0 ? `${dwellTimeSeconds}s Active` : 'Instant (Off)'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Prevents DND from toggling when you quickly walk or commute past a zone. DND only triggers after you have continuously remained inside for the selected duration.
                  </p>

                  {/* Slider & Controls */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Dwell Delay Duration</span>
                      <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {dwellTimeSeconds === 0 ? '0s (Instant)' : `${dwellTimeSeconds} seconds`}
                      </span>
                    </div>

                    <input 
                      type="range"
                      min="0"
                      max="60"
                      step="5"
                      value={dwellTimeSeconds}
                      onChange={(e) => handleUpdateDwellTime(parseInt(e.target.value, 10) || 0)}
                      className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>0s (Instant)</span>
                      <span>15s (Optimal)</span>
                      <span>30s</span>
                      <span>60s (Max)</span>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {[
                        { label: 'Instant', value: 0 },
                        { label: '10s', value: 10 },
                        { label: '15s (Rec)', value: 15 },
                        { label: '30s', value: 30 },
                      ].map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => handleUpdateDwellTime(p.value)}
                          className={`py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                            dwellTimeSeconds === p.value
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Real-time description box */}
                  <div className="text-[11px] p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 flex items-start gap-2">
                    <ShieldCheck size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      {dwellTimeSeconds === 0 ? (
                        <>⚡ <strong>Instant Mode:</strong> Do Not Disturb will trigger immediately the moment your GPS enters any zone perimeter.</>
                      ) : (
                        <>🛡️ <strong>Pass-Through Filter:</strong> You must stay <strong>{dwellTimeSeconds} seconds</strong> inside the perimeter before DND activates. If you exit earlier, DND is cancelled with zero toggles.</>
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDwellModalOpen(true)}
                    className="w-full py-2 bg-slate-100 hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Sliders size={13} />
                    Open Detailed Dwell Configurator
                  </button>
                </div>

                {/* Indoor Classroom Anti-Drift Guard Card */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Classroom Anti-Drift Guard</h3>
                        <p className="text-xs text-slate-500">Prevent indoor GPS jumps from unmuting DND</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      ANTI-DRIFT ON
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Classrooms, lecture halls, and concrete buildings cause GPS multipath bounce and sudden coordinate jumps outside the radius. These shields keep your ringer silent and prevent accidental unmutes.
                  </p>

                  {/* Toggle 1: Classroom Drift Lock */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Lock size={12} className="text-emerald-600" />
                        Classroom Coordinate Anchor
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Locks coordinates to classroom center when inside to absorb indoor jitter
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleClassroomLockPref(!classroomLockEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        classroomLockEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <motion.div
                        layout
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 ${
                          classroomLockEnabled ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Slider: Exit Verification Grace Period */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Exit Verification Grace Period</span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {exitGraceSeconds === 0 ? '0s (Instant Unmute)' : `${exitGraceSeconds}s Grace`}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="5"
                      value={exitGraceSeconds}
                      onChange={(e) => handleUpdateExitGrace(parseInt(e.target.value, 10) || 0)}
                      className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>0s (Instant)</span>
                      <span>15s</span>
                      <span>25s (Recommended)</span>
                      <span>60s</span>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {[
                        { label: 'Instant', value: 0 },
                        { label: '15s', value: 15 },
                        { label: '25s (Rec)', value: 25 },
                        { label: '45s', value: 45 },
                      ].map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => handleUpdateExitGrace(p.value)}
                          className={`py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                            exitGraceSeconds === p.value
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggle 3: Filter Coarse Indoor Fixes */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Filter Inaccurate GPS Fixes (&gt;65m)</p>
                      <p className="text-[11px] text-slate-500">
                        Discards wildly inaccurate cell tower fixes when inside lecture halls
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFilterCoarseGps(!filterCoarseGps)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        filterCoarseGps ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <motion.div
                        layout
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 ${
                          filterCoarseGps ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Emergency VIP Breakthrough & Repeat Callers Card */}
                <EmergencyBypassCard
                  config={emergencyConfig}
                  onChange={handleUpdateEmergencyConfig}
                  onSimulateCall={triggerSimulateCall}
                  isInbuiltApk={inbuiltApkMode}
                  emergencyCallGranted={Boolean(inbuiltDndStatus?.emergencyCallGranted)}
                  onRequestEmergencyPermission={() => {
                    requestInbuiltEmergencyCallPermissions();
                    setTimeout(() => setInbuiltDndStatus(getInbuiltDndStatus()), 400);
                  }}
                />

                {/* Built-in Phone DND & Vibration Controls */}
                <PhoneHardwareCard
                  config={phoneBridgeConfig}
                  onOpenModal={() => setIsPhoneBridgeModalOpen(true)}
                  onTestBridge={(turnOn, mode) => triggerPhoneHardwareSync(turnOn, 'Settings Test', mode || defaultRadiusMode)}
                  isInbuiltApk={inbuiltApkMode}
                  inbuiltDndStatus={inbuiltDndStatus}
                  onRequestInbuiltDndPermission={() => {
                    requestInbuiltDndPermission();
                    setTimeout(() => setInbuiltDndStatus(getInbuiltDndStatus()), 300);
                  }}
                />

                {/* Backup & Data Card */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Zone Data & Backup</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{zones.length} saved silent {zones.length === 1 ? 'location' : 'locations'}</p>
                    </div>
                    <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold border border-indigo-100">
                      JSON v1.0
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      id="settings-export-zones-btn"
                      onClick={() => {
                        setBackupModalTab('export');
                        setIsBackupModalOpen(true);
                      }}
                      className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-xl text-left transition group active:scale-98"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2 group-hover:bg-indigo-600 group-hover:text-white transition shadow-2xs">
                        <Download size={16} />
                      </div>
                      <p className="text-xs font-bold text-slate-800">Export Backup</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Save as .json file</p>
                    </button>

                    <button
                      id="settings-import-zones-btn"
                      onClick={() => {
                        setBackupModalTab('import');
                        setIsBackupModalOpen(true);
                      }}
                      className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-xl text-left transition group active:scale-98"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2 group-hover:bg-indigo-600 group-hover:text-white transition shadow-2xs">
                        <Upload size={16} />
                      </div>
                      <p className="text-xs font-bold text-slate-800">Import Backup</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Load or merge JSON</p>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* AI DISCOVERY TAB */}
            {activeTab === 'discover' && !isAddingZone && (
              <motion.div
                key="discover-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col"
              >
                <QuietPlaceDiscoveryModal
                  isOpen={true}
                  currentLat={location?.lat ?? 37.7750}
                  currentLng={location?.lng ?? -122.4194}
                  existingZones={zones}
                  onAddZone={handleAddZoneFromDiscoveredPlace}
                  isEmbeddedTab={true}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className="bg-white border-t border-slate-200 pb-safe pt-2 px-4 absolute bottom-0 w-full z-20 rounded-b-[2.5rem]">
          <div className="flex justify-between items-center mb-3">
            <button 
              onClick={() => { setActiveTab('home'); setIsAddingZone(false); }}
              className={`flex flex-col items-center gap-1 w-14 transition ${activeTab === 'home' && !isAddingZone ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'home' && !isAddingZone ? 'bg-indigo-50' : 'bg-transparent'}`}>
                <Home size={20} />
              </div>
              <span className="text-[10px] font-semibold">Home</span>
            </button>
            <button 
              onClick={() => { setActiveTab('zones'); setIsAddingZone(false); }}
              className={`flex flex-col items-center gap-1 w-14 transition ${activeTab === 'zones' && !isAddingZone ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'zones' && !isAddingZone ? 'bg-indigo-50' : 'bg-transparent'}`}>
                <MapPin size={20} />
              </div>
              <span className="text-[10px] font-semibold">Zones</span>
            </button>
            <button 
              id="bottom-nav-discover-tab-btn"
              onClick={() => { setActiveTab('discover'); setIsAddingZone(false); }}
              className={`flex flex-col items-center gap-1 w-14 transition ${activeTab === 'discover' && !isAddingZone ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'discover' && !isAddingZone ? 'bg-indigo-50' : 'bg-transparent'}`}>
                <Compass size={20} />
              </div>
              <span className="text-[10px] font-semibold">Discover</span>
            </button>
            <button 
              onClick={() => { setActiveTab('settings'); setIsAddingZone(false); }}
              className={`flex flex-col items-center gap-1 w-14 transition ${activeTab === 'settings' && !isAddingZone ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'settings' && !isAddingZone ? 'bg-indigo-50' : 'bg-transparent'}`}>
                <Settings size={20} />
              </div>
              <span className="text-[10px] font-semibold">Settings</span>
            </button>
          </div>
          {/* Home indicator bar for modern Android */}
          <div className="w-1/3 h-1 bg-slate-300 rounded-full mx-auto mb-1.5" />
        </nav>

        {/* JSON Backup & Restore Modal */}
        <ZoneBackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          zones={zones}
          onImportZones={handleImportZones}
          initialTab={backupModalTab}
        />

        {/* Quick Perimeter / Radius Adjustment Modal */}
        <EditRadiusModal
          isOpen={!!editingRadiusZone}
          zone={editingRadiusZone ? sortedZones.find((z) => z.id === editingRadiusZone.id) || editingRadiusZone : null}
          userLocation={location}
          mapTheme={mapTheme}
          onClose={() => setEditingRadiusZone(null)}
          onSave={handleUpdateZoneRadius}
        />

        {/* Entry Dwell Time Delay Modal */}
        <DwellTimeModal
          isOpen={isDwellModalOpen}
          dwellTimeSeconds={dwellTimeSeconds}
          onClose={() => setIsDwellModalOpen(false)}
          onSave={handleUpdateDwellTime}
        />

        {/* Quick Mute Modal (Instant Timed Silence without Geofence) */}
        <QuickMuteModal
          isOpen={isQuickMuteModalOpen}
          onClose={() => setIsQuickMuteModalOpen(false)}
          onStart={startQuickMute}
        />

        {/* Google Maps Quiet Place Discovery Modal (Popup Mode) */}
        <QuietPlaceDiscoveryModal
          isOpen={isDiscoveryModalOpen}
          onClose={() => setIsDiscoveryModalOpen(false)}
          currentLat={location?.lat ?? 37.7750}
          currentLng={location?.lng ?? -122.4194}
          existingZones={zones}
          onAddZone={(newZone) => {
            handleAddZoneFromDiscoveredPlace(newZone);
            setIsDiscoveryModalOpen(false);
          }}
          isEmbeddedTab={false}
        />

        {/* Incoming Emergency VIP Breakthrough Call Modal */}
        <IncomingCallModal
          isOpen={incomingCallState.isOpen}
          caller={incomingCallState.caller}
          isRepeatCaller={incomingCallState.isRepeatCaller}
          onAnswer={() => {
            setIncomingCallState({ isOpen: false, caller: null, isRepeatCaller: false });
            setNotification({
              id: Date.now().toString(),
              title: 'Emergency Call Answered',
              message: `Call with ${incomingCallState.caller?.name || 'VIP'} connected.`,
              type: 'normal',
            });
          }}
          onDecline={() => {
            setIncomingCallState({ isOpen: false, caller: null, isRepeatCaller: false });
          }}
        />

        {/* Built-in Phone Hardware Bridge Modal */}
        <PhoneHardwareBridgeModal
          isOpen={isPhoneBridgeModalOpen}
          onClose={() => setIsPhoneBridgeModalOpen(false)}
          config={phoneBridgeConfig}
          onSaveConfig={handleSavePhoneBridgeConfig}
          onTestBridge={(turnOn) => triggerPhoneHardwareSync(turnOn, 'Modal Test', defaultRadiusMode)}
          isInbuiltApk={inbuiltApkMode}
          inbuiltDndStatus={inbuiltDndStatus}
          onRequestInbuiltDndPermission={() => {
            requestInbuiltDndPermission();
            setTimeout(() => setInbuiltDndStatus(getInbuiltDndStatus()), 300);
          }}
        />
          </div>
        </div>
      </div>
    </MapsProviderWrapper>
  );
}
