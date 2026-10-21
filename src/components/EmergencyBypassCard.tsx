import React, { useState } from 'react';
import { 
  ShieldAlert, 
  PhoneCall, 
  Star, 
  Plus, 
  Trash2, 
  Check, 
  Users, 
  Sparkles,
  PhoneForwarded,
  Info
} from 'lucide-react';
import { EmergencyBypassConfig, VipContact } from '../types';

interface EmergencyBypassCardProps {
  config: EmergencyBypassConfig;
  onChange: (updated: EmergencyBypassConfig) => void;
  onSimulateCall: (contact: VipContact, isRepeatCaller?: boolean) => void;
}

export default function EmergencyBypassCard({
  config,
  onChange,
  onSimulateCall,
}: EmergencyBypassCardProps) {
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('Family');

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

  const handleAddContact = () => {
    if (!newName.trim()) return;
    const newContact: VipContact = {
      id: Date.now().toString(),
      name: newName.trim(),
      phone: newPhone.trim() || '(555) 000-0000',
      relation: newRelation,
    };
    onChange({
      ...config,
      contacts: [...config.contacts, newContact],
    });
    setNewName('');
    setNewPhone('');
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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={18} />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800">
              Emergency VIP Breakthrough
            </h4>
            <p className="text-[10px] text-slate-400">
              Bypasses Do Not Disturb for urgent callers
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const first = config.contacts[0] || {
              id: 'demo',
              name: 'Mom',
              phone: '(555) 234-5678',
              relation: 'Family',
            };
            onSimulateCall(first, false);
          }}
          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] rounded-lg border border-emerald-200 transition active:scale-95 flex items-center gap-1 cursor-pointer shadow-2xs"
          title="Test an incoming emergency VIP phone call"
        >
          <PhoneCall size={11} className="text-emerald-600" />
          Test VIP Ring
        </button>
      </div>

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

      {/* Starred VIP Contacts Toggle */}
      <div className="flex items-center justify-between py-2 mb-2">
        <div>
          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <Star size={13} className="text-amber-500 fill-amber-400" />
            Starred VIP Contacts
          </span>
          <p className="text-[10px] text-slate-400">
            Allowed callers ignore silent mode and ring out loud
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleVip}
          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
            config.vipContactsEnabled ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
          aria-label="Toggle VIP contacts"
        >
          <div
            className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all ${
              config.vipContactsEnabled ? 'right-1' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* VIP Contacts List */}
      {config.vipContactsEnabled && (
        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Allowed Breakthrough Contacts ({config.contacts.length})
            </span>
            {!isAddingContact && (
              <button
                type="button"
                onClick={() => setIsAddingContact(true)}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <Plus size={11} /> Add Contact
              </button>
            )}
          </div>

          {/* Add contact mini-form */}
          {isAddingContact && (
            <div className="bg-white p-2.5 rounded-lg border border-indigo-200 space-y-2 shadow-2xs">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Name (e.g. Mom)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Phone (e.g. 555-234-5678)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <select
                  value={newRelation}
                  onChange={(e) => setNewRelation(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700"
                >
                  <option value="Family">Family</option>
                  <option value="Doctor">Doctor / Medical</option>
                  <option value="Work / Boss">Work / Boss</option>
                  <option value="Other">Other</option>
                </select>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAddingContact(false)}
                    className="px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="px-2.5 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded flex items-center gap-1"
                  >
                    <Check size={11} /> Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contact rows */}
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {config.contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {contact.name.charAt(0)}
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
                    className="p-1 text-slate-400 hover:text-emerald-600 transition"
                    title={`Simulate call from ${contact.name}`}
                  >
                    <PhoneCall size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteContact(contact.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition"
                    title="Remove VIP contact"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
