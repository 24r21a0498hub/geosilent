import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Zone, AndroidCompanionDevice, AndroidInterruptionFilter } from '../types';

export const PAIRING_STORAGE_KEY = 'geosilent_pairing_code_v1';
export const DEVICE_ID_STORAGE_KEY = 'geosilent_device_id_v1';

export function sanitizeFirestoreId(rawId: string, fallbackPrefix = 'item'): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

// Generate or retrieve persistent pairing code for the user
export function getOrCreatePairingInfo(): { deviceId: string; pairingCode: string } {
  let pairingCode = localStorage.getItem(PAIRING_STORAGE_KEY);
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (!pairingCode || !deviceId) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    pairingCode = `SILENT-${randomDigits}`;
    deviceId = sanitizeFirestoreId(`dev_${pairingCode.toLowerCase()}`, 'dev');
    localStorage.setItem(PAIRING_STORAGE_KEY, pairingCode);
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  } else {
    const safeDeviceId = sanitizeFirestoreId(deviceId, 'dev');
    if (safeDeviceId !== deviceId) {
      deviceId = safeDeviceId;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }
  }

  return { deviceId, pairingCode };
}

export function setCustomPairingCode(code: string): { deviceId: string; pairingCode: string } {
  const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  const finalCode = cleaned || 'SILENT-1001';
  const deviceId = sanitizeFirestoreId(`dev_${finalCode.toLowerCase()}`, 'dev');
  localStorage.setItem(PAIRING_STORAGE_KEY, finalCode);
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return { deviceId, pairingCode: finalCode };
}

// Ensure the device document is initialized in Firestore
export async function initializeDeviceDocument(deviceId: string, pairingCode: string): Promise<void> {
  const safeDeviceId = sanitizeFirestoreId(deviceId, 'dev');
  const path = `devices/${safeDeviceId}`;
  const deviceRef = doc(db, 'devices', safeDeviceId);
  try {
    await setDoc(
      deviceRef,
      {
        deviceId: safeDeviceId,
        pairingCode: String(pairingCode || 'SILENT-1001').slice(0, 32),
        deviceName: 'Android Phone (Pending Connection)',
        connected: false,
        lastHeartbeat: Date.now(),
        dndActive: false,
        interruptionFilter: 'ALL',
        permissionDndGranted: false,
        permissionBackgroundLocation: false,
        batteryLevel: 100,
        currentLatitude: 0,
        currentLongitude: 0,
        activeZoneName: '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Synchronize zones to Firestore subcollection /devices/{deviceId}/zones
export async function syncZonesToFirestore(deviceId: string, zones: Zone[]): Promise<boolean> {
  if (!deviceId) return false;
  const safeDeviceId = sanitizeFirestoreId(deviceId, 'dev');
  const collectionPath = `devices/${safeDeviceId}/zones`;
  try {
    const zonesColRef = collection(db, 'devices', safeDeviceId, 'zones');
    const zonesQuery = query(zonesColRef, where('deviceId', '==', safeDeviceId));

    // 1. Fetch current remote zones to clean up deleted ones
    const remoteSnapshot = await getDocs(zonesQuery);
    const localZoneIds = new Set(zones.map((z) => sanitizeFirestoreId(z.id, 'zone')));
    const batch = writeBatch(db);

    remoteSnapshot.forEach((docSnap) => {
      if (!localZoneIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    // 2. Set/update each local zone with validated bounds
    const nowIso = new Date().toISOString();
    for (const zone of zones) {
      const safeZoneId = sanitizeFirestoreId(zone.id, 'zone');
      const safeName = String(zone.name || 'Silent Zone').trim().slice(0, 128) || 'Silent Zone';
      const safeLat = Math.max(-90, Math.min(90, Number(zone.lat) || 0));
      const safeLng = Math.max(-180, Math.min(180, Number(zone.lng) || 0));
      const safeRadius = Math.max(10, Math.min(10000, Number(zone.radius) || 100));
      const safeMode = String(zone.mode || 'custom').slice(0, 32);

      const zoneDocRef = doc(db, 'devices', safeDeviceId, 'zones', safeZoneId);
      batch.set(
        zoneDocRef,
        {
          id: safeZoneId,
          deviceId: safeDeviceId,
          name: safeName,
          lat: safeLat,
          lng: safeLng,
          radius: safeRadius,
          mode: safeMode,
          enabled: zone.enabled !== false,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionPath);
  }
}

// Subscribe to real-time Android Companion Device state
export function subscribeToDeviceState(
  deviceId: string,
  onUpdate: (device: AndroidCompanionDevice | null) => void,
  onError?: (err: Error) => void
): () => void {
  const safeDeviceId = sanitizeFirestoreId(deviceId, 'dev');
  const path = `devices/${safeDeviceId}`;
  const deviceRef = doc(db, 'devices', safeDeviceId);

  const unsubscribe = onSnapshot(
    deviceRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const companion: AndroidCompanionDevice = {
          deviceId: data.deviceId || safeDeviceId,
          deviceName: data.deviceName || 'Android Companion',
          pairingCode: data.pairingCode || '',
          connected: Boolean(data.connected),
          lastHeartbeat: typeof data.lastHeartbeat === 'number' ? data.lastHeartbeat : Date.now(),
          dndActive: Boolean(data.dndActive),
          interruptionFilter: (data.interruptionFilter as AndroidInterruptionFilter) || 'ALL',
          permissionDndGranted: Boolean(data.permissionDndGranted),
          permissionBackgroundLocation: Boolean(data.permissionBackgroundLocation),
          batteryLevel: typeof data.batteryLevel === 'number' ? data.batteryLevel : 85,
          currentLatitude: typeof data.currentLatitude === 'number' ? data.currentLatitude : undefined,
          currentLongitude: typeof data.currentLongitude === 'number' ? data.currentLongitude : undefined,
          activeZoneName: data.activeZoneName || '',
          lastSyncTimestamp: typeof data.lastHeartbeat === 'number' ? data.lastHeartbeat : Date.now(),
          appVersion: data.appVersion || '1.0.0',
          monitoringEnabled: data.monitoringEnabled !== false,
        };
        onUpdate(companion);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrappedErr) {
        if (onError && wrappedErr instanceof Error) {
          onError(wrappedErr);
        }
      }
    }
  );

  return unsubscribe;
}

// Simulation helper to allow web users to preview and test the Android device connection
export async function simulateAndroidCompanionHeartbeat(
  deviceId: string,
  pairingCode: string,
  turnDndOn: boolean,
  activeZoneName?: string
): Promise<void> {
  const safeDeviceId = sanitizeFirestoreId(deviceId, 'dev');
  const path = `devices/${safeDeviceId}`;
  const deviceRef = doc(db, 'devices', safeDeviceId);
  try {
    await setDoc(
      deviceRef,
      {
        deviceId: safeDeviceId,
        pairingCode: String(pairingCode || 'SILENT-1001').slice(0, 32),
        connected: true,
        lastHeartbeat: Date.now(),
        deviceName: 'Pixel 8 Pro (Simulated Android)',
        dndActive: turnDndOn,
        interruptionFilter: turnDndOn ? 'PRIORITY' : 'ALL',
        permissionDndGranted: true,
        permissionBackgroundLocation: true,
        batteryLevel: 92,
        activeZoneName: String(activeZoneName || (turnDndOn ? 'Classroom' : '')).slice(0, 128),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
