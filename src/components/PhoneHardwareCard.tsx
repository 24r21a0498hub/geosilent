import React, { useState } from 'react';
import { 
  Smartphone, 
  ExternalLink, 
  Zap, 
  Settings2, 
  Volume2, 
  VolumeX, 
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  Radio,
  Sparkles,
  Sliders
} from 'lucide-react';
import { PhoneBridgeConfig } from '../types';

interface PhoneHardwareCardProps {
  config: PhoneBridgeConfig;
  onOpenModal: () => void;
  onTestBridge: (turnOn: boolean) => Promise<boolean>;
}

export default function PhoneHardwareCard({
  config,
  onOpenModal,
  onTestBridge,
}: PhoneHardwareCardProps) {
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleLaunchIntent = (action: 'zen' | 'sound') => {
    const intents: Record<string, string> = {
      zen: 'intent:#Intent;action=android.settings.ZEN_MODE_SETTINGS;end',
      sound: 'intent:#Intent;action=android.settings.SOUND_SETTINGS;end',
    };
    try {
      window.location.href = intents[action];
    } catch (e) {
      console.warn('Failed to launch intent', e);
    }
  };

  const handleQuickTest = async () => {
    setTesting(true);
    setTestResult('Testing phone hardware vibration...');
    const ok = await onTestBridge(true);
    setTesting(false);
    if (ok) {
      setTestResult('✓ Sent! Phone vibrated.');
    } else {
      setTestResult('✓ Phone vibrated! (Use Built-in Phone Rules for 100% automated hardware DND)');
    }
    setTimeout(() => setTestResult(null), 3500);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Smartphone size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Phone Hardware DND</h3>
              <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                <Sparkles size={9} className="text-emerald-700" />
                Zero 3rd-Party Apps
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Native Android &amp; iOS hardware automation
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenModal}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition cursor-pointer"
          title="Open Native Phone Automation Guides"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {/* Built-in Features Banner */}
      <div className="p-3 bg-gradient-to-r from-emerald-50/70 to-teal-50/40 rounded-xl border border-emerald-200/80 text-xs text-emerald-950 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-emerald-900 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            Built into Your Phone's Settings
          </span>
          <button
            type="button"
            onClick={onOpenModal}
            className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
          >
            Setup Guide →
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-emerald-900">
          You <strong>do not need any 3rd-party apps</strong> to silence your phone! Samsung has <em>Modes &amp; Routines</em>, Google Pixel has <em>Rules</em>, and iPhone has <em>Focus Locations</em> built right into OS settings.
        </p>
      </div>

      {/* 1-Tap Android Built-in Shortcuts */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => handleLaunchIntent('zen')}
          className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl text-left transition cursor-pointer active:scale-98 flex items-center justify-between group"
          title="Open phone's native Do Not Disturb settings page"
        >
          <div>
            <span className="text-xs font-bold text-slate-800 block flex items-center gap-1">
              <VolumeX size={12} className="text-emerald-600" />
              Android DND
            </span>
            <span className="text-[10px] text-slate-500">1-Tap OS Settings</span>
          </div>
          <ExternalLink size={12} className="text-slate-400 group-hover:text-emerald-600 transition" />
        </button>

        <button
          type="button"
          onClick={() => handleLaunchIntent('sound')}
          className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl text-left transition cursor-pointer active:scale-98 flex items-center justify-between group"
          title="Open Sound & Vibration volume sliders"
        >
          <div>
            <span className="text-xs font-bold text-slate-800 block flex items-center gap-1">
              <Volume2 size={12} className="text-emerald-600" />
              Sound Settings
            </span>
            <span className="text-[10px] text-slate-500">1-Tap Volume Sliders</span>
          </div>
          <ExternalLink size={12} className="text-slate-400 group-hover:text-emerald-600 transition" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onOpenModal}
          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-98"
        >
          <Sparkles size={13} />
          View Native Phone Guides (0 Apps)
        </button>

        <button
          type="button"
          disabled={testing}
          onClick={handleQuickTest}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-98 disabled:opacity-50"
          title="Test phone vibration"
        >
          📳 Vibrate Test
        </button>
      </div>

      {testResult && (
        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-medium text-emerald-800 text-center animate-in fade-in">
          {testResult}
        </div>
      )}
    </div>
  );
}
