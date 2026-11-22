import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Smartphone, 
  AlertTriangle, 
  Copy, 
  Check, 
  Battery, 
  RefreshCw, 
  X,
  Play,
  FileCode,
  Layers,
  Download,
  ShieldCheck,
  VolumeX
} from 'lucide-react';
import { AndroidCompanionDevice } from '../types';
import { InbuiltDndStatus } from '../utils/nativeDndBridge';

interface AndroidCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pairingCode: string;
  onUpdatePairingCode: (newCode: string) => void;
  device: AndroidCompanionDevice | null;
  onSimulateDeviceToggle?: (turnOn: boolean) => void;
  onManualSyncZones?: () => Promise<void>;
  isSyncing?: boolean;
  syncError?: string | null;
  isInbuiltApk?: boolean;
  inbuiltDndStatus?: InbuiltDndStatus | null;
  onRequestInbuiltDndPermission?: () => void;
  onRequestAllInbuiltAccess?: () => void;
}

export default function AndroidCompanionModal({
  isOpen,
  onClose,
  pairingCode,
  onUpdatePairingCode,
  device,
  onSimulateDeviceToggle,
  onManualSyncZones,
  isSyncing,
  syncError,
  isInbuiltApk = false,
  inbuiltDndStatus = null,
  onRequestInbuiltDndPermission,
  onRequestAllInbuiltAccess,
}: AndroidCompanionModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'install' | 'source'>('status');
  const [inputCode, setInputCode] = useState(pairingCode);
  const [isEditingCode, setIsEditingCode] = useState(false);

  useEffect(() => {
    setInputCode(pairingCode);
  }, [pairingCode]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCustomCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    onUpdatePairingCode(inputCode.trim());
    setIsEditingCode(false);
  };

  const isConnected = Boolean(isInbuiltApk || (device && device.connected));
  const isDndActive = isInbuiltApk
    ? Boolean(inbuiltDndStatus?.dndActive)
    : Boolean(device && device.dndActive);
  const hasDndPerm = isInbuiltApk
    ? Boolean(inbuiltDndStatus?.granted)
    : Boolean(device && device.permissionDndGranted);
  const hasLocPerm = isInbuiltApk
    ? Boolean(inbuiltDndStatus?.locationGranted)
    : Boolean(device && device.permissionBackgroundLocation);
  const hasEmergencyPerm = isInbuiltApk
    ? Boolean(inbuiltDndStatus?.emergencyCallGranted)
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center text-white shadow-inner">
              <Smartphone size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">
                  {isInbuiltApk ? 'Inbuilt Android DND Engine' : 'Native Android Companion'}
                </h3>
                <span className="text-[10px] font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full font-bold">
                  {isInbuiltApk ? 'INBUILT DND ACTIVE' : 'Kotlin Native DND'}
                </span>
              </div>
              <p className="text-xs text-slate-300">Inbuilt NotificationManager DND • Zero 3rd-party apps</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-4 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'status'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone size={14} />
            Live Device Connection
          </button>
          <button
            onClick={() => setActiveTab('install')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'install'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={14} />
            Installation & Setup
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'source'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode size={14} />
            Kotlin App Source
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {syncError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-red-800">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-red-900">Firestore Sync Warning</p>
                <p className="text-[11px] text-red-700 break-words mt-0.5">{syncError}</p>
              </div>
            </div>
          )}

          {activeTab === 'status' && (
            <>
              {/* Pairing Code Box */}
              <div className="bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 mb-1">
                  Your Device Pairing Code
                </p>
                {isEditingCode ? (
                  <form onSubmit={handleSaveCustomCode} className="flex items-center justify-center gap-2 mt-1">
                    <input
                      type="text"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      placeholder="SILENT-1001"
                      maxLength={16}
                      className="px-3 py-1.5 text-sm font-mono font-bold text-indigo-900 bg-white border border-indigo-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase w-40 text-center"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInputCode(pairingCode);
                        setIsEditingCode(false);
                      }}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-mono font-black text-indigo-600 tracking-wider">
                      {pairingCode}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="p-2 rounded-xl bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer shadow-2xs"
                      title="Copy code"
                    >
                      {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                    </button>
                    <button
                      onClick={() => setIsEditingCode(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-2">
                  Enter this code into the Smart Silent Zone Android app to link your phone.
                </p>
              </div>

              {/* Live Status Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                    <span className="text-sm font-bold text-slate-800">
                      {isConnected ? (device?.deviceName || 'Android Device Connected') : 'Awaiting Android Phone Connection'}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isConnected ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isConnected ? 'FIREBASE SYNC ACTIVE' : 'NOT PAIRED YET'}
                  </span>
                </div>

                {isConnected ? (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Native Android DND</p>
                      <p className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        {isDndActive ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-red-600" />
                            <span className="text-red-700 font-black">MUTED (DND ON)</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-600" />
                            <span className="text-emerald-700 font-bold">Normal Ringer</span>
                          </>
                        )}
                      </p>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Filter: {device?.interruptionFilter || 'ALL'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Battery & Health</p>
                      <p className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <Battery size={14} className="text-emerald-600" />
                        {device?.batteryLevel ?? 95}% Remaining
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {device?.activeZoneName ? `Inside: ${device.activeZoneName}` : 'Outside Silent Zones'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed pt-1">
                    Once paired, your phone's native Android <code className="text-indigo-600 font-mono">NotificationManager</code> will toggle Do Not Disturb automatically when you walk into any saved silent zone!
                  </p>
                )}
              </div>

              {/* Permissions Checklist */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Inbuilt Android OS Access
                  </h4>
                  {isInbuiltApk && (!hasDndPerm || !hasLocPerm || !hasEmergencyPerm) && onRequestAllInbuiltAccess && (
                    <button
                      type="button"
                      onClick={onRequestAllInbuiltAccess}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-2xs"
                    >
                      Allow All Inbuilt Access
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-white ${hasDndPerm ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                      {hasDndPerm ? <Check size={12} /> : <AlertTriangle size={12} />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Notification Policy Access (Inbuilt DND)</p>
                      <p className="text-[10px] text-slate-500">Zero third-party apps required</p>
                    </div>
                  </div>
                  {isInbuiltApk && !hasDndPerm && onRequestInbuiltDndPermission ? (
                    <button
                      type="button"
                      onClick={onRequestInbuiltDndPermission}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-600 text-white cursor-pointer"
                    >
                      GRANT NOW
                    </button>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${hasDndPerm ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {hasDndPerm ? 'GRANTED' : 'PENDING'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-white ${hasLocPerm ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                      {hasLocPerm ? <Check size={12} /> : <AlertTriangle size={12} />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Background Location (Geofencing)</p>
                      <p className="text-[10px] text-slate-500">Screen-locked auto-silence detection</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${hasLocPerm ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {hasLocPerm ? 'GRANTED' : 'PENDING'}
                  </span>
                </div>

                {isInbuiltApk && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center text-white ${hasEmergencyPerm ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                        {hasEmergencyPerm ? <Check size={12} /> : <AlertTriangle size={12} />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Emergency Contact Ring-Through</p>
                        <p className="text-[10px] text-slate-500">Rings saved emergency numbers during DND</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${hasEmergencyPerm ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {hasEmergencyPerm ? 'GRANTED' : 'PENDING'}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {onManualSyncZones && (
                  <button
                    onClick={onManualSyncZones}
                    disabled={isSyncing}
                    className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Syncing to Phone...' : 'Push All Zones to Android'}
                  </button>
                )}

                {!isInbuiltApk && (
                  <a
                    href="/api/android/project.zip"
                    download="SmartSilentZone-Android-Studio-Project.zip"
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download size={13} />
                    Android Studio Project
                  </a>
                )}

                {onSimulateDeviceToggle && !isInbuiltApk && (
                  <button
                    onClick={() => onSimulateDeviceToggle(!isDndActive)}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 active:scale-95"
                    title="Simulate native phone DND toggle in browser"
                  >
                    <Play size={13} className="text-indigo-600" />
                    Test Sync
                  </button>
                )}
              </div>
            </>
          )}

          {activeTab === 'install' && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
                    <Smartphone size={16} className="text-indigo-600" />
                    Native Android Companion Setup
                  </h4>
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                    Zero 3rd-Party Apps
                  </span>
                </div>
                <p className="text-indigo-900 text-xs">
                  Download the Kotlin Android Studio companion project to run background geofencing, inbuilt NotificationManager DND, and Emergency Contact ring-through directly on your phone.
                </p>
                <a
                  href="/api/android/project.zip"
                  download="SmartSilentZone-Android-Studio-Project.zip"
                  className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <Download size={14} />
                  Download Android Studio Project (.zip)
                </a>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">1</div>
                  <div>
                    <p className="font-bold text-slate-900">Build via GitHub Actions or Android Studio</p>
                    <p className="text-slate-600 text-[11px]">Unzip into Android Studio (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Build → APK</code>) or push to GitHub so <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">.github/workflows/build-apk.yml</code> compiles <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">app-debug.apk</code>.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">2</div>
                  <div>
                    <p className="font-bold text-slate-900">Allow Inbuilt Location, DND &amp; Call Access</p>
                    <p className="text-slate-600 text-[11px]">Tap <strong>Allow Location, DND &amp; Emergency Access</strong> inside the APK. It walks through Location, Call State, and Notification Policy Access cleanly and starts monitoring automatically.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">3</div>
                  <div>
                    <p className="font-bold text-slate-900">Add Emergency Numbers for Ring-Through</p>
                    <p className="text-slate-600 text-[11px]">Add family or medical numbers in Settings. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">EmergencyCallReceiver.kt</code> lifts DND briefly whenever those numbers call.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'source' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                All native Kotlin source files included in <code className="font-mono text-indigo-700">/api/android/project.zip</code>:
              </p>
              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-2xl font-mono text-[11px] space-y-1.5 overflow-x-auto">
                <div className="text-emerald-400 font-bold">android/</div>
                <div className="pl-3 text-slate-300">├── .github/workflows/build-apk.yml (Cloud APK builder)</div>
                <div className="pl-3 text-slate-300">├── app/src/main/AndroidManifest.xml</div>
                <div className="pl-3 text-slate-300">├── app/src/main/java/com/geosilent/app/</div>
                <div className="pl-6 text-indigo-300">├── MainActivity.kt (Chained inbuilt perms + WebView)</div>
                <div className="pl-6 text-indigo-300">├── WebAppDndBridge.kt (@JavascriptInterface OS bridge)</div>
                <div className="pl-6 text-indigo-300">├── DndHelper.kt (Native NotificationManager &amp; Audio)</div>
                <div className="pl-6 text-indigo-300">├── EmergencyContactsManager.kt (Emergency numbers store)</div>
                <div className="pl-6 text-indigo-300">├── EmergencyCallReceiver.kt (Bypass DND ring-through)</div>
                <div className="pl-6 text-indigo-300">├── GeofenceManager.kt (Play Services Geofencing)</div>
                <div className="pl-6 text-indigo-300">├── GeofenceBroadcastReceiver.kt (Transitions)</div>
                <div className="pl-6 text-indigo-300">├── GeofenceForegroundService.kt (Screen-locked)</div>
                <div className="pl-6 text-indigo-300">└── FirebaseSyncManager.kt (Local cache + Firestore sync)</div>
                <div className="pl-3 text-slate-300">└── README.md (Detailed compilation instructions)</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Smart Silent Zone • v2.0 Native Android
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
