import { Zone, ZoneBackupData, ZoneStatistic, TimeScheduleOverride } from './types';

/**
 * Formats a duration in seconds into a human-friendly string (e.g., '45m', '2h 15m', '< 1m').
 */
export function formatDurationSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 1) return '< 1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Computes visit summary metrics and average duration for each zone.
 */
export function computeZoneStatistics(zones: Zone[]): ZoneStatistic[] {
  return zones.map((z) => {
    const visits = typeof z.totalVisits === 'number' && z.totalVisits >= 0 ? z.totalVisits : 0;
    const durationSeconds = typeof z.totalDurationSeconds === 'number' && z.totalDurationSeconds >= 0 ? z.totalDurationSeconds : 0;
    const durationMinutes = Math.round(durationSeconds / 60);
    const avgMinutes = visits > 0 ? Math.round((durationSeconds / visits) / 60) : 0;

    return {
      id: z.id,
      name: z.name,
      totalVisits: visits,
      totalDurationSeconds: durationSeconds,
      totalDurationMinutes: durationMinutes,
      averageDurationMinutes: avgMinutes,
      averageDurationFormatted: formatDurationSeconds(avgMinutes * 60),
      totalDurationFormatted: formatDurationSeconds(durationSeconds),
      enabled: z.enabled,
    };
  });
}

/**
 * Calculates the distance between two coordinates in meters using the Haversine formula.
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Plays a subtle synthesized tone for DND state changes without external audio dependencies.
 */
export function playDndChime(type: 'silent' | 'normal' | 'vibrate' | 'priority' | 'ring'): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'silent') {
      // Gentle downward two-tone for entering DND
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'vibrate') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'priority') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'ring') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(853, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else {
      // Gentle upward tone for exiting DND / restoring normal ringer
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Audio contexts may be blocked before first user interaction
  }

  // Trigger haptic vibration if supported
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      if (type === 'silent') {
        navigator.vibrate([100, 60, 100]);
      } else if (type === 'vibrate') {
        navigator.vibrate([180, 80, 180, 80, 220]);
      } else if (type === 'ring') {
        navigator.vibrate([350, 150, 350, 150, 400]);
      } else {
        navigator.vibrate([70]);
      }
    } catch {
      // Ignore vibration errors
    }
  }
}

/**
 * Computes a coordinate strictly outside a given zone perimeter.
 */
export function getCoordinateOutsideZone(zone: Zone, marginMeters = 80): { lat: number; lng: number } {
  const distanceNeeded = zone.radius + marginMeters;
  const latOffset = distanceNeeded / 111320;
  const lngOffset = distanceNeeded / (111320 * Math.cos((zone.lat * Math.PI) / 180));
  return {
    lat: zone.lat + latOffset,
    lng: zone.lng + lngOffset,
  };
}

/**
 * Computes a coordinate that is guaranteed to be outside all defined zones.
 */
export function getCoordinateOutsideAllZones(zones: Zone[], marginMeters = 150): { lat: number; lng: number } {
  if (zones.length === 0) {
    return { lat: 37.7750, lng: -122.4194 };
  }
  let maxLat = -90;
  let maxLng = -180;
  let maxRadius = 100;

  for (const z of zones) {
    if (z.lat > maxLat) maxLat = z.lat;
    if (z.lng > maxLng) maxLng = z.lng;
    if (z.radius > maxRadius) maxRadius = z.radius;
  }

  const offsetMeters = maxRadius + marginMeters;
  const latOffset = offsetMeters / 111320;
  const lngOffset = offsetMeters / (111320 * Math.cos((maxLat * Math.PI) / 180));

  return {
    lat: maxLat + latOffset,
    lng: maxLng + lngOffset,
  };
}

/**
 * Creates a structured JSON backup payload of all saved silent zones.
 */
export function createZoneExportPayload(zones: Zone[]): ZoneBackupData {
  return {
    app: 'Smart Silent Zone',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    totalZones: zones.length,
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      lat: z.lat,
      lng: z.lng,
      radius: z.radius,
      enabled: z.enabled ?? true,
      icon: z.icon,
      totalVisits: z.totalVisits ?? 0,
      totalDurationSeconds: z.totalDurationSeconds ?? 0,
    })),
  };
}

/**
 * Triggers a browser download of formatted JSON data.
 */
export function downloadJsonFile(filename: string, data: unknown): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type ParseZoneResult = {
  success: boolean;
  zones?: Zone[];
  totalParsed?: number;
  error?: string;
};

/**
 * Parses and validates raw JSON input (file content or pasted text) for zones.
 * Supports both structured backups ({ version, zones: [...] }) and direct zone arrays ([...]).
 */
