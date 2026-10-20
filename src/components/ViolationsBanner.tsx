import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { Violation } from '../types';

interface ViolationsBannerProps {
  violations: Violation[];
  onDismiss?: (id: string) => void;
}

export const ViolationsBanner: React.FC<ViolationsBannerProps> = ({ violations, onDismiss }) => {
  if (!violations || violations.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {violations.map((v) => {
        const isDoublePark = v.type === 'double_parking';
        return (
          <div
            key={v.id}
            className={`p-3.5 rounded-xl border flex items-center justify-between shadow-sm transition-all ${
              isDoublePark
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-900'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  isDoublePark
                    ? 'bg-amber-500/20 text-amber-700'
                    : 'bg-rose-500/20 text-rose-700'
                }`}
              >
                {isDoublePark ? (
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                ) : (
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-white/80 shadow-xs">
                    {isDoublePark ? 'Double Parking Violation' : 'Unauthorized Aisle Block'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">{v.timestamp}</span>
                </div>
                <p className="text-xs font-medium text-slate-800 mt-0.5">{v.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600 bg-white/70 px-2.5 py-1 rounded-lg border border-slate-200">
                {isDoublePark ? '3-Cycle Debounce Verified' : 'Camera Alert'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
