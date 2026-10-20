import React, { useEffect, useState } from 'react';
import { Video, EyeOff, Layers } from 'lucide-react';
import { SpotCoordinates, SpotStatus } from '../types';

interface LiveFeedViewProps {
  spots: SpotCoordinates;
  statusMap: Record<string, SpotStatus>;
  detailsMap?: any;
  violations?: any;
  onClose: () => void;
}

export const LiveFeedView: React.FC<LiveFeedViewProps> = ({
  spots,
  statusMap,
  onClose
}) => {
  const [showPolygons, setShowPolygons] = useState(true);
  const [videoSrc, setVideoSrc] = useState('/assets/carpark_video.mp4');
  const [videoName, setVideoName] = useState('carpark_video.mp4');

  useEffect(() => {
    let isMounted = true;
    fetch('/api/videos')
      .then((res) => {
        if (!res.ok) throw new Error(`Video source request failed (${res.status})`);
        return res.json();
      })
      .then((data: { active_source?: { source_type?: string; source_path?: string } }) => {
        if (!isMounted || data.active_source?.source_type !== 'video' || !data.active_source.source_path) {
          return;
        }

        const sourcePath = data.active_source.source_path.replace(/\\/g, '/');
        const filename = sourcePath.split('/').pop() || sourcePath;
        setVideoName(filename);
        setVideoSrc(sourcePath.startsWith('uploads/')
          ? `/${sourcePath.split('/').map(encodeURIComponent).join('/')}`
          : `/assets/${encodeURIComponent(filename)}`);
      })
      .catch((error) => {
        console.error('Failed to load active video source:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-xl overflow-hidden mb-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/90 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-400" />
              <span>Camera Footage</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Active source: <span className="font-mono">{videoName}</span>
            </p>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPolygons(!showPolygons)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              showPolygons
                ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showPolygons ? 'Hide Calibrated Spots' : 'Show Calibrated Spots'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700"
            title="Hide Live Feed"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Viewport: active video source HTML5 playback */}
      <div className="relative w-full aspect-video max-h-[520px] bg-black overflow-hidden flex items-center justify-center">
        <video
          key={videoSrc}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          controls
          className="w-full h-full object-contain select-none"
        />

        {/* SVG Overlay for Calibrated Spot Polygons (mapped in 1920x1080 video coordinates) */}
        {showPolygons && (
          <svg
            viewBox="0 0 1920 1080"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="xMidYMid meet"
          >
            {Object.entries(spots).map(([spotId, pointsVal]) => {
              const points = pointsVal as [number, number][];
              if (!points || points.length < 3) return null;
              const status = statusMap[spotId] || 'empty';
              const ptsString = points.map(([x, y]) => `${x},${y}`).join(' ');

              let stroke = '#22c55e';
              let fill = 'rgba(34, 197, 94, 0.15)';
              if (status === 'occupied') {
                stroke = '#ef4444';
                fill = 'rgba(239, 68, 68, 0.25)';
              } else if (status === 'double-parked') {
                stroke = '#f59e0b';
                fill = 'rgba(245, 158, 11, 0.4)';
              }

              return (
                <g key={spotId}>
                  <polygon
                    points={ptsString}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={status === 'double-parked' ? '4' : '2'}
                  />
                  <text
                    x={points[0][0] + 6}
                    y={points[0][1] + 18}
                    fill="#ffffff"
                    fontSize="18"
                    fontFamily="monospace"
                    fontWeight="bold"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.9))"
                  >
                    {spotId}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

      </div>
    </div>
  );
};
