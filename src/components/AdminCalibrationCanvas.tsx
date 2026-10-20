import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Crosshair,
  Check,
  Undo,
  RefreshCw,
  Trash2,
  Video,
  Eye,
  EyeOff,
  Bookmark,
  Download,
  Upload,
  Layers,
  ZoomIn,
  Move,
  Info,
  ChevronRight
} from 'lucide-react';
import { SpotCoordinates } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface VideoFileInfo {
  name: string;
  path: string;
  size_mb: number;
  is_active: boolean;
}

interface AdminCalibrationCanvasProps {
  spots: SpotCoordinates;
  onRefreshSpots: () => void;
  adminToken: string;
}

// 55 spots defined in dashboard layout: spot-0 through spot-54
const DASHBOARD_SPOTS = Array.from({ length: 55 }, (_, i) => `spot-${i}`);

export const AdminCalibrationCanvas: React.FC<AdminCalibrationCanvasProps> = ({
  spots,
  onRefreshSpots,
  adminToken
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Video and frame settings
  const [videoList, setVideoList] = useState<VideoFileInfo[]>([]);
  const [selectedSourcePath, setSelectedSourcePath] = useState<string>('carpark_video.mp4');
  const [extractTimestamp, setExtractTimestamp] = useState<number>(1.0);
  const [isExtracting, setIsExtracting] = useState(false);

  // Extracted Frame Image state (exact resolution)
  const [frameUrl, setFrameUrl] = useState<string>('/assets/carpark_calib_frame.jpg');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [frameDimensions, setFrameDimensions] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080
  });

  // Display toggles
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
  const [showCrosshairs, setShowCrosshairs] = useState<boolean>(true);
  const [enableLoupe, setEnableLoupe] = useState<boolean>(true);

  // Calibration state
  const [targetSpotId, setTargetSpotId] = useState<string>('spot-0');
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
  const [pendingCoords, setPendingCoords] = useState<[number, number][] | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState<boolean>(false);
  const [selectedSpotForInspection, setSelectedSpotForInspection] = useState<string | null>(null);

  // Real-time hover tracking for surgical pointer accuracy
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number } | null>(null);

  // UI status
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Find next uncalibrated spot from 0 to 54
  const getNextUncalibrated = useCallback(() => {
    for (const sId of DASHBOARD_SPOTS) {
      if (!spots[sId]) return sId;
    }
    return 'spot-0';
  }, [spots]);

  // Initial load
  useEffect(() => {
    fetchVideos();
  }, []);

  // Update target spot to first uncalibrated spot once spots are loaded
  useEffect(() => {
    if (Object.keys(spots).length > 0 && spots[targetSpotId]) {
      const nextUncal = getNextUncalibrated();
      setTargetSpotId(nextUncal);
    }
  }, [spots, getNextUncalibrated]);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos');
      if (res.ok) {
        const data = await res.json();
        setVideoList(data.videos || []);
        if (data.active_source?.source_path) {
          setSelectedSourcePath(data.active_source.source_path);
        } else if (data.videos?.length > 0) {
          setSelectedSourcePath(data.videos[0].path);
        }
      }
    } catch (err) {
      console.error('Failed to load videos:', err);
    }
  };

  // Load image whenever frameUrl changes
  useEffect(() => {
    setImageLoaded(false);
    const img = new Image();
    img.src = frameUrl;
    img.onload = () => {
      imageRef.current = img;
      const w = img.naturalWidth || 1920;
      const h = img.naturalHeight || 1080;
      setFrameDimensions({ width: w, height: h });
      setImageLoaded(true);
    };
    img.onerror = () => {
      if (frameUrl !== '/assets/carpark_calib_frame.jpg') {
        setFrameUrl('/assets/carpark_calib_frame.jpg');
      }
    };
  }, [frameUrl]);

  // Extract clean frame from carpark_video.mp4
  const handleExtractFrame = async () => {
    setIsExtracting(true);
    notify(`Extracting clean frame from "${selectedSourcePath}" at ${extractTimestamp}s...`, 'info');
    try {
      const res = await fetch('/api/extract_frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          source_path: selectedSourcePath,
          timestamp_sec: extractTimestamp
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFrameUrl(`${data.url}?t=${Date.now()}`);
        if (data.width && data.height) {
          setFrameDimensions({ width: data.width, height: data.height });
        }
        notify('Clean frame extracted from video successfully!', 'success');
      } else {
        notify(data.error || 'Failed to extract frame.', 'error');
      }
    } catch (err: any) {
      notify(`Extraction error: ${err.message}`, 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  // Upload frame snapshot
  const handleFrameUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('frame', file);

    notify('Uploading CCTV frame snapshot...', 'info');
    try {
      const res = await fetch('/api/upload_frame', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFrameUrl(`${data.url}?t=${Date.now()}`);
        notify('Snapshot uploaded and loaded onto canvas.', 'success');
      } else {
        notify(data.error || 'Failed to upload snapshot.', 'error');
      }
    } catch (err: any) {
      notify(`Upload failed: ${err.message}`, 'error');
    }
  };

  // Convert browser click event coordinates to exact canvas/image pixel coordinates
  const getCanvasPixelCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;

    // Mathematical clamping to ensure coordinates are always within true image boundaries
    const x = Math.round(Math.max(0, Math.min(canvas.width, rawX)));
    const y = Math.round(Math.max(0, Math.min(canvas.height, rawY)));

    return { x, y };
  };

  // Update Magnifier Loupe
  const updateLoupe = useCallback((pixelX: number, pixelY: number) => {
    const loupe = loupeCanvasRef.current;
    const img = imageRef.current;
    if (!loupe || !img || !imageLoaded) return;

    const ctx = loupe.getContext('2d');
    if (!ctx) return;

    const loupeSize = loupe.width; // 180
    const zoom = 3.2; // 3.2x zoom
    const sampleSize = loupeSize / zoom;

    const sx = Math.max(0, Math.min(img.naturalWidth - sampleSize, pixelX - sampleSize / 2));
    const sy = Math.max(0, Math.min(img.naturalHeight - sampleSize, pixelY - sampleSize / 2));

    ctx.clearRect(0, 0, loupeSize, loupeSize);

    // Disable image smoothing for crisp pixel inspection
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sampleSize, sampleSize, 0, 0, loupeSize, loupeSize);

    // Draw center crosshair reticle in red and white
    const cx = loupeSize / 2;
    const cy = loupeSize / 2;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx, cy + 16);
    ctx.stroke();

    // Center sub-pixel dot
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  }, [imageLoaded]);

  // Main Canvas Rendering Loop
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw frame at 1:1 pixel resolution
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 2. Draw existing calibrated spot polygons from spots.json (in emerald green)
    if (showOverlays) {
      Object.entries(spots).forEach(([spotId, pointsVal]) => {
        const points = pointsVal as [number, number][];
        if (!points || !Array.isArray(points) || points.length < 3) return;

        const isInspected = selectedSpotForInspection === spotId;

        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.closePath();

        ctx.lineWidth = isInspected ? 4 : 2;
        ctx.strokeStyle = isInspected ? '#f59e0b' : '#10b981';
        ctx.stroke();

        ctx.fillStyle = isInspected ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.18)';
        ctx.fill();

        // Spot label badge
        ctx.fillStyle = isInspected ? '#f59e0b' : '#10b981';
        ctx.font = 'bold 13px monospace';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 4;
        ctx.fillText(spotId, points[0][0] + 4, points[0][1] + 16);
        ctx.shadowBlur = 0;
      });
    }

    // 3. Draw active clicks in progress (C1, C2, C3)
    if (currentPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(currentPoints[0][0], currentPoints[0][1]);
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i][0], currentPoints[i][1]);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      currentPoints.forEach(([x, y], idx) => {
        const isSelected = selectedPointIndex === idx;

        // Outer glow
        ctx.beginPath();
        ctx.arc(x, y, isSelected ? 9 : 7, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#f59e0b' : '#0284c7';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner reticle
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        ctx.fillText(`C${idx + 1}`, x + 10, y - 8);
        ctx.shadowBlur = 0;
      });
    }

    // 4. Draw pending complete 4-point polygon in bright cyan with draggable handles
    if (pendingCoords && pendingCoords.length === 4) {
      ctx.beginPath();
      ctx.moveTo(pendingCoords[0][0], pendingCoords[0][1]);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(pendingCoords[i][0], pendingCoords[i][1]);
      }
      ctx.closePath();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
      ctx.fill();

      // Corner markers
      pendingCoords.forEach(([x, y], idx) => {
        const isSelected = selectedPointIndex === idx;

        ctx.beginPath();
        ctx.arc(x, y, isSelected ? 9 : 6, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#f59e0b' : '#06b6d4';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`C${idx + 1} (${x},${y})`, x + 9, y - 8);
      });
    }

    // 5. Draw precision crosshairs across canvas intersecting at hoverPixel
    if (showCrosshairs && hoverPixel) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, hoverPixel.y);
      ctx.lineTo(canvas.width, hoverPixel.y);
      ctx.stroke();

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(hoverPixel.x, 0);
      ctx.lineTo(hoverPixel.x, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [
    spots,
    currentPoints,
    pendingCoords,
    showOverlays,
    showCrosshairs,
    hoverPixel,
    selectedSpotForInspection,
    selectedPointIndex,
    imageLoaded
  ]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Handle canvas mouse movements (updates coordinate HUD, crosshair, and loupe)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasPixelCoords(e);
    if (!coords) return;

    setHoverPixel(coords);
    if (enableLoupe) {
      updateLoupe(coords.x, coords.y);
    }

    // Handle dragging an existing point
    if (isDraggingPoint && selectedPointIndex !== null) {
      if (pendingCoords) {
        const updated = [...pendingCoords] as [number, number][];
        updated[selectedPointIndex] = [coords.x, coords.y];
        setPendingCoords(updated);
      } else if (currentPoints.length > 0) {
        const updated = [...currentPoints] as [number, number][];
        updated[selectedPointIndex] = [coords.x, coords.y];
        setCurrentPoints(updated);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverPixel(null);
    setIsDraggingPoint(false);
  };

  // Handle clicking on the canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasPixelCoords(e);
    if (!coords) return;

    const pointsToCheck = pendingCoords || currentPoints;

    // Check if clicked close to an existing placed point (within 15px distance in canvas space)
    const hitIndex = pointsToCheck.findIndex(([px, py]) => {
      const dist = Math.hypot(px - coords.x, py - coords.y);
      return dist <= 16;
    });

    if (hitIndex !== -1) {
      setSelectedPointIndex(hitIndex);
      setIsDraggingPoint(true);
      return;
    }

    // If all 4 points are already placed, clicking outside does not add points
    if (pendingCoords) {
      setSelectedPointIndex(null);
      return;
    }

    // Add next corner point
    const newPoints = [...currentPoints, [coords.x, coords.y] as [number, number]];

    if (newPoints.length === 4) {
      setPendingCoords(newPoints);
      setCurrentPoints([]);
      setSelectedPointIndex(null);
      notify(`4 corners captured for ${targetSpotId}! Review or adjust points, then click Confirm.`, 'info');
    } else {
      setCurrentPoints(newPoints);
      setSelectedPointIndex(newPoints.length - 1);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingPoint(false);
  };

  // Keyboard Nudge listener (Arrow keys move selected corner by 1px, Shift+Arrow by 5px)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPointIndex === null) return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowUp') dy = -step;
      if (e.key === 'ArrowDown') dy = step;
      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;

      if (pendingCoords) {
        const updated = [...pendingCoords] as [number, number][];
        const [x, y] = updated[selectedPointIndex];
        updated[selectedPointIndex] = [
          Math.max(0, Math.min(frameDimensions.width, x + dx)),
          Math.max(0, Math.min(frameDimensions.height, y + dy))
        ];
        setPendingCoords(updated);
      } else if (currentPoints.length > 0) {
        const updated = [...currentPoints] as [number, number][];
        const [x, y] = updated[selectedPointIndex];
        updated[selectedPointIndex] = [
          Math.max(0, Math.min(frameDimensions.width, x + dx)),
          Math.max(0, Math.min(frameDimensions.height, y + dy))
        ];
        setCurrentPoints(updated);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPointIndex, pendingCoords, currentPoints, frameDimensions]);

  // Confirm and save the 4-point spot to spots.json
  const handleConfirmSaveSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSpotId.trim() || !pendingCoords) return;

    const cleanSpotId = targetSpotId.trim().toLowerCase();
    setIsSaving(true);

    try {
      const res = await fetch('/api/spots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          id: cleanSpotId,
          points: pendingCoords
        })
      });

      if (res.ok) {
        notify(`Calibrated ${cleanSpotId} saved to spots.json!`, 'success');
        setPendingCoords(null);
        setSelectedPointIndex(null);
        onRefreshSpots();

        // Advance to next uncalibrated spot ID automatically
        const currNum = parseInt(cleanSpotId.replace('spot-', ''), 10);
        if (!isNaN(currNum) && currNum < 54) {
          setTargetSpotId(`spot-${currNum + 1}`);
        }
      } else {
        const data = await res.json();
        notify(data.error || 'Failed to save spot calibration.', 'error');
      }
    } catch (err: any) {
      notify(`Save error: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Undo last placed corner
  const handleUndoPoint = () => {
    if (pendingCoords) {
      // Revert to 3 points in currentPoints
      setCurrentPoints(pendingCoords.slice(0, 3));
      setPendingCoords(null);
      setSelectedPointIndex(2);
    } else if (currentPoints.length > 0) {
      setCurrentPoints(currentPoints.slice(0, -1));
      setSelectedPointIndex(currentPoints.length > 1 ? currentPoints.length - 2 : null);
    }
  };

  // Discard all current / pending points
  const handleResetCurrent = () => {
    setCurrentPoints([]);
    setPendingCoords(null);
    setSelectedPointIndex(null);
  };

  // Delete a specific spot from spots.json
  const handleDeleteSpot = (spotId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Calibration for ${spotId}`,
      message: `Are you sure you want to remove ${spotId} from spots.json? Its calibrated polygon coordinates will be cleared.`,
      confirmLabel: 'Delete Spot',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(`/api/spots/${spotId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${adminToken}`
            }
          });

          if (res.ok) {
            notify(`Deleted ${spotId} from spots.json.`, 'info');
            if (selectedSpotForInspection === spotId) {
              setSelectedSpotForInspection(null);
            }
            onRefreshSpots();
          }
        } catch (err) {
          console.error('Failed to delete spot:', err);
        }
      }
    });
  };

  // Clear all spots from spots.json
  const handleClearAllSpots = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear All Spot Calibrations',
      message: 'CAUTION: This will delete ALL calibrated spot coordinates from spots.json. You will need to recalibrate bays from scratch.',
      confirmLabel: 'Clear All Spots',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch('/api/spots_all', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${adminToken}`
            }
          });

          if (res.ok) {
            notify('Cleared all spots from spots.json.', 'info');
            onRefreshSpots();
          }
        } catch (err) {
          console.error('Failed to clear spots:', err);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Notification Toast */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
              : 'bg-blue-950/80 border border-blue-500/50 text-blue-300'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white text-sm ml-3 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION 1: Frame Source & Extraction */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Extract a frame from video</span>
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={frameUploadInputRef}
              accept="image/*"
              onChange={handleFrameUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => frameUploadInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="Upload existing frame snapshot"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Snapshot</span>
            </button>
          </div>
        </div>

        {/* Extraction controls row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Video Source
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200">
              <Video className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate font-mono">
                {selectedSourcePath.split(/[\\/]/).pop() || selectedSourcePath}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Timestamp Offset (seconds)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={extractTimestamp}
              onChange={(e) => setExtractTimestamp(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleExtractFrame}
              disabled={isExtracting}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
              <span>{isExtracting ? 'Extracting Frame...' : 'Extract Clean Frame'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Calibration Tools & Precision HUD */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-sky-400" />
              <span>Calibrate Spots</span>
            </h4>
            <p className="text-xs text-slate-400">
              Select spot ID (<code className="text-sky-300">spot-0</code> through <code className="text-sky-300">spot-54</code>), then click 4 corners clockwise
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAllSpots}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 flex items-center gap-1.5 transition-colors"
              title="Clear all spot definitions from spots.json"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>
        </div>

        {/* Spot Selection & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Target Spot ID:
            </label>
            <select
              value={targetSpotId}
              onChange={(e) => {
                setTargetSpotId(e.target.value);
                handleResetCurrent();
              }}
              className="px-3 py-1.5 bg-slate-900 border border-sky-500/50 rounded-xl text-sm font-mono font-bold text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              {DASHBOARD_SPOTS.map((sId) => {
                const isCalibrated = !!spots[sId];
                return (
                  <option key={sId} value={sId}>
                    {sId} {isCalibrated ? '✓ (calibrated)' : '○ (uncalibrated)'}
                  </option>
                );
              })}
            </select>

            <span className="text-xs font-mono text-slate-400">
              Calibrated: <strong className="text-emerald-400">{Object.keys(spots).length}</strong> / 55
            </span>
          </div>

          {/* Action buttons: Undo, Reset, Confirm */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndoPoint}
              disabled={currentPoints.length === 0 && !pendingCoords}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
            >
              <Undo className="w-3.5 h-3.5" />
              <span>Undo Corner</span>
            </button>

            <button
              type="button"
              onClick={handleResetCurrent}
              disabled={currentPoints.length === 0 && !pendingCoords}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 disabled:opacity-40"
            >
              Reset
            </button>

            {pendingCoords && (
              <button
                type="button"
                onClick={handleConfirmSaveSpot}
                disabled={isSaving}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : `Confirm & Save ${targetSpotId}`}</span>
              </button>
            )}
          </div>
        </div>

        {/* View toggles & precision HUD */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-400 font-mono">
            <span>
              Frame: <strong className="text-slate-200">{frameDimensions.width}×{frameDimensions.height}</strong>
            </span>
            <span>
              Cursor: <strong className="text-amber-400">{hoverPixel ? `${hoverPixel.x}, ${hoverPixel.y}` : '—'}</strong>
            </span>
            {selectedPointIndex !== null && (
              <span className="text-sky-300">
                Active Corner: <strong>C{selectedPointIndex + 1}</strong> (Use ↑↓←→ arrow keys to nudge 1px)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={showOverlays}
                onChange={(e) => setShowOverlays(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0"
              />
              <span>Show Saved Polygons</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={showCrosshairs}
                onChange={(e) => setShowCrosshairs(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
              />
              <span>Crosshair Guides</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={enableLoupe}
                onChange={(e) => setEnableLoupe(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
              />
              <span>3x Zoom</span>
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 3: Precision Interactive Calibration Canvas */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center shadow-2xl">
        <canvas
          ref={canvasRef}
          width={frameDimensions.width}
          height={frameDimensions.height}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleMouseLeave}
          className="w-full h-auto cursor-crosshair max-h-[640px] object-contain select-none"
        />

        {/* Active Clicking Hint Badge */}
        {currentPoints.length > 0 && (
          <div className="absolute top-4 left-4 bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-xl border border-sky-500/50 text-xs text-sky-300 font-mono shadow-xl flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
            <span>
              Target: <strong className="text-white">{targetSpotId}</strong> • Placed {currentPoints.length} of 4 corners ({4 - currentPoints.length} remaining)
            </span>
          </div>
        )}

        {/* 3x Zoom Magnifier Loupe Floating HUD (Top Right) */}
        {enableLoupe && (
          <div className="absolute top-4 right-4 bg-slate-950/95 backdrop-blur-md p-2 rounded-2xl border border-slate-700 shadow-2xl pointer-events-none flex flex-col items-center">
            <div className="flex items-center justify-between w-full px-1 pb-1 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <ZoomIn className="w-3 h-3" /> 3.2× Zoom
              </span>
              <span>{hoverPixel ? `${hoverPixel.x},${hoverPixel.y}` : 'Hover Frame'}</span>
            </div>
            <div className="w-[180px] h-[180px] rounded-xl overflow-hidden border border-slate-700 bg-black relative">
              <canvas
                ref={loupeCanvasRef}
                width={180}
                height={180}
                className="w-full h-full block"
              />
            </div>
            <div className="text-[10px] text-slate-400 pt-1 font-mono">
              Center reticle = exact click point
            </div>
          </div>
        )}

      </div>

      {/* SECTION 4: Calibrated Spot Chips with quick inspection & deletion */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            All Calibrated Spots on Dashboard ({Object.keys(spots).length} / 55 Mapped)
          </h5>
        </div>

        <div className="max-h-48 overflow-y-auto pr-1 flex flex-wrap gap-1.5">
          {Object.keys(spots).length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              No spots calibrated yet in spots.json. Select a spot ID above and click 4 corners on the canvas!
            </p>
          ) : (
            DASHBOARD_SPOTS.map((sId) => {
              const isCalibrated = !!spots[sId];
              const isInspected = selectedSpotForInspection === sId;

              if (!isCalibrated) return null;

              return (
                <div
                  key={sId}
                  onClick={() => setSelectedSpotForInspection(isInspected ? null : sId)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                    isInspected
                      ? 'bg-amber-500/20 border border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-emerald-400">{sId}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSpot(sId);
                    }}
                    className="text-slate-500 hover:text-rose-400 ml-1 transition-colors"
                    title={`Delete ${sId} from spots.json`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Non-blocking Confirm Modal */}
      {confirmDialog && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          isDestructive={confirmDialog.isDestructive}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};
