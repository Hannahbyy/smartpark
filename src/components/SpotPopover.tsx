import React from 'react';
import { ShieldAlert, User, Car, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PublicSpotDetail, AdminSpotDetail } from '../types';

interface SpotPopoverProps {
  spotId: string;
  detail?: PublicSpotDetail | AdminSpotDetail;
  isAdminMode?: boolean;
}

export const SpotPopover: React.FC<SpotPopoverProps> = ({ spotId, detail, isAdminMode }) => {
  const status = detail?.status || 'empty';
  const isDoubleParked = status === 'double-parked';
  const isOccupied = status === 'occupied';
  const isEmpty = status === 'empty';

  return (
    <div className="w-64 p-3 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-sm text-blue-400">{spotId.toUpperCase()}</span>
          <span className="text-[10px] text-slate-400">Bay</span>
        </div>
        <div>
          {isEmpty && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" /> Available
            </span>
          )}
          {isOccupied && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-medium border border-rose-500/30">
              <Car className="w-3 h-3" /> Occupied
            </span>
          )}
          {isDoubleParked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-semibold border border-amber-500/40 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> Double Parked
            </span>
          )}
        </div>
      </div>

      {(isOccupied || isDoubleParked) ? (
        <div className="mt-2.5 space-y-2">
          {/* License Plate Display */}
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">Plate Number</span>
              <span className="font-mono text-sm font-bold tracking-wider text-amber-300">
                {detail?.plate || 'OCR Scanning...'}
              </span>
            </div>
            {detail?.confidence && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                {Math.round(detail.confidence * 100)}% Match
              </span>
            )}
          </div>

          {/* Owner Lookup (from MCKL Registry) */}
          <div className="bg-slate-800/60 p-2 rounded-lg">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] mb-1 font-medium">
              <User className="w-3 h-3 text-blue-400" />
              <span>Registered Owner</span>
            </div>
            <p className="font-semibold text-slate-200">
              {detail?.owner_name ? (
                <span className="text-emerald-400">{detail.owner_name}</span>
              ) : (
                <span className="text-slate-400 italic">Unregistered Vehicle / Guest</span>
              )}
            </p>

            {/* Phone number ONLY visible to authenticated admin */}
            {isAdminMode && (detail as AdminSpotDetail)?.phone && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 text-[11px] flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Phone (Admin Only):</span>
                <span className="font-mono text-blue-300 font-medium">{(detail as AdminSpotDetail).phone}</span>
              </div>
            )}
          </div>

          {isDoubleParked && (
            <div className="flex items-center gap-1.5 p-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-300">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Vehicle straddles multiple spots. Flagged for parking warden review.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="py-3 text-center text-slate-400 text-[11px]">
          Bay is currently clear for parking.
        </div>
      )}
    </div>
  );
};
