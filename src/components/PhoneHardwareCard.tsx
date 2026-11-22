import React, { useState } from 'react';
import {
  Smartphone,
  ExternalLink,
  Settings2,
  Volume2,
  VolumeX,
  Vibrate,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { PhoneBridgeConfig } from '../types';
import { InbuiltDndStatus } from '../utils/nativeDndBridge';

interface PhoneHardwareCardProps {
  config: PhoneBridgeConfig;
  onOpenModal: () => void;
  onTestBridge: (turnOn: boolean, mode?: 'silent' | 'vibrate') => Promise<boolean>;
  isInbuiltApk?: boolean;
  inbuiltDndStatus?: InbuiltDndStatus | null;
  onRequestInbuiltDndPermission?: () => void;
}

export default function PhoneHardwareCard({
  onOpenModal,
  onTestBridge,
  isInbuiltApk = false,
  inbuiltDndStatus = null,
  onRequestInbuiltDndPermission,
}: PhoneHardwareCardProps) {
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleAskDndAccess = () => {
    if (isInbuiltApk && onRequestInbuiltDndPermission) {
      onRequestInbuiltDndPermission();
      return;
    }
    try {
      window.location.href = 'intent:#Intent;action=android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS;end';
    } catch {
      onOpenModal();
    }
  };

  const handleOpenZenSettings = () => {
    try {
      window.location.href = 'intent:#Intent;action=android.settings.ZEN_MODE_SETTINGS;end';
    } catch {
      onOpenModal();
    }
  };

  const handleQuickTest = async (mode: 'silent' | 'vibrate') => {
    setTesting(true);
    setTestResult(
      mode === 'vibrate'
        ? 'Testing Vibration Mode on device...'
        : 'Testing DND Mode on device...'
    );
    const ok = await onTestBridge(true, mode);
    setTesting(false);
    if (ok && isInbuiltApk) {
      setTestResult(
        mode === 'vibrate'
          ? 'Vibration Mode activated on hardware!'
          : 'Do Not Disturb activated on hardware!'
      );
    } else if (mode === 'vibrate') {
      setTestResult('Vibration triggered! Phone switches to Vibrate Mode on zone entry.');
    } else {
      setTestResult('Signal sent! Tap "Ask DND Access" or Built-in Rules to grant OS DND access.');
    }
    setTimeout(() => setTestResult(null), 4000);
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
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-800">Phone DND &amp; Vibration Control</h3>
              <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                <Sparkles size={9} className="text-emerald-700" />
                Zero Extra Apps
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isInbuiltApk
                ? 'Built-in Android NotificationManager active'
                : 'Uses your phone’s own DND & Vibration settings'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenModal}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition cursor-pointer"
          title="Built-in Phone DND Guides"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {/* Native DND Status / Direct Ask DND Prompt */}
      {isInbuiltApk ? (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            inbuiltDndStatus?.granted
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <span className="font-bold flex items-center gap-1.5">
            {inbuiltDndStatus?.granted ? (
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            )}
            {inbuiltDndStatus?.granted
              ? `Inbuilt DND Access Ready (${inbuiltDndStatus.filterName})`
              : 'DND Policy Access Needed'}
          </span>
          {!inbuiltDndStatus?.granted && onRequestInbuiltDndPermission && (
            <button
              type="button"
              onClick={onRequestInbuiltDndPermission}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold cursor-pointer shrink-0"
            >
              Ask DND Access
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAskDndAccess}
            className="p-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-left transition cursor-pointer active:scale-98 flex items-center justify-between group"
          >
            <div>
              <span className="text-xs font-bold text-indigo-950 block flex items-center gap-1">
                <VolumeX size={12} className="text-indigo-600" />
                Ask DND Access
              </span>
              <span className="text-[10px] text-indigo-700">Open OS DND Settings</span>
            </div>
            <ExternalLink size={12} className="text-indigo-500 group-hover:translate-x-0.5 transition" />
          </button>

          <button
            type="button"
            onClick={handleOpenZenSettings}
            className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl text-left transition cursor-pointer active:scale-98 flex items-center justify-between group"
          >
            <div>
              <span className="text-xs font-bold text-slate-800 block flex items-center gap-1">
                <Volume2 size={12} className="text-emerald-600" />
                Built-in DND
              </span>
              <span className="text-[10px] text-slate-500">System Rules</span>
            </div>
            <ExternalLink size={12} className="text-slate-400 group-hover:text-emerald-600 transition" />
          </button>
        </div>
      )}

      {/* Test Actions */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <button
          type="button"
          disabled={testing}
          onClick={() => handleQuickTest('silent')}
          className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
        >
          <VolumeX size={13} />
          Test DND Mode
        </button>

        <button
          type="button"
          disabled={testing}
          onClick={() => handleQuickTest('vibrate')}
          className="py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
        >
          <Vibrate size={13} />
          Test Vibration
        </button>
      </div>

      {testResult && (
        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-medium text-emerald-800 text-center">
          {testResult}
        </div>
      )}
    </div>
  );
}
