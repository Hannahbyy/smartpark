import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Video, 
  Camera, 
  Check, 
  AlertCircle, 
  Trash2, 
  Play, 
  FileVideo, 
  RefreshCw, 
  HardDrive,
  Info
} from 'lucide-react';
import { VideoFileInfo } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface AdminVideoUploadProps {
  adminToken: string;
  onSourceChanged?: () => void;
}

export const AdminVideoUpload: React.FC<AdminVideoUploadProps> = ({
  adminToken,
  onSourceChanged
}) => {
  const [videos, setVideos] = useState<VideoFileInfo[]>([]);
  const [activeSourceType, setActiveSourceType] = useState<'video' | 'camera'>('video');
  const [activePath, setActivePath] = useState<string>('carpark_video.mp4');
  const [cameraIndex, setCameraIndex] = useState<string>('0');
  
  // Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch videos and source status
  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
        if (data.active_source) {
          setActiveSourceType(data.active_source.source_type);
          if (data.active_source.source_path) setActivePath(data.active_source.source_path);
          if (data.active_source.camera_index !== undefined) setCameraIndex(String(data.active_source.camera_index));
        }
      }
    } catch (err: any) {
      console.error('Error fetching video list:', err);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [adminToken]);

  // Handle Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validExtensions = ['.mp4', '.avi', '.mov', '.mkv'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setStatusMessage({ text: 'Please upload a video file (.mp4, .avi, .mov, or .mkv).', type: 'error' });
      return;
    }
    setSelectedFile(file);
    setStatusMessage(null);
  };

  // Upload Video File
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(15);

    const formData = new FormData();
    formData.append('video', selectedFile);

    try {
      setUploadProgress(45);
      const res = await fetch('/api/upload_video', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`
        },
        body: formData
      });

      setUploadProgress(85);
      const data = await res.json();

      if (res.ok) {
        setUploadProgress(100);
        setStatusMessage({
          text: `Successfully uploaded ${selectedFile.name}! Set as active detection video source.`,
          type: 'success'
        });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await fetchVideos();
        if (onSourceChanged) onSourceChanged();
      } else {
        setStatusMessage({ text: data.error || 'Upload failed.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: 'Network error during upload: ' + err.message, type: 'error' });
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
      }, 3000);
    }
  };

  // Switch Active Source
  const handleSetSource = async (sourceType: 'video' | 'camera', sourcePath?: string, camIdx?: string) => {
    try {
      const res = await fetch('/api/set_source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          source_type: sourceType,
          source_path: sourcePath || activePath,
          camera_index: camIdx !== undefined ? camIdx : cameraIndex
        })
      });

      const data = await res.json();
      if (res.ok) {
        setActiveSourceType(sourceType);
        if (sourcePath) setActivePath(sourcePath);
        setStatusMessage({
          text: `Active detection source set to: ${sourceType === 'camera' ? `Camera #${cameraIndex}` : (sourcePath || activePath)}`,
          type: 'success'
        });
        await fetchVideos();
        if (onSourceChanged) onSourceChanged();
      } else {
        setStatusMessage({ text: data.error || 'Failed to switch source.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: 'Error switching source: ' + err.message, type: 'error' });
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Delete uploaded video
  const handleDeleteVideo = (filename: string) => {
    setVideoToDelete(filename);
  };

  const executeDeleteVideo = async () => {
    if (!videoToDelete) return;
    const filename = videoToDelete;
    setVideoToDelete(null);

    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        setStatusMessage({ text: `Removed ${filename}`, type: 'info' });
        fetchVideos();
      }
    } catch (err: any) {
      setStatusMessage({ text: 'Error deleting: ' + err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              <span>Video Upload & Detection Source Management</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Upload footage directly or connect real USB/RTSP camera feeds.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchVideos}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1.5 border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Files</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : statusMessage.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
        }`}>
          {statusMessage.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Grid: Upload Zone & Camera Switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Video File Uploader */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <FileVideo className="w-4 h-4 text-blue-400" />
              <span>Upload Video Footage</span>
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Upload an MP4 or AVI recording of the car park. Files are stored in the server's uploads repository.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Drag and Drop Box */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-500/10'
                    : selectedFile
                    ? 'border-emerald-500/60 bg-emerald-500/5'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-950/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/x-msvideo,video/quicktime,video/x-matroska,.mp4,.avi,.mov,.mkv"
                  onChange={handleFileInput}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className={`p-3 rounded-full ${selectedFile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    <Upload className="w-6 h-6" />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-bold text-emerald-300 font-mono">{selectedFile.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-slate-200">
                        Drag and drop your video here, or <span className="text-blue-400 underline">browse</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Supports MP4, AVI, MOV, MKV up to 250MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {isUploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Uploading & staging video...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading Video...' : 'Upload & Set Active Source'}</span>
                </button>

                {selectedFile && !isUploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Card 2: Live Camera Device / RTSP Configuration */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Live Camera Source (USB / RTSP)</span>
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Connect a physical CCTV camera device index (e.g. 0 for primary webcam/capture card) or network stream.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Camera Device Index (or RTSP Stream URL)
                </label>
                <input
                  type="text"
                  value={cameraIndex}
                  onChange={(e) => setCameraIndex(e.target.value)}
                  placeholder="0 or rtsp://192.168.1.100:554/live"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>Current Active Source Status:</span>
                </div>
                <p className="font-mono text-emerald-400 text-[11px]">
                  Mode: <strong className="uppercase">{activeSourceType}</strong> ({activeSourceType === 'camera' ? `Device ${cameraIndex}` : activePath})
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleSetSource('camera', undefined, cameraIndex)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Switch to Live Camera Stream</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Repository / Library Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span>Available Footage Library ({videos.length} Files)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any footage file to serve as the active detection stream.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-3 px-4">Filename</th>
                <th className="py-3 px-4">File Size</th>
                <th className="py-3 px-4">Uploaded Timestamp</th>
                <th className="py-3 px-4">Active Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {videos.map((vid) => {
                const isActive = activeSourceType === 'video' && (activePath.includes(vid.filename) || vid.isActive);

                return (
                  <tr key={vid.filename} className={`transition-colors ${isActive ? 'bg-blue-950/30' : 'hover:bg-slate-800/40'}`}>
                    <td className="py-3 px-4 text-white font-medium flex items-center gap-2">
                      <FileVideo className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span>{vid.filename}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {vid.sizeFormatted}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">
                      {vid.uploadedAt}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[10px] font-bold uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          Active Source
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Standby</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-sans space-x-2">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleSetSource('video', vid.path || vid.filename)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Set Active</span>
                        </button>
                      )}

                      {vid.filename !== 'carpark_video.mp4' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteVideo(vid.filename)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete footage file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {videos.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    No videos found in library. Upload a file above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Non-blocking Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(videoToDelete)}
        title={`Delete Footage "${videoToDelete || ''}"`}
        message={`Are you sure you want to delete ${videoToDelete || ''} from the uploads directory? This cannot be undone.`}
        confirmLabel="Delete Video"
        isDestructive={true}
        onConfirm={executeDeleteVideo}
        onCancel={() => setVideoToDelete(null)}
      />
    </div>
  );
};
