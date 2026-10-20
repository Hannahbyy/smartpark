import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ParkingGrid } from './components/ParkingGrid';
import { LiveFeedView } from './components/LiveFeedView';
import { ViolationsBanner } from './components/ViolationsBanner';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginModal } from './components/AdminLoginModal';
import { SpotStatus, SpotCoordinates, PublicSpotDetail, AdminSpotDetail, Violation } from './types';
import { Car, Clock, ShieldCheck, ShieldAlert, Wifi, Upload } from 'lucide-react';

export default function App() {
  const [spots, setSpots] = useState<SpotCoordinates>({});
  const [statusMap, setStatusMap] = useState<Record<string, SpotStatus>>({});
  const [detailsMap, setDetailsMap] = useState<Record<string, PublicSpotDetail | AdminSpotDetail>>({});
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isLiveSync, setIsLiveSync] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showLiveFeed, setShowLiveFeed] = useState(false);

  // Admin states
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => sessionStorage.getItem('mckl_admin_token'));
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  // Fetch Spots (geometry coordinates)
  const fetchSpots = useCallback(async () => {
    try {
      const res = await fetch('/api/spots');
      if (res.ok) {
        const data = await res.json();
        setSpots(data);
      }
    } catch (err) {
      console.error('Error fetching spots:', err);
    }
  }, []);

  // Fetch Dynamic Status & Details (2s polling cycle as specified in blueprint)
  const fetchPollingData = useCallback(async () => {
    try {
      // 1. Fetch Spot Statuses (/get_status)
      const statusRes = await fetch('/get_status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatusMap(statusData);
        setIsLiveSync(true);
      }

      // 2. Fetch Spot Details (/get_details or /admin/api/get_full_details)
      const detailsEndpoint = adminToken ? '/admin/api/get_full_details' : '/get_details';
      const headers = adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined;
      const detailsRes = await fetch(detailsEndpoint, { headers });
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        setDetailsMap(detailsData);
      }

      // 3. Fetch Violations (/get_violations)
      const violRes = await fetch('/get_violations');
      if (violRes.ok) {
        const violData = await violRes.json();
        setViolations(violData);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setIsLiveSync(false);
      console.error('Polling error:', err);
    }
  }, [adminToken]);

  // Initial load
  useEffect(() => {
    fetchSpots();
    fetchPollingData();
    const interval = setInterval(fetchPollingData, 2000);
    return () => clearInterval(interval);
  }, [fetchSpots, fetchPollingData]);

  // Admin button toggle
  const handleAdminToggle = () => {
    if (adminToken) {
      setIsAdminOpen(!isAdminOpen);
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLoginSuccess = (token: string) => {
    setAdminToken(token);
    sessionStorage.setItem('mckl_admin_token', token);
    setShowLoginModal(false);
    setIsAdminOpen(true);
    fetchPollingData();
  };

  const handleLogout = async () => {
    if (adminToken) {
      try {
        await fetch('/admin/api/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` }
        });
      } catch (e) {
        // ignore
      }
    }
    setAdminToken(null);
    sessionStorage.removeItem('mckl_admin_token');
    setIsAdminOpen(false);
    fetchPollingData();
  };

  // Compute stats
  const totalCapacity = Object.keys(spots).length || 55;
  let occupiedCount = 0;
  let doubleParkedCount = 0;
  let availableCount = 0;

  for (const [id, status] of Object.entries(statusMap)) {
    if (status === 'occupied') occupiedCount++;
    else if (status === 'double-parked') doubleParkedCount++;
    else availableCount++;
  }

  // Adjust total available if some uncalibrated
  if (totalCapacity > Object.keys(statusMap).length) {
    availableCount += (totalCapacity - Object.keys(statusMap).length);
  }

  const totalViolationsCount = violations.length;

  if (isAdminOpen && adminToken) {
    return (
      <AdminPanel
        adminToken={adminToken}
        spots={spots}
        onRefreshSpots={() => {
          fetchSpots();
          fetchPollingData();
        }}
        onClose={() => setIsAdminOpen(false)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 font-sans">
      {/* SIDEBAR: Total / Available / Occupied / Violations (Phase 2) */}
      <Sidebar
        totalCapacity={totalCapacity}
        availableCount={availableCount}
        occupiedCount={occupiedCount}
        violationCount={totalViolationsCount}
        isLiveSync={isLiveSync}
        lastUpdated={lastUpdated}
        showLiveFeed={showLiveFeed}
        onToggleLiveFeed={() => setShowLiveFeed(!showLiveFeed)}
        isAdminOpen={isAdminOpen}
        onToggleAdmin={handleAdminToggle}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-950 p-6 lg:p-8">
        <div className="max-w-6xl w-full mx-auto space-y-6">
          
          {/* Top Info Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">MCKL Campus Parking Deck</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time occupancy tracking with automated double parking detection & license plate registry lookup
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handleAdminToggle}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Upload video footage or configure camera sources"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Video & Sources</span>
              </button>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Last Polled: <strong className="font-mono text-slate-300">{lastUpdated || 'Connecting...'}</strong></span>
              </div>

              {adminToken ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin Mode</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                >
                  Admin Login
                </button>
              )}
            </div>
          </div>

          {/* Violations Alert Banner (Phase 2) */}
          <ViolationsBanner violations={violations} />

          {/* Live Camera Feed (Phase 1 Show Live Feed toggle) */}
          {showLiveFeed && (
            <LiveFeedView
              spots={spots}
              statusMap={statusMap}
              detailsMap={detailsMap}
              violations={violations}
              onClose={() => setShowLiveFeed(false)}
            />
          )}

          {/* MCKL Parking Map (Phase 1–3) */}
          <ParkingGrid
            statusMap={statusMap}
            detailsMap={detailsMap}
            isAdminMode={Boolean(adminToken)}
            selectedSpotId={selectedSpotId}
            onSelectSpot={(sId) => setSelectedSpotId(sId)}
          />
        </div>
      </main>

      {/* Admin Login Modal (Phase 3 Auth) */}
      <AdminLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
