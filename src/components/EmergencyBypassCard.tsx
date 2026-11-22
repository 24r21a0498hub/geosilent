import React, { useState } from 'react';
import {
  ShieldAlert,
  PhoneCall,
  Star,
  Plus,
  Trash2,
  Check,
  PhoneForwarded,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { EmergencyBypassConfig, VipContact } from '../types';

interface EmergencyBypassCardProps {
  config: EmergencyBypassConfig;
  onChange: (updated: EmergencyBypassConfig) => void;
  onSimulateCall: (contact: VipContact, isRepeatCaller?: boolean) => void;
  isInbuiltApk?: boolean;
  emergencyCallGranted?: boolean;
  onRequestEmergencyPermission?: () => void;
}

export default function EmergencyBypassCard({
  config,
  onChange,
  onSimulateCall,
  isInbuiltApk = false,
  emergencyCallGranted = false,
  onRequestEmergencyPermission,
}: EmergencyBypassCardProps) {
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('Family');
  const [formError, setFormError] = useState<string | null>(null);

  const handleToggleRepeatCallers = () => {
    onChange({
      ...config,
      repeatCallersEnabled: !config.repeatCallersEnabled,
    });
  };

  const handleToggleVip = () => {
    onChange({
      ...config,
      vipContactsEnabled: !config.vipContactsEnabled,
    });
  };

  const handleAddContact = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedPhone = newPhone.trim();
    const digits = trimmedPhone.replace(/\D/g, '');
    if (digits.length < 3) {
      setFormError('Enter a valid emergency phone number (at least 3 digits).');
      return;
    }

    const newContact: VipContact = {
      id: Date.now().toString(),
      name: newName.trim() || `Emergency (${trimmedPhone})`,
      phone: trimmedPhone,
      relation: newRelation,
    };

    onChange({
      ...config,
      vipContactsEnabled: true,
      contacts: [...config.contacts, newContact],
    });
    setNewName('');
    setNewPhone('');
    setFormError(null);
    setIsAddingContact(false);
  };

  const handleDeleteContact = (id: string) => {
    onChange({
      ...config,
      contacts: config.contacts.filter((c) => c.id !== id),
    });
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-bold text-xs text-slate-800">
                Emergency Contacts Ring-Through
              </h4>
              {isInbuiltApk && emergencyCallGranted && (
                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                  <ShieldCheck size={9} /> Inbuilt Active
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Rings the mobile out loud during DND for saved emergency numbers
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const first = config.contacts[0] || {
              id: 'demo',
              name: 'Emergency Contact',
              phone: '911',
              relation: 'Emergency',
            };
            onSimulateCall(first, false);
          }}
          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] rounded-lg border border-emerald-200 transition active:scale-95 flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
          title="Ring phone to test emergency breakthrough"
        >
          <PhoneCall size={11} className="text-emerald-600" />
          Test Ring
        </button>
      </div>

      {/* Native APK Call Permission Prompt when inside APK without READ_PHONE_STATE/READ_CALL_LOG */}
      {isInbuiltApk && !emergencyCallGranted && onRequestEmergencyPermission && (
        <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10.5px] text-amber-900 leading-snug">
              Allow inbuilt Call State access so your saved emergency numbers can ring through DND automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestEmergencyPermission}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shrink-0 cursor-pointer"
          >
            Allow Call Access
          </button>
        </div>
      )}

      {/* Repeat Callers Toggle */}
      <div className="flex items-center justify-between py-2 border-b border-slate-50">
        <div>
          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <PhoneForwarded size={13} className="text-indigo-600" />
            Allow Repeat Callers
          </span>
          <p className="text-[10px] text-slate-400">
            Ring through if the same number calls twice within 3 minutes
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleRepeatCallers}
          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
            config.repeatCallersEnabled ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
          aria-label="Toggle repeat callers"
        >
          <div
            className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all ${
              config.repeatCallersEnabled ? 'right-1' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Starred / Emergency Numbers Toggle */}
      <div className="flex items-center justify-between py-2 mb-2">
        <div>
          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <Star size={13} className="text-amber-500 fill-amber-400" />
            Emergency Numbers Ring-Through
          </span>
          <p className="text-[10px] text-slate-400">
            Saved numbers ignore silent / DND mode and ring the mobile
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleVip}
          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
            config.vipContactsEnabled ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
          aria-label="Toggle emergency contacts"
        >
          <div
            className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all ${
              config.vipContactsEnabled ? 'right-1' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Emergency Contacts List & Add Form */}
      {config.vipContactsEnabled && (
        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Emergency Numbers ({config.contacts.length})
            </span>
            {!isAddingContact && (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setIsAddingContact(true);
                }}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold flex items-center gap-0.5 cursor-pointer border border-indigo-200/70 transition"
              >
                <Plus size={11} /> Add Number
              </button>
            )}
          </div>

          {/* Add contact mini-form */}
          {isAddingContact && (
            <form
              onSubmit={handleAddContact}
              className="bg-white p-2.5 rounded-lg border border-indigo-200 space-y-2 shadow-2xs"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Name (e.g. Mom)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="tel"
                  placeholder="Emergency No. (e.g. +91...)"
                  value={newPhone}
                  onChange={(e) => {
                    setNewPhone(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              {formError && (
                <p className="text-[10px] text-rose-600 font-medium">{formError}</p>
              )}

              <div className="flex items-center justify-between">
                <select
                  value={newRelation}
                  onChange={(e) => setNewRelation(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700"
                >
                  <option value="Family">Family</option>
                  <option value="Doctor">Doctor / Medical</option>
                  <option value="Work / Boss">Work / Boss</option>
                  <option value="Emergency">Emergency Service</option>
                  <option value="Other">Other</option>
                </select>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingContact(false);
                      setFormError(null);
                    }}
                    className="px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Check size={11} /> Save Number
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Contact rows */}
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {config.contacts.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-2">
                No emergency numbers saved yet. Tap &quot;Add Number&quot; to allow urgent calls to ring your phone.
              </p>
            ) : (
              config.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-[11px] truncate">
                        {contact.name}
                      </p>
                      <p className="text-[9.5px] text-slate-400 font-mono truncate">
                        {contact.phone} • {contact.relation}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSimulateCall(contact, false)}
                      className="px-1.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition flex items-center gap-1 cursor-pointer"
                      title={`Ring phone test as ${contact.name}`}
                    >
                      <PhoneCall size={11} />
                      Ring
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(contact.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                      title="Remove emergency number"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