export function parseAndValidateZonesJson(rawText: string): ParseZoneResult {
  if (!rawText || !rawText.trim()) {
    return { success: false, error: 'Input is empty. Please provide JSON content.' };
  }

  try {
    const parsed = JSON.parse(rawText);
    let candidateList: unknown[];

    if (Array.isArray(parsed)) {
      candidateList = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { zones?: unknown[] }).zones)) {
      candidateList = (parsed as { zones: unknown[] }).zones;
    } else {
      return {
        success: false,
        error: 'JSON must either be an array of zones or contain a "zones" list property.',
      };
    }

    if (candidateList.length === 0) {
      return { success: false, error: 'The provided JSON contains 0 zone records.' };
    }

    const validZones: Zone[] = [];
    for (let i = 0; i < candidateList.length; i++) {
      const item = candidateList[i] as Partial<Zone>;
      if (!item || typeof item !== 'object') {
        return { success: false, error: `Item at index ${i} is not a valid zone object.` };
      }

      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `Zone ${i + 1}`;
      const lat = typeof item.lat === 'number' && !isNaN(item.lat) && item.lat >= -90 && item.lat <= 90 ? item.lat : null;
      const lng = typeof item.lng === 'number' && !isNaN(item.lng) && item.lng >= -180 && item.lng <= 180 ? item.lng : null;
      const radius = typeof item.radius === 'number' && !isNaN(item.radius) && item.radius > 0 ? Math.round(item.radius) : 100;
      const enabled = item.enabled !== false;
      const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `zone_${Date.now()}_${i}`;
      const totalVisits = typeof item.totalVisits === 'number' && !isNaN(item.totalVisits) && item.totalVisits >= 0 ? Math.round(item.totalVisits) : 0;
      const totalDurationSeconds = typeof item.totalDurationSeconds === 'number' && !isNaN(item.totalDurationSeconds) && item.totalDurationSeconds >= 0 ? Math.round(item.totalDurationSeconds) : 0;

      if (lat === null || lng === null) {
        return {
          success: false,
          error: `Zone "${name}" (item ${i + 1}) is missing valid latitude (-90 to 90) or longitude (-180 to 180).`,
        };
      }

      validZones.push({
        id,
        name,
        lat,
        lng,
        radius,
        enabled,
        icon: typeof item.icon === 'string' ? item.icon : undefined,
        totalVisits,
        totalDurationSeconds,
      });
    }

    if (validZones.length === 0) {
      return { success: false, error: 'No valid zones could be found in the provided JSON.' };
    }

    return { success: true, zones: validZones, totalParsed: validZones.length };
  } catch (err) {
    return { success: false, error: `Invalid JSON syntax: ${(err as Error).message}` };
  }
}

/**
 * Parses "HH:MM" string to minutes from midnight (0 - 1439).
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return (h % 24) * 60 + (m % 60);
}

/**
 * Formats "HH:MM" or hour & minute into standard 12-hour AM/PM string (e.g. "11:00 PM").
 */
export function formatTimeTo12Hour(timeStr: string): string {
  if (!timeStr) return '';
  const totalMin = parseTimeToMinutes(timeStr);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Calculates duration in hours between start and end time.
 */
export function getScheduleDurationHours(startTime: string, endTime: string): number {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  let diffMin = endMin - startMin;
  if (diffMin <= 0) {
    diffMin += 24 * 60;
  }
  return Number((diffMin / 60).toFixed(1));
}

/**
 * Determines whether current time falls within active global schedule window.
 */
export function isScheduleActiveNow(schedule: TimeScheduleOverride, now: Date = new Date()): boolean {
  if (!schedule.enabled) return false;
  if (schedule.testForceActive) return true;

  const startMin = parseTimeToMinutes(schedule.startTime);
  const endMin = parseTimeToMinutes(schedule.endTime);
  const curMin = now.getHours() * 60 + now.getMinutes();

  const selectedDays = Array.isArray(schedule.days) ? schedule.days : [0, 1, 2, 3, 4, 5, 6];
  if (selectedDays.length === 0) return false;

  // Case 1: Start and End are same -> full 24h
  if (startMin === endMin) {
    return selectedDays.includes(now.getDay());
  }

  // Case 2: Schedule within the same day (e.g. 09:00 to 17:00)
  if (startMin < endMin) {
    const isWithin = curMin >= startMin && curMin < endMin;
    return isWithin && selectedDays.includes(now.getDay());
  }

  // Case 3: Schedule crosses midnight (e.g. 23:00 to 07:00)
  if (curMin >= startMin) {
    // Current time is between start (e.g. 23:00) and midnight (23:59)
    return selectedDays.includes(now.getDay());
  }

  if (curMin < endMin) {
    // Current time is between midnight (00:00) and end (e.g. 07:00)
    const yesterday = (now.getDay() + 6) % 7;
    return selectedDays.includes(yesterday);
  }

  return false;
}

