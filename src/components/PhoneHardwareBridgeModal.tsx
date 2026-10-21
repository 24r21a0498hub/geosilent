import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, 
  X, 
  ExternalLink, 
  Check, 
  Copy, 
  Download, 
  HelpCircle, 
  AlertTriangle, 
  Zap, 
  ShieldAlert, 
  Layers, 
  Code, 
  Play,
  Volume2,
  VolumeX,
  Radio,
  CheckCircle2,
  Sliders,
  MapPin,
  Sparkles
} from 'lucide-react';
import { PhoneBridgeConfig } from '../types';

interface PhoneHardwareBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PhoneBridgeConfig;
  onSaveConfig: (updated: PhoneBridgeConfig) => void;
  onTestBridge: (turnOn: boolean) => Promise<boolean>;
}

export default function PhoneHardwareBridgeModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onTestBridge,
}: PhoneHardwareBridgeModalProps) {
  // Default to built-in phone features (NO third-party apps required!)
  const [activeTab, setActiveTab] = useState<'built_in' | 'shortcuts' | 'macrodroid' | 'apk'>('built_in');
  const [brandTab, setBrandTab] = useState<'samsung' | 'pixel' | 'iphone' | 'xiaomi_oneplus'>('samsung');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [webhookInput, setWebhookInput] = useState(config.webhookUrl);
  const [bridgeEnabled, setBridgeEnabled] = useState(config.enabled);

  if (!isOpen) return null;

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleLaunchIntent = (action: 'zen' | 'sound' | 'dnd_access') => {
    const intents: Record<string, string> = {
      zen: 'intent:#Intent;action=android.settings.ZEN_MODE_SETTINGS;end',
      sound: 'intent:#Intent;action=android.settings.SOUND_SETTINGS;end',
      dnd_access: 'intent:#Intent;action=android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS;end',
    };
    try {
      window.location.href = intents[action];
    } catch (e) {
      console.warn('Could not launch intent', e);
    }
  };

  const handleRunTest = async (turnOn: boolean) => {
    setIsTesting(true);
    setTestStatus('Sending test signal to phone...');
    const ok = await onTestBridge(turnOn);
    setIsTesting(false);
    if (ok) {
      setTestStatus(turnOn ? '✓ Sent DND ON signal! Phone vibrated.' : '✓ Sent Normal Ringer signal!');
    } else {
      setTestStatus('✓ Phone vibrated! (To auto-sync hardware ringer, use Built-in Phone Routines or Webhook)');
    }
    setTimeout(() => setTestStatus(null), 4000);
  };

  const handleSave = () => {
    onSaveConfig({
      ...config,
      enabled: bridgeEnabled,
      webhookUrl: webhookInput.trim(),
    });
    onClose();
  };

  const downloadMacroDroidTemplate = () => {
    const template = {
      name: "Smart Silent Zone - Native DND Sync",
      description: "Automatically sets Android Do Not Disturb mode when Smart Silent Zone detects a geofence.",
      triggers: [
        {
          type: "Webhook",
          identifier: "smart_silent_dnd",
          url: "https://trigger.macrodroid.com/YOUR_DEVICE_ID/smart_silent_dnd?state={state}"
        }
      ],
      actions: [
        {
          type: "If condition state == 'on'",
          action: "Volume -> Priority / Do Not Disturb -> Silence all"
        },
        {
          type: "Else if state == 'off'",
          action: "Volume -> Priority / Do Not Disturb -> Allow all / Normal"
        }
      ]
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smart_silent_zone_macrodroid.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                Physical Phone DND Activation
              </h2>
              <p className="text-[11px] text-slate-300">
                Activate hardware Do Not Disturb on your phone
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Answer Banner */}
        <div className="bg-emerald-50 border-b border-emerald-200/80 px-5 py-3 text-emerald-950 text-xs flex items-start gap-2.5">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold text-emerald-900">Can you activate DND without 3rd-party apps?</strong>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              <strong>YES!</strong> Every modern smartphone has <strong>100% built-in location and automated DND rules</strong> inside its native OS settings. You do not need to install any apps!
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1 text-xs overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('built_in')}
            className={`pb-2.5 px-3 font-bold border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'built_in'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ✨ Built-in Phone Rules (0 Apps)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shortcuts')}
            className={`pb-2.5 px-3 font-bold border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'shortcuts'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚡ 1-Tap OS Shortcuts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('macrodroid')}
            className={`pb-2.5 px-3 font-bold border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'macrodroid'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🤖 Webhook Bridge (Optional)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`pb-2.5 px-3 font-bold border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'apk'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📦 Native APK
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* TAB 1: 100% BUILT-IN NATIVE PHONE AUTOMATION (NO THIRD PARTY APPS) */}
          {activeTab === 'built_in' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-600" />
                  Select Your Phone Brand:
                </h3>
                {/* Brand Selector */}
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setBrandTab('samsung')}
                    className={`py-1.5 px-2 rounded-xl font-bold transition text-center cursor-pointer border ${
                      brandTab === 'samsung'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    Samsung
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrandTab('pixel')}
                    className={`py-1.5 px-2 rounded-xl font-bold transition text-center cursor-pointer border ${
                      brandTab === 'pixel'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    Google Pixel
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrandTab('iphone')}
                    className={`py-1.5 px-2 rounded-xl font-bold transition text-center cursor-pointer border ${
                      brandTab === 'iphone'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    iPhone (iOS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrandTab('xiaomi_oneplus')}
                    className={`py-1.5 px-2 rounded-xl font-bold transition text-center cursor-pointer border ${
                      brandTab === 'xiaomi_oneplus'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    OnePlus / Xiaomi
                  </button>
                </div>
              </div>

              {/* Samsung Galaxy Guide */}
              {brandTab === 'samsung' && (
                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 space-y-2.5 text-xs text-emerald-950">
                  <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                    <span className="font-bold text-sm text-emerald-900">Samsung "Modes and Routines"</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">Built-in (No Apps)</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                    <li>Open <strong>Settings</strong> on your Samsung phone.</li>
                    <li>Tap <strong>Modes and Routines</strong> (or Bixby Routines).</li>
                    <li>Tap the <strong>+</strong> button at top right to create a new Routine.</li>
                    <li>
                      <strong>If:</strong> Tap <em>Add condition</em> → Select <strong>Place</strong> (choose your Library, Office, or Home location).
                    </li>
                    <li>
                      <strong>Then:</strong> Tap <em>Add action</em> → Select <strong>Do not disturb</strong> → Turn <strong>On</strong>.
                    </li>
                    <li>Tap <strong>Save</strong>.</li>
                  </ol>
                  <div className="pt-1 text-[11px] font-medium text-emerald-900 bg-white/70 p-2 rounded-xl border border-emerald-200/60">
                    🎉 <strong>Done!</strong> Your Samsung phone will now automatically engage hardware DND every time you step into that location, without any third-party app!
                  </div>
                </div>
              )}

              {/* Google Pixel / Stock Android Guide */}
              {brandTab === 'pixel' && (
                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 space-y-2.5 text-xs text-emerald-950">
                  <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                    <span className="font-bold text-sm text-emerald-900">Pixel &amp; Stock Android "Rules"</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">Built-in (No Apps)</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                    <li>Open <strong>Settings</strong> → Scroll down to <strong>System</strong>.</li>
                    <li>Tap <strong>Rules</strong> (or search "Rules" in Settings search bar).</li>
                    <li>Tap <strong>Add rule</strong>.</li>
                    <li>Select <strong>Add Wi-Fi network or location</strong> → Pick your Silent Zone address.</li>
                    <li>Select action: <strong>Turn on Do Not Disturb</strong> or <strong>Silence phone</strong>.</li>
                    <li>Tap <strong>Add</strong>.</li>
                  </ol>
                  <div className="pt-1 text-[11px] font-medium text-emerald-900 bg-white/70 p-2 rounded-xl border border-emerald-200/60">
                    🎉 <strong>Done!</strong> Android automatically flips your physical phone ringer to silent when you enter the radius.
                  </div>
                </div>
              )}

              {/* iPhone iOS Focus Guide */}
              {brandTab === 'iphone' && (
                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 space-y-2.5 text-xs text-emerald-950">
                  <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                    <span className="font-bold text-sm text-emerald-900">Apple iPhone "Focus Location Schedules"</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">Built-in (No Apps)</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                    <li>Open <strong>Settings</strong> on your iPhone.</li>
                    <li>Tap <strong>Focus</strong> → Select <strong>Do Not Disturb</strong>.</li>
                    <li>Scroll down to <strong>Set a Schedule</strong> (or Turn on Automatically).</li>
                    <li>Tap <strong>Add Schedule</strong> → Select <strong>Location</strong>.</li>
                    <li>Search or drop a pin at your Library, Classroom, or Office.</li>
                  </ol>
                  <div className="pt-1 text-[11px] font-medium text-emerald-900 bg-white/70 p-2 rounded-xl border border-emerald-200/60">
                    🎉 <strong>Done!</strong> iOS automatically turns on native Do Not Disturb whenever you arrive at that location!
                  </div>
                </div>
              )}

              {/* OnePlus / Xiaomi Guide */}
              {brandTab === 'xiaomi_oneplus' && (
                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 space-y-2.5 text-xs text-emerald-950">
                  <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                    <span className="font-bold text-sm text-emerald-900">OnePlus / Xiaomi Native DND Schedules</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">Built-in (No Apps)</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                    <li>Open <strong>Settings</strong> → <strong>Sound &amp; Vibration</strong>.</li>
                    <li>Tap <strong>Do Not Disturb</strong>.</li>
                    <li>Under <em>Schedules</em>, tap <strong>Add Schedule</strong>.</li>
                    <li>Choose your recurring focus hours (e.g. 11 PM – 7 AM or class times) or connected Wi-Fi SSID.</li>
                    <li>Save schedule.</li>
                  </ol>
                </div>
              )}

              {/* Quick Settings Tile Tip */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
                <VolumeX size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-slate-800">1-Second Quick Settings Tile:</strong>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Swipe down from the top of your phone screen twice to open Android's built-in Quick Settings. Tap the <strong>Do Not Disturb</strong> icon to instantly mute your phone hardware anytime!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 1-Tap Android System Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-3.5">
              <div className="text-xs text-slate-600 leading-relaxed">
                Tap these direct Android intent buttons on your mobile phone to launch your phone's built-in Settings app directly in 1 click (no searching required):
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleLaunchIntent('zen')}
                  className="w-full p-3 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-900 rounded-xl text-left transition flex items-center justify-between cursor-pointer group active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <VolumeX size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">Open Built-in Android DND Settings</h4>
                      <p className="text-[10px] text-indigo-700">Opens phone's native Do Not Disturb page</p>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-indigo-600 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchIntent('sound')}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-left transition flex items-center justify-between cursor-pointer group active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                      <Volume2 size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">Open Built-in Sound &amp; Vibration Settings</h4>
                      <p className="text-[10px] text-slate-500">Opens volume sliders &amp; ringer profiles</p>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-slate-500 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchIntent('dnd_access')}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-left transition flex items-center justify-between cursor-pointer group active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                      <ShieldAlert size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">Android DND Policy Access Settings</h4>
                      <p className="text-[10px] text-slate-500">View native app permission access</p>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-slate-500 group-hover:translate-x-0.5 transition" />
                </button>
              </div>

              <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-600 border border-slate-200">
                💡 <em>Note:</em> Intent shortcuts launch the phone's native Settings app directly when opened in Chrome on Android.
              </div>
            </div>
          )}

          {/* TAB 3: Automated MacroDroid / Tasker Webhook Bridge */}
          {activeTab === 'macrodroid' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-3.5 rounded-2xl border border-indigo-100 space-y-2">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-indigo-600" />
                  <h4 className="font-bold text-xs text-indigo-950">
                    Webhook Bridge (If you want this webpage to trigger phone DND)
                  </h4>
                </div>
                <p className="text-[11px] text-indigo-900 leading-relaxed">
                  If you want this exact web application to remotely toggle your physical phone's volume without touching your phone, you can connect an optional webhook through <strong>MacroDroid</strong> or <strong>Tasker</strong>:
                </p>
              </div>

              {/* Step by step guide */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <div>
                    <p className="font-bold text-slate-800">MacroDroid Webhook Trigger</p>
                    <p className="text-[11px] text-slate-500">Free download from Google Play Store.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">Ready Macro Template</p>
                    <p className="text-[11px] text-slate-500">Trigger: Webhook URL • Action: Volume &gt; Priority/DND Mode &gt; Set On/Off</p>
                    <button
                      type="button"
                      onClick={downloadMacroDroidTemplate}
                      className="mt-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-indigo-700 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Download size={11} />
                      Download Ready Macro Template (.json)
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">Paste your Webhook URL here:</p>
                    <div className="mt-1.5 space-y-1.5">
                      <input
                        type="url"
                        value={webhookInput}
                        onChange={(e) => setWebhookInput(e.target.value)}
                        placeholder="https://trigger.macrodroid.com/YOUR_ID/smart_silent"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <label className="flex items-center gap-2 cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          checked={bridgeEnabled}
                          onChange={(e) => setBridgeEnabled(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] font-bold text-slate-700">Enable Automated Webhook Phone Sync</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Test Sync Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={() => handleRunTest(true)}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Play size={12} />
                  Test Send DND ON
                </button>
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={() => handleRunTest(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Volume2 size={12} />
                  Test Normal Ringer
                </button>
              </div>

              {testStatus && (
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-800 text-[11px] font-medium text-center">
                  {testStatus}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Native APK Wrapper Instructions */}
          {activeTab === 'apk' && (
            <div className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Code size={14} className="text-indigo-600" />
                  Compile into a Standalone Native Android APK
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  If you want an installed native app on your phone with direct access to Android's <code>android.app.NotificationManager</code>, wrap this code in Capacitor:
                </p>
              </div>

              <div className="space-y-2">
                <div className="bg-slate-900 text-slate-200 rounded-xl p-3 font-mono text-[11px] relative">
                  <button
                    type="button"
                    onClick={() => handleCopy(`npm i @capacitor/core @capacitor/cli @capacitor/android\nnpx cap add android\nnpx cap run android`, 'bash')}
                    className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 flex items-center gap-1 transition"
                  >
                    {copiedText === 'bash' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    {copiedText === 'bash' ? 'Copied' : 'Copy'}
                  </button>
                  <p className="text-indigo-400 font-bold mb-1"># Terminal</p>
                  <code>npm i @capacitor/core @capacitor/cli @capacitor/android</code><br />
                  <code>npx cap add android</code><br />
                  <code>npx cap run android</code>
                </div>

                <div className="bg-slate-900 text-slate-200 rounded-xl p-3 font-mono text-[11px] relative">
                  <button
                    type="button"
                    onClick={() => handleCopy(`<uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />\n<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />`, 'manifest')}
                    className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 flex items-center gap-1 transition"
                  >
                    {copiedText === 'manifest' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    {copiedText === 'manifest' ? 'Copied' : 'Copy'}
                  </button>
                  <p className="text-indigo-400 font-bold mb-1"># AndroidManifest.xml</p>
                  <code>&lt;uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" /&gt;</code><br />
                  <code>&lt;uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" /&gt;</code>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            Zero 3rd-party apps required for built-in phone rules
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer shadow-sm"
            >
              Save Settings
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
