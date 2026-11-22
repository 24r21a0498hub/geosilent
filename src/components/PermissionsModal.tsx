import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  X,
  MapPin,
  Bell,
  Volume2,
  BellOff,
  PhoneCall,
  BatteryCharging,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import {
  InbuiltDndStatus,
  requestInbuiltLocationPermissions,
  requestInbuiltDndPermission,
  requestInbuiltEmergencyCallPermissions,
  requestInbuiltBatteryExemption,
} from '../utils/nativeDndBridge';

export type SimplePermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInbuiltApk: boolean;
  inbuiltDndStatus: InbuiltDndStatus | null;
  browserGeoPermission: SimplePermissionState;
  browserNotifPermission: SimplePermissionState;
  audioUnlocked: boolean;
  onRequestAllPermissions: () => Promise<void> | void;
  onRequestBrowserGeo: () => void;
  onRequestBrowserNotif: () => void;
  onUnlockAudio: () => void;
  onOpenApkSetup: () => void;
  onRefreshStatus: () => void;
}

const PermissionsModal: React.FC<PermissionsModalProps> = ({
  isOpen,
  onClose,
  isInbuiltApk,
  inbuiltDndStatus,
  browserGeoPermission,
  browserNotifPermission,
  audioUnlocked,
  onRequestAllPermissions,
  onRequestBrowserGeo,
  onRequestBrowserNotif,
  onUnlockAudio,
  onOpenApkSetup,
  onRefreshStatus,
}) => {
  const locationGranted = isInbuiltApk
    ? Boolean(inbuiltDndStatus?.locationGranted)
    : browserGeoPermission === 'granted';

  const bgLocationGranted = isInbuiltApk
    ? Boolean(inbuiltDndStatus?.backgroundLocationGranted)
    : false;

  const notifGranted = isInbuiltApk
    ? Boolean(inbuiltDndStatus?.notificationsGranted)
    : browserNotifPermission === 'granted';

  const dndGranted = isInbuiltApk ? Boolean(inbuiltDndStatus?.granted) : false;
  const emergencyCallGranted = isInbuiltApk ? Boolean(inbuiltDndStatus?.emergencyCallGranted) : false;
  const batteryGranted = isInbuiltApk ? Boolean(inbuiltDndStatus?.batteryUnrestricted) : false;

  const totalItems = isInbuiltApk ? 6 : 5;
  const grantedCount = isInbuiltApk
    ? [
        locationGranted && bgLocationGranted,
        notifGranted,
        audioUnlocked,
        dndGranted,
        emergencyCallGranted,
        batteryGranted,
      ].filter(Boolean).length
    : [locationGranted, notifGranted, audioUnlocked].filter(Boolean).length;

  const allBrowserReady = !isInbuiltApk && locationGranted && notifGranted && audioUnlocked;
  const allApkReady =
    isInbuiltApk &&
    locationGranted &&
    bgLocationGranted &&
    notifGranted &&
    dndGranted &&
    emergencyCallGranted &&
    batteryGranted;

  const renderBadge = (granted: boolean, denied?: boolean, apkOnlyInBrowser?: boolean) => {
    if (granted) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
          <CheckCircle2 size={11} /> Granted
        </span>
      );
    }
    if (apkOnlyInBrowser) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
          <Smartphone size={11} /> Android App
        </span>
      );
    }
    if (denied) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
          <AlertTriangle size={11} /> Blocked
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
        <ShieldAlert size={11} /> Pending
      </span>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4"
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[400px] max-h-[90vh] bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/25 border border-indigo-400/40 flex items-center justify-center text-indigo-200 shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                    Permissions Center
                    <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-full text-indigo-200">
                      {grantedCount}/{totalItems}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    {isInbuiltApk
                      ? 'Grant all inbuilt Android OS permissions (zero 3rd-party apps).'
                      : 'Allow browser GPS, alerts, and sound now — or pair the Native Android app for OS DND.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
                aria-label="Close permissions center"
              >
                <X size={16} />
              </button>
            </div>

            {/* Permission List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {/* 1. Location & Background Geofencing */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {isInbuiltApk ? 'Location (Foreground + All the Time)' : 'GPS Location Tracking'}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {isInbuiltApk
                          ? bgLocationGranted
                            ? 'Precise & background location enabled for screen-locked zones.'
                            : locationGranted
                            ? 'Foreground GPS allowed. Tap Allow to set "Allow all the time".'
                            : 'Detects when you walk into classrooms, libraries, and quiet zones.'
                          : browserGeoPermission === 'denied'
                          ? 'Blocked in browser site settings. Click lock icon in address bar to allow.'
                          : 'Detects your current location & saved quiet zone distance.'}
                      </p>
                    </div>
                  </div>
                  {renderBadge(
                    isInbuiltApk ? locationGranted && bgLocationGranted : locationGranted,
                    !isInbuiltApk && browserGeoPermission === 'denied'
                  )}
                </div>
                {!(isInbuiltApk ? locationGranted && bgLocationGranted : locationGranted) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isInbuiltApk) {
                        requestInbuiltLocationPermissions();
                        setTimeout(onRefreshStatus, 400);
                      } else {
                        onRequestBrowserGeo();
                      }
                    }}
                    className="w-full py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition cursor-pointer"
                  >
                    {isInbuiltApk && locationGranted ? 'Allow Background Location' : 'Allow Location Access'}
                  </button>
                )}
              </div>

              {/* 2. Notifications */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Bell size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Zone Entry &amp; Exit Notifications</p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {browserNotifPermission === 'denied' && !isInbuiltApk
                          ? 'Blocked in browser site settings. Enable Notifications in site permissions.'
                          : 'Alerts you when silent mode activates, restores, or an emergency contact calls.'}
                      </p>
                    </div>
                  </div>
                  {renderBadge(notifGranted, !isInbuiltApk && browserNotifPermission === 'denied')}
                </div>
                {!notifGranted && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isInbuiltApk) {
                        requestInbuiltLocationPermissions();
                        setTimeout(onRefreshStatus, 400);
                      } else {
                        onRequestBrowserNotif();
                      }
                    }}
                    className="w-full py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 transition cursor-pointer"
                  >
                    Allow Notifications
                  </button>
                )}
              </div>

              {/* 3. Audio Chime & Emergency Ring */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Volume2 size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Alert Sound &amp; Emergency Ringtone</p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Unlocks browser Web Audio so emergency contact test rings &amp; DND chimes play out loud.
                      </p>
                    </div>
                  </div>
                  {renderBadge(audioUnlocked)}
                </div>
                {!audioUnlocked && (
                  <button
                    type="button"
                    onClick={onUnlockAudio}
                    className="w-full py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 transition cursor-pointer"
                  >
                    Enable Sound &amp; Ring Audio
                  </button>
                )}
              </div>

              {/* 4. Inbuilt Android DND Policy Access */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <BellOff size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Inbuilt Android DND Policy Access</p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {isInbuiltApk
                          ? 'Controls your hardware NotificationManager directly (no 3rd-party apps).'
                          : 'Browsers cannot toggle phone OS Do Not Disturb. Pair the Android Companion app.'}
                      </p>
                    </div>
                  </div>
                  {renderBadge(dndGranted, false, !isInbuiltApk)}
                </div>
                {!dndGranted && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isInbuiltApk) {
                        requestInbuiltDndPermission();
                        setTimeout(onRefreshStatus, 400);
                      } else {
                        onOpenApkSetup();
                      }
                    }}
                    className="w-full py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-bold border border-purple-200 transition cursor-pointer"
                  >
                    {isInbuiltApk ? 'Grant Inbuilt DND Access' : 'Open Native Android Companion'}
                  </button>
                )}
              </div>

              {/* 5. Emergency Contact Call Breakthrough */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                      <PhoneCall size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Emergency Contact Ring-Through</p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {isInbuiltApk
                          ? 'READ_PHONE_STATE & READ_CALL_LOG let saved emergency numbers ring aloud during DND.'
                          : 'Available in the Native Android Companion so family/doctors bypass DND.'}
                      </p>
                    </div>
                  </div>
                  {renderBadge(emergencyCallGranted, false, !isInbuiltApk)}
                </div>
                {!emergencyCallGranted && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isInbuiltApk) {
                        requestInbuiltEmergencyCallPermissions();
                        setTimeout(onRefreshStatus, 400);
                      } else {
                        onOpenApkSetup();
                      }
                    }}
                    className="w-full py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-200 transition cursor-pointer"
                  >
                    {isInbuiltApk ? 'Allow Phone & Call Log' : 'Pair Android App for Call Ring-Through'}
                  </button>
                )}
              </div>

              {/* 6. Battery Unrestricted (APK) */}
              {isInbuiltApk && (
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                        <BatteryCharging size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Unrestricted Background Battery</p>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          Prevents Android Doze from pausing geofencing while your screen is locked.
                        </p>
                      </div>
                    </div>
                    {renderBadge(batteryGranted)}
                  </div>
                  {!batteryGranted && (
                    <button
                      type="button"
                      onClick={() => {
                        requestInbuiltBatteryExemption();
                        setTimeout(onRefreshStatus, 500);
                      }}
                      className="w-full py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold border border-teal-200 transition cursor-pointer"
                    >
                      Allow Unrestricted Battery
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-200 space-y-2">
              {!(isInbuiltApk ? allApkReady : allBrowserReady) ? (
                <button
                  type="button"
                  onClick={onRequestAllPermissions}
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
                >
                  <Sparkles size={15} />
                  {isInbuiltApk ? 'Allow All Android Permissions' : 'Allow All Browser Permissions'}
                </button>
              ) : (
                <div className="w-full py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={15} />
                  {isInbuiltApk ? 'All Inbuilt Android Permissions Granted!' : 'All Web Permissions Granted!'}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PermissionsModal;
