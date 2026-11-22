import { EmergencyBypassConfig, SilenceMode, Zone } from '../types';

export interface InbuiltDndStatus {
  inbuilt: boolean;
  granted: boolean;
  dndActive: boolean;
  filterName: string;
  ringerMode: string;
  sdkInt?: number;
  monitoringEnabled?: boolean;
  locationGranted?: boolean;
  backgroundLocationGranted?: boolean;
  notificationsGranted?: boolean;
  batteryUnrestricted?: boolean;
  emergencyCallGranted?: boolean;
  emergencyContactsCount?: number;
}

export interface InbuiltDndActionResult {
  success: boolean;
  granted: boolean;
  dndActive: boolean;
  filterName?: string;
  ringerMode?: string;
}

interface AndroidNativeDndInterface {
  isInbuiltApk?: () => boolean;
  hasDndPermission?: () => boolean;
  isDndActive?: () => boolean;
  hasLocationPermissions?: () => boolean;
  hasBackgroundLocationPermission?: () => boolean;
  hasNotificationPermission?: () => boolean;
  hasBatteryOptimizationExemption?: () => boolean;
  hasEmergencyCallPermissions?: () => boolean;
  requestDndPermission?: () => void;
  requestLocationPermissions?: () => void;
  requestEmergencyCallPermissions?: () => void;
  requestBatteryOptimizationExemption?: () => void;
  requestAllInbuiltAccess?: () => void;
  getDndStatusJson?: () => string;
  setDndState?: (enable: boolean, silenceMode: string, zoneName: string) => string;
  syncZonesFromWeb?: (zonesJson: string) => boolean;
  syncEmergencyConfig?: (configJson: string) => boolean;
  getEmergencyConfigJson?: () => string;
  triggerEmergencyTestRing?: (contactName: string, phoneNumber: string) => boolean;
}

declare global {
  interface Window {
    AndroidNativeDnd?: AndroidNativeDndInterface;
  }
}

export function isInbuiltApkEnvironment(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.AndroidNativeDnd?.isInbuiltApk?.());
  } catch {
    return false;
  }
}

export function getInbuiltDndStatus(): InbuiltDndStatus | null {
  if (!isInbuiltApkEnvironment()) return null;
  try {
    const raw = window.AndroidNativeDnd?.getDndStatusJson?.();
    if (raw) {
      return JSON.parse(raw) as InbuiltDndStatus;
    }
  } catch {
    // Fallback to individual getters if JSON parse fails
  }
  return {
    inbuilt: true,
    granted: Boolean(window.AndroidNativeDnd?.hasDndPermission?.()),
    dndActive: Boolean(window.AndroidNativeDnd?.isDndActive?.()),
    filterName: 'NATIVE',
    ringerMode: 'UNKNOWN',
    locationGranted: Boolean(window.AndroidNativeDnd?.hasLocationPermissions?.()),
    backgroundLocationGranted: Boolean(window.AndroidNativeDnd?.hasBackgroundLocationPermission?.()),
    notificationsGranted: Boolean(window.AndroidNativeDnd?.hasNotificationPermission?.()),
    batteryUnrestricted: Boolean(window.AndroidNativeDnd?.hasBatteryOptimizationExemption?.()),
    emergencyCallGranted: Boolean(window.AndroidNativeDnd?.hasEmergencyCallPermissions?.()),
  };
}

export function requestInbuiltDndPermission(): boolean {
  if (!isInbuiltApkEnvironment()) return false;
  try {
    window.AndroidNativeDnd?.requestDndPermission?.();
    return true;
  } catch {
    return false;
  }
}

export function requestInbuiltLocationPermissions(): boolean {
  if (!isInbuiltApkEnvironment()) return false;
  try {
    window.AndroidNativeDnd?.requestLocationPermissions?.();
    return true;
  } catch {
    return false;
  }
}

export function requestInbuiltEmergencyCallPermissions(): boolean {
  if (!isInbuiltApkEnvironment()) return false;
  try {
    window.AndroidNativeDnd?.requestEmergencyCallPermissions?.();
    return true;
  } catch {
    return false;
  }
}

export function requestInbuiltBatteryExemption(): boolean {
  if (!isInbuiltApkEnvironment()) return false;
  try {
    window.AndroidNativeDnd?.requestBatteryOptimizationExemption?.();
    return true;
  } catch {
    return false;
  }
}

export function requestAllInbuiltAccess(): boolean {
  if (!isInbuiltApkEnvironment()) return false;
  try {
    if (window.AndroidNativeDnd?.requestAllInbuiltAccess) {
      window.AndroidNativeDnd.requestAllInbuiltAccess();
    } else {
      window.AndroidNativeDnd?.requestLocationPermissions?.();
      window.AndroidNativeDnd?.requestDndPermission?.();
    }
    return true;
  } catch {
    return false;
  }
}

export function setInbuiltDndState(
  enable: boolean,
  silenceMode: SilenceMode = 'silent',
  zoneName = 'Smart Silent Zone'
): InbuiltDndActionResult | null {
  if (!isInbuiltApkEnvironment()) return null;
  try {
    const raw = window.AndroidNativeDnd?.setDndState?.(enable, silenceMode, zoneName);
    if (raw) {
      return JSON.parse(raw) as InbuiltDndActionResult;
    }
  } catch (err) {
    console.warn('Inbuilt APK DND bridge error:', err);
  }
  return {
    success: false,
    granted: Boolean(window.AndroidNativeDnd?.hasDndPermission?.()),
    dndActive: Boolean(window.AndroidNativeDnd?.isDndActive?.()),
  };
}

export function syncZonesToInbuiltApk(zones: Zone[]): boolean {
  if (!isInbuiltApkEnvironment()) return false;
  try {
    const payload = zones.map((z) => ({
      id: z.id,
      name: z.name,
      lat: z.lat,
      lng: z.lng,
      radius: z.radius,
      mode: z.mode || 'custom',
      silenceMode: z.silenceMode || 'silent',
      enabled: z.enabled,
    }));
    return Boolean(window.AndroidNativeDnd?.syncZonesFromWeb?.(JSON.stringify(payload)));
  } catch (err) {
    console.warn('Failed syncing zones to inbuilt APK geofencer:', err);
    return false;
  }
}

export function syncEmergencyConfigToInbuiltApk(config: EmergencyBypassConfig): boolean {
  if (!isInbuiltApkEnvironment()) return false;
  try {
    const payload = {
      vipContactsEnabled: config.vipContactsEnabled,
      repeatCallersEnabled: config.repeatCallersEnabled,
      contacts: config.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        relation: c.relation,
      })),
    };
    return Boolean(window.AndroidNativeDnd?.syncEmergencyConfig?.(JSON.stringify(payload)));
  } catch (err) {
    console.warn('Failed syncing emergency contacts to inbuilt APK:', err);
    return false;
  }
}

export function triggerInbuiltEmergencyTestRing(contactName: string, phoneNumber: string): boolean {
  if (!isInbuiltApkEnvironment()) return false;
  try {
    return Boolean(window.AndroidNativeDnd?.triggerEmergencyTestRing?.(contactName, phoneNumber));
  } catch {
    return false;
  }
}
