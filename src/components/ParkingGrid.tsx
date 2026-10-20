import React, { useState } from 'react';
import { SpotStatus, PublicSpotDetail, AdminSpotDetail } from '../types';
import { SpotPopover } from './SpotPopover';
import { AlertTriangle, Car, ArrowRight, ArrowLeft, } from 'lucide-react';

interface ParkingGridProps {
  statusMap: Record<string, SpotStatus>;
  detailsMap: Record<string, PublicSpotDetail | AdminSpotDetail>;
  isAdminMode?: boolean;
  selectedSpotId?: string | null;
  onSelectSpot?: (spotId: string) => void;
}

export const ParkingGrid: React.FC<ParkingGridProps> = ({
  statusMap,
  detailsMap,
  isAdminMode = false,
  selectedSpotId,
  onSelectSpot
}) => {
  const [hoveredSpot, setHoveredSpot] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handle hover popover positioning
  const handleMouseEnter = (e: React.MouseEvent, spotId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: rect.left + rect.width / 2, y: rect.top });
    setHoveredSpot(spotId);
  };

  const handleMouseLeave = () => {
    setHoveredSpot(null);
  };

  const renderSpot = (index: number, isHorizontal = false) => {
    const spotId = `spot-${index}`;
    const status: SpotStatus = statusMap[spotId] || 'empty';
    const detail = detailsMap[spotId];
    const isSelected = selectedSpotId === spotId;

    let colorClasses = 'bg-emerald-500 hover:bg-emerald-400 border-emerald-700 text-white';
    if (status === 'occupied') {
      colorClasses = 'bg-rose-500 hover:bg-rose-400 border-rose-800 text-white';
    } else if (status === 'double-parked') {
      colorClasses = 'bg-amber-500 hover:bg-amber-400 border-amber-800 text-slate-900 ring-2 ring-amber-400/80 animate-pulse';
    }

    const dimensionClasses = isHorizontal
      ? 'w-[52px] h-[32px]'
      : 'w-[32px] h-[52px]';

    return (
      <button
        key={spotId}
        id={spotId}
        type="button"
        onClick={() => onSelectSpot?.(spotId)}
        onMouseEnter={(e) => handleMouseEnter(e, spotId)}
        onMouseLeave={handleMouseLeave}
        className={`relative ${dimensionClasses} ${colorClasses} rounded border-2 flex flex-col items-center justify-center font-mono text-[10px] font-bold shadow-md cursor-pointer transition-all duration-150 transform hover:scale-105 active:scale-95 ${
          isSelected ? 'ring-4 ring-blue-500 ring-offset-2 z-20' : 'z-10'
        }`}
        aria-label={`${spotId}: ${status}`}
      >
        <span className="leading-none select-none">{index}</span>
        {status === 'double-parked' && (
          <span className="absolute -top-1.5 -right-1.5 bg-amber-600 text-white rounded-full p-0.5 shadow-sm">
            <AlertTriangle className="w-2.5 h-2.5" />
          </span>
        )}
        {status === 'occupied' && detail?.plate && (
          <span className="text-[7px] opacity-80 truncate max-w-[28px] mt-0.5 leading-none">
            {detail.plate.slice(0, 3)}
          </span>
        )}
      </button>
    );
  };

  const renderCluster = (startIndex: number, count: number, isVertical = false, isHorizontal = false) => {
    const spots = [];
    for (let i = 0; i < count; i++) {
      spots.push(renderSpot(startIndex + i, isHorizontal));
    }
    return (
      <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-1`}>
        {spots}
      </div>
    );
  };

  return (
    <div className="relative w-full overflow-x-auto rounded-2xl bg-white border border-slate-200 shadow-sm p-6 select-none">
      {/* Legend & Map Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Car className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">MCKL Pykett Car Park</h3>
            <p className="text-xs text-slate-400">Hover inspect license plate & owner registry record</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-600"></span>
            <span className="text-slate-600">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500 border border-rose-600"></span>
            <span className="text-slate-600">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 border border-amber-600 animate-pulse"></span>
            <span className="text-slate-600 flex items-center gap-1">
              Double Parked <AlertTriangle className="w-3 h-3 text-amber-600" />
            </span>
          </div>
        </div>
      </div>

      {/* Concrete Asphalt Grid Area */}
      <div className="relative w-[960px] h-[520px] mx-auto parking-grid-bg rounded-xl border border-slate-300 p-4 shadow-inner overflow-hidden">
        
        {/* Drive Lane Visual Guides */}
        <div className="absolute top-[85px] left-[200px] w-[500px] h-[75px] border-slate-300 flex items-center justify-center text-slate-400/80 font-mono text-xs tracking-widest pointer-events-none">
          <span className="flex items-center gap-2">ONE WAY TRAFFIC <ArrowRight className="w-4 h-4 text-slate-400" /></span>
        </div>

        <div className="absolute top-[350px] left-[130px] w-[600px] h-[60px] border-slate-300 flex items-center justify-center text-slate-400/80 font-mono text-xs tracking-widest pointer-events-none">
          <span className="flex items-center gap-2"><ArrowLeft className="w-4 h-4 text-slate-400" /> EXIT LANE</span>
        </div>

        {/* TOP ROW: spot-0 to spot-13 (count 14) */}
        <div className="absolute top-2 left-[200px]">
          <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center justify-between">
            <span>ZONE A: NORTH ROW (0–13)</span>
          </div>
          {renderCluster(0, 14)}
        </div>

        {/* LEFT VERTICAL COLUMNS: spot-14 to spot-21 (count 4 each) */}
        <div className="absolute top-2 left-4 flex gap-4">
          <div>
            <span className="text-[9px] font-bold text-slate-400 block mb-1">WEST 1</span>
            {renderCluster(14, 4, true)}
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 block mb-1">WEST 2</span>
            {renderCluster(18, 4, true)}
          </div>
        </div>

        {/* --- MIDDLE SECTION --- */}

        {/* MID-LEFT CLUSTER: spot-22 (iso horizontal) + spot-23 to spot-26 (4 spots) */}
        <div className="absolute top-[260px] left-[170px]">
          <div className="absolute -top-[38px] right-0">
            {renderCluster(22, 1, false, true)}
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 block mb-1">MID-WEST (23–26)</span>
            {renderCluster(23, 4)}
          </div>
        </div>

        {/* CENTER ISLANDS: spot-27 to spot-31 & spot-32 to spot-37 */}
        <div className="absolute top-[168px] left-[350px] flex flex-col gap-[22px]">
          {/* Top Island (27-31): Shifted right by 36px to align opposite 33-37 */}
          <div className="ml-[36px]">
            <span className="text-[9px] font-bold text-slate-400 block mb-1">CENTRE ISLAND TOP (27–31)</span>
            {renderCluster(27, 5)}
          </div>
          {/* Bottom Island (32-37) */}
          <div>
            <span className="text-[9px] font-bold text-slate-400 block mb-1">CENTRE ISLAND BOTTOM (32–37)</span>
            {renderCluster(32, 6)}
          </div>
        </div>

        {/* MID-RIGHT ROW: spot-38 to spot-40 (count 3) */}
        <div className="absolute top-[260px] left-[600px]">
          <span className="text-[9px] font-bold text-slate-400 block mb-1">MID-EAST (38–40)</span>
          {renderCluster(38, 3)}
        </div>

        {/* FAR RIGHT VERTICAL COLUMN: spot-41 to spot-45 (count 5) */}
        <div className="absolute top-[120px] left-[800px]">
          <span className="text-[9px] font-bold text-slate-400 block mb-1">EAST BOUNDARY (41–45)</span>
          {renderCluster(41, 5, true)}
        </div>

        {/* BOTTOM HORIZONTAL ROW: spot-46 to spot-54 (count 9) */}
        <div className="absolute top-[420px] left-[130px]">
          <span className="text-[9px] font-bold text-slate-400 block mb-1">ZONE B: SOUTH CORRIDOR (46–54)</span>
          {renderCluster(46, 9)}
        </div>

      </div>

      {/* Floating Tooltip / Popover when hovering a spot */}
      {hoveredSpot && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          <SpotPopover
            spotId={hoveredSpot}
            detail={detailsMap[hoveredSpot]}
            isAdminMode={isAdminMode}
          />
        </div>
      )}
    </div>
  );
};
