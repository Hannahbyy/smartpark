import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Camera, 
  UserCheck, 
  BarChart2, 
  Video, 
  LogOut, 
  Upload,
  Layers
} from 'lucide-react';
import { SpotCoordinates } from '../types';
import { AdminCalibrationCanvas } from './AdminCalibrationCanvas';
import { AdminRegistryManager } from './AdminRegistryManager';
import { AdminPlateReads } from './AdminPlateReads';
import { AdminVideoUpload } from './AdminVideoUpload';

interface AdminPanelProps {
  adminToken: string;
  spots: SpotCoordinates;
  onRefreshSpots: () => void;
  onClose: () => void;
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  adminToken,
  spots,
  onRefreshSpots,
  onClose,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'upload_sources' | 'calibration' | 'registry' | 'plate_reads'>('upload_sources');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Admin Navigation Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-2 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Live Map</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">SmartPark MCKL Control Panel</h2>
              <span className="text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                Admin Mode
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:border-rose-700/60 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Session</span>
          </button>
        </div>
      </header>

      {/* Admin Tab Navigation Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6">
        <div className="flex flex-wrap gap-2 py-2">
          <button
            type="button"
            onClick={() => setActiveTab('upload_sources')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'upload_sources'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Video Upload & Sources</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calibration')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'calibration'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Spot Calibration</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('registry')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'registry'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Owner Registry (CRUD)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('plate_reads')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'plate_reads'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Live Plate Reads</span>
          </button>

        </div>
      </div>

      {/* Main Tab Body */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {activeTab === 'upload_sources' && (
          <AdminVideoUpload
            adminToken={adminToken}
            onSourceChanged={onRefreshSpots}
          />
        )}

        {activeTab === 'calibration' && (
          <AdminCalibrationCanvas
            spots={spots}
            onRefreshSpots={onRefreshSpots}
            adminToken={adminToken}
          />
        )}

        {activeTab === 'registry' && (
          <AdminRegistryManager adminToken={adminToken} />
        )}

        {activeTab === 'plate_reads' && (
          <AdminPlateReads adminToken={adminToken} />
        )}

      </main>
    </div>
  );
};
