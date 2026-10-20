import React from 'react';
import { 
  Car, 
  CheckCircle2, 
  AlertOctagon, 
  ShieldAlert, 
  Video, 
  Settings, 
  Lock, 
  Wifi
} from 'lucide-react';

interface SidebarProps {
  totalCapacity: number;
  availableCount: number;
  occupiedCount: number;
  violationCount: number;
  isLiveSync: boolean;
  lastUpdated: string;
  showLiveFeed: boolean;
  onToggleLiveFeed: () => void;
  isAdminOpen: boolean;
  onToggleAdmin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  totalCapacity,
  availableCount,
  occupiedCount,
  violationCount,
  isLiveSync,
  lastUpdated,
  showLiveFeed,
  onToggleLiveFeed,
  isAdminOpen,
  onToggleAdmin
}) => {
  return (
    <aside className="w-80 bg-slate-900 text-white flex flex-col border-r border-slate-800 shrink-0 h-screen overflow-y-auto">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shadow-inner">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                SmartPark <span className="text-blue-400 font-extrabold text-sm px-1.5 py-0.5 rounded bg-blue-900/60 border border-blue-700/50">MCKL</span>
              </h1>
              <p className="text-[11px] text-slate-400">Campus Bay Surveillance</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleAdmin}
            className={`p-2 rounded-lg border transition-all ${
              isAdminOpen
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
            }`}
            title="Open Admin Control Panel"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Metric Cards (Phase 1 & Phase 2) */}
      <div className="p-6 space-y-3.5">
        {/* Total Capacity */}
        <div className="bg-slate-800/90 p-4 rounded-xl shadow-md border-l-4 border-blue-500 border-t border-r border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Total Capacity</p>
            <Car className="w-4 h-4 text-blue-400/80" />
          </div>
          <p id="stat-total" className="text-3xl font-extrabold tracking-tight text-white mt-1">
            {totalCapacity}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Calibrated Campus Bays</p>
        </div>

        {/* Available */}
        <div className="bg-slate-800/90 p-4 rounded-xl shadow-md border-l-4 border-emerald-500 border-t border-r border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Available</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-400/80" />
          </div>
          <p id="stat-available" className="text-3xl font-extrabold tracking-tight text-emerald-400 mt-1">
            {availableCount}
          </p>
          <div className="w-full bg-slate-700/60 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${totalCapacity > 0 ? (availableCount / totalCapacity) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Occupied */}
        <div className="bg-slate-800/90 p-4 rounded-xl shadow-md border-l-4 border-rose-500 border-t border-r border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Occupied</p>
            <AlertOctagon className="w-4 h-4 text-rose-400/80" />
          </div>
          <p id="stat-occupied" className="text-3xl font-extrabold tracking-tight text-rose-400 mt-1">
            {occupiedCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {totalCapacity > 0 ? `${Math.round((occupiedCount / totalCapacity) * 100)}% Occupancy Rate` : '0%'}
          </p>
        </div>

        {/* Violations (Phase 2 Requirement) */}
        <div className={`p-4 rounded-xl shadow-md border-l-4 border-amber-500 border-t border-r border-b transition-all ${
          violationCount > 0 
            ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/30' 
            : 'bg-slate-800/90 border-slate-700/50'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Violations</p>
            <ShieldAlert className={`w-4 h-4 ${violationCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-500'}`} />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p id="stat-violations" className="text-3xl font-extrabold tracking-tight text-amber-400">
              {violationCount}
            </p>
            {violationCount > 0 && (
              <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                Action Required
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Double-parked & out-of-bounds</p>
        </div>
      </div>

      {/* Control Toggles */}
      <div className="px-6 py-2 space-y-2">
        <button
          type="button"
          onClick={onToggleLiveFeed}
          className={`w-full py-2.5 px-3.5 rounded-xl font-medium text-xs flex items-center justify-between transition-all border ${
            showLiveFeed
              ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-400" />
            <span>Live Camera Feed</span>
          </span>
          <span className={`w-2 h-2 rounded-full ${showLiveFeed ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
        </button>

        <button
          type="button"
          onClick={onToggleAdmin}
          className={`w-full py-2.5 px-3.5 rounded-xl font-medium text-xs flex items-center justify-between transition-all border ${
            isAdminOpen
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>Admin Control Panel</span>
          </span>
        </button>
      </div>

      {/* Sync Status Footer */}
      <div className="mt-auto p-6 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isLiveSync ? 'bg-emerald-400 shadow-sm shadow-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="font-medium text-slate-300">
              {isLiveSync ? 'Live Sync Active' : 'Offline'}
            </span>
          </span>
          <Wifi className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Last Polled: <span className="font-mono text-slate-400">{lastUpdated || 'Connecting...'}</span>
        </p>
      </div>
    </aside>
  );
};
