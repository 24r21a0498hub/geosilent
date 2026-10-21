import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, ShieldAlert, Star, Volume2 } from 'lucide-react';
import { VipContact } from '../types';

interface IncomingCallModalProps {
  isOpen: boolean;
  caller: VipContact | null;
  isRepeatCaller?: boolean;
  onAnswer: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({
  isOpen,
  caller,
  isRepeatCaller = false,
  onAnswer,
  onDecline,
}: IncomingCallModalProps) {
  if (!isOpen || !caller) return null;

  return (
    <AnimatePresence>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="incoming-call-title"
        className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-950/70 backdrop-blur-xs pt-12"
      >
        <motion.div
          initial={{ y: -60, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -60, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-slate-900 text-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border-2 border-emerald-500/50"
        >
          {/* Top Breakthrough Banner */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-2.5 flex items-center justify-between text-xs font-bold shadow-inner">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-emerald-100">
              <ShieldAlert size={14} className="text-white animate-bounce" />
              Emergency Breakthrough Ringing
            </span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[9px] font-mono">
              Bypassed DND
            </span>
          </div>

          <div className="p-6 flex flex-col items-center text-center">
            {/* Pulsing Avatar */}
            <div className="relative mb-3">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-xl">
                <Star size={32} className="fill-amber-300 text-amber-300 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-30 pointer-events-none" />
            </div>

            <h3 id="incoming-call-title" className="text-lg font-black tracking-tight text-white">
              {caller.name}
            </h3>
            <p className="text-xs text-slate-300 font-mono mt-0.5">
              {caller.phone}
            </p>

            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Volume2 size={12} className="animate-pulse" />
              {isRepeatCaller ? 'Repeat Caller (2nd Call in 3m)' : `Starred VIP (${caller.relation})`}
            </div>

            <p className="text-[11px] text-slate-400 mt-3 max-w-xs leading-relaxed">
              Do Not Disturb was bypassed because this contact is configured for emergency breakthrough.
            </p>

            {/* Answer / Decline Actions */}
            <div className="flex items-center justify-center gap-6 mt-6 w-full">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={onDecline}
                  className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition active:scale-90 cursor-pointer"
                  aria-label="Decline call"
                >
                  <PhoneOff size={24} />
                </button>
                <span className="text-[10px] text-slate-400 font-medium">Decline</span>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={onAnswer}
                  className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg transition active:scale-90 animate-bounce cursor-pointer"
                  aria-label="Answer call"
                >
                  <Phone size={24} />
                </button>
                <span className="text-[10px] text-emerald-400 font-bold">Answer</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
