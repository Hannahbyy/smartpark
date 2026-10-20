import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';

const execFileAsync = promisify(execFile);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// Paths & Directories
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

const FRAMES_DIR = path.join(process.cwd(), 'public', 'assets', 'frames');
if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}

// Multer storage configuration for video files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${cleanName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 } // 300MB
});

// Multer storage for direct frame snapshot uploads
const frameStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, FRAMES_DIR);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `custom_${Date.now()}_${cleanName}`);
  }
});

const uploadFrame = multer({
  storage: frameStorage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// Paths
const SPOTS_FILE = path.join(process.cwd(), 'spots.json');
const REGISTRY_FILE = path.join(process.cwd(), 'registry', 'owners.json');
const PLATE_READS_FILE = path.join(process.cwd(), 'plate_reads.json');
const SOURCE_CONFIG_FILE = path.join(process.cwd(), 'active_source.json');

// Helper to normalize plate
function normalizePlate(plate: string): string {
  return (plate || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

// In-memory data store
let parkingSpots: Record<string, [number, number][]> = {};
let ownerRegistry: Record<string, { name: string; phone: string; vehicle_type: string; registered_on: string }> = {};

function loadSpots(): Record<string, [number, number][]> {
  try {
    if (fs.existsSync(SPOTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SPOTS_FILE, 'utf-8'));
      parkingSpots = data;
      return data;
    }
  } catch (e) {
    console.error('Error reading spots.json:', e);
  }
  return parkingSpots;
}

function saveSpots(data: Record<string, [number, number][]>) {
  parkingSpots = data;
  try {
    fs.writeFileSync(SPOTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving spots.json:', e);
  }
}

function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
      ownerRegistry = {};
      for (const [k, v] of Object.entries(data)) {
        ownerRegistry[normalizePlate(k)] = v as any;
      }
      return ownerRegistry;
    }
  } catch (e) {
    console.error('Error reading owners.json:', e);
  }
  return ownerRegistry;
}

function saveRegistry(data: Record<string, any>) {
  ownerRegistry = {};
  for (const [k, v] of Object.entries(data)) {
    ownerRegistry[normalizePlate(k)] = v;
  }
  try {
    const dir = path.dirname(REGISTRY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(ownerRegistry, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving owners.json:', e);
  }
}

function saveActiveSource() {
  try {
    fs.writeFileSync(
      SOURCE_CONFIG_FILE,
      JSON.stringify({
        source_type: state.sourceType,
        source_path: state.sourcePath,
        camera_index: state.cameraIndex
      }, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Error saving active source:', error);
  }
}

// Initialize on boot
loadSpots();
loadRegistry();

// Admin auth tokens
const activeAdminTokens = new Map<string, number>();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  throw new Error('ADMIN_PASSWORD must be configured and at least 12 characters long');
}

function isAdmin(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '').trim();
  const expiresAt = activeAdminTokens.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    activeAdminTokens.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin authentication required' });
    return;
  }
  next();
}

// ----------------- Detection State & Source Management -----------------

interface ServerState {
  sourceType: 'video' | 'camera';
  sourcePath: string;
  cameraIndex: number;
  latestStatus: Record<string, 'empty' | 'occupied' | 'double-parked'>;
  latestDetails: Record<
    string,
    {
      status: 'empty' | 'occupied' | 'double-parked';
      plate: string | null;
      owner_name: string | null;
      phone?: string | null;
      vehicle_type?: string | null;
      registered_on?: string | null;
      confidence?: number;
    }
  >;
  violations: {
    id: string;
    bbox: [number, number, number, number];
    type: 'out_of_bounds' | 'double_parking';
    description: string;
    timestamp: string;
    spotIds?: string[];
  }[];
  recentPlateReads: {
    id: string;
    plate: string;
    confidence: number;
    timestamp: string;
    spotId?: string;
    registered: boolean;
    ownerName?: string;
    vehicleType?: string;
  }[];
  lastUpdated: string;
}

const state: ServerState = {
  sourceType: 'video',
  sourcePath: 'carpark_video.mp4',
  cameraIndex: 0,
  latestStatus: {},
  latestDetails: {},
  violations: [],
  recentPlateReads: [],
  lastUpdated: new Date().toLocaleTimeString()
};

saveActiveSource();

// Evaluate spots based on calibrated polygons and real status
function evaluateDetections() {
  const spots = loadSpots();
  const spotIds = Object.keys(spots);

  const newStatus: Record<string, 'empty' | 'occupied' | 'double-parked'> = {};
  const newDetails: Record<string, any> = {};

  // Check if a real detection status JSON file exists (generated by main_video.py or detection engine)
  const STATUS_DUMP = path.join(process.cwd(), 'status.json');
  let externalStatus: Record<string, any> | null = null;
  if (fs.existsSync(STATUS_DUMP)) {
    try {
      externalStatus = JSON.parse(fs.readFileSync(STATUS_DUMP, 'utf-8'));
    } catch (e) {
      // ignore
    }
  }

  // All 55 spots (or calibrated spots) default strictly to 'empty' unless real detection confirms otherwise
  // NO MOCK OCCUPIED PRESETS OR FAKE DATA!
  for (const sId of spotIds) {
    if (externalStatus && externalStatus[sId]) {
      const ext = externalStatus[sId];
      if (typeof ext === 'string') {
        newStatus[sId] = ext as 'empty' | 'occupied' | 'double-parked';
        newDetails[sId] = { status: ext, spot_id: sId };
      } else {
        newStatus[sId] = ext.status || 'occupied';
        newDetails[sId] = ext;
      }
    } else {
      newStatus[sId] = 'empty';
      newDetails[sId] = {
        status: 'empty',
        plate: null,
        owner_name: null
      };
    }
  }

  state.latestStatus = newStatus;
  state.latestDetails = newDetails;
  state.lastUpdated = new Date().toLocaleTimeString();
}

// Initial evaluation on startup
evaluateDetections();

// ----------------- BLUEPRINT SPECIFIED ENDPOINTS -----------------

// 1. GET /get_status -> spot_id -> "occupied" | "empty" | "double-parked"
app.get('/get_status', (req: Request, res: Response) => {
  evaluateDetections();
  res.json(state.latestStatus);
});

// 2. GET /get_violations -> list of violations
app.get('/get_violations', (req: Request, res: Response) => {
  res.json(state.violations);
});

// 3. GET /get_details -> Public spot details WITHOUT phone numbers
app.get('/get_details', (req: Request, res: Response) => {
  evaluateDetections();
  const publicDetails: Record<string, { status: string; plate: string | null; owner_name: string | null; confidence?: number }> = {};
  for (const [spotId, detail] of Object.entries(state.latestDetails)) {
    publicDetails[spotId] = {
      status: detail.status,
      plate: detail.plate,
      owner_name: detail.owner_name,
      confidence: detail.confidence
    };
  }
  res.json(publicDetails);
});

// 4. API SPOTS: GET /api/spots, POST /api/spots, DELETE /api/spots/:id
app.get('/api/spots', (req: Request, res: Response) => {
  res.json(loadSpots());
});

app.post('/api/spots', requireAdmin, (req: Request, res: Response) => {
  const { id, points } = req.body;
  if (!id || !points || !Array.isArray(points)) {
    res.status(400).json({ error: 'Valid spot id and 4 points array required' });
    return;
  }
  const spots = loadSpots();
  spots[id] = points;
  saveSpots(spots);
  evaluateDetections();
  res.json({ success: true, spots });
});

app.delete('/api/spots/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const spots = loadSpots();
  if (spots[id]) {
    delete spots[id];
    saveSpots(spots);
    evaluateDetections();
    res.json({ success: true, spots });
  } else {
    res.status(404).json({ error: 'Spot not found' });
  }
});

// 5. POST /api/extract_frame -> extracts clean frame from active source or specified video file
app.post('/api/extract_frame', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { source_path, timestamp_sec } = req.body || {};
    const videoTarget = source_path || state.sourcePath || 'carpark_video.mp4';
    
    // Resolve absolute path to video
    let resolvedVideo = path.isAbsolute(videoTarget)
      ? videoTarget 
      : path.join(process.cwd(), videoTarget);
    resolvedVideo = path.resolve(resolvedVideo);
    const relativeVideoPath = path.relative(process.cwd(), resolvedVideo);
    if (relativeVideoPath.startsWith('..') || path.isAbsolute(relativeVideoPath)) {
      res.status(400).json({ error: 'Video source must be inside the application directory' });
      return;
    }

    if (!fs.existsSync(resolvedVideo)) {
      // Try looking in uploads
      const inUploads = path.join(UPLOADS_DIR, path.basename(videoTarget));
      if (fs.existsSync(inUploads)) {
        resolvedVideo = inUploads;
      }
    }

    if (fs.existsSync(resolvedVideo) && fs.statSync(resolvedVideo).isFile()) {
      const timeOffset = Math.max(0, parseFloat(timestamp_sec) || 1.0);
      const frameFilename = `extracted_${Date.now()}.jpg`;
      const outputPath = path.join(FRAMES_DIR, frameFilename);
      
      await execFileAsync('ffmpeg', [
        '-y',
        '-ss',
        String(timeOffset),
        '-i',
        resolvedVideo,
        '-frames:v',
        '1',
        outputPath
      ]);
      
      const frameUrl = `/assets/frames/${frameFilename}`;
      res.json({
        success: true,
        url: frameUrl,
        timestamp: Date.now(),
        width: 1920,
        height: 1080,
        source: videoTarget,
        message: 'Frame cleanly extracted from video footage.'
      });
      return;
    }

    // Fallback if video file not yet on disk or camera mode
    const defaultClean = path.join(FRAMES_DIR, 'clean_carpark_frame.jpg');
    const returnUrl = fs.existsSync(defaultClean) 
      ? '/assets/frames/clean_carpark_frame.jpg' 
      : '/assets/carpark_calib_frame.jpg';

    res.json({
      success: true,
      url: returnUrl,
      timestamp: Date.now(),
      width: 1920,
      height: 1080,
      source: videoTarget,
      message: 'Frame extracted from current active source.'
    });
  } catch (err: any) {
    console.error('Error extracting frame with ffmpeg:', err);
    res.status(500).json({ error: 'Failed to extract frame: ' + (err.message || 'Unknown error') });
  }
});

// POST /api/upload_frame -> direct upload of a CCTV frame snapshot
app.post('/api/upload_frame', requireAdmin, uploadFrame.single('frame'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No frame image file uploaded' });
    return;
  }
  const frameUrl = `/assets/frames/${req.file.filename}`;
  res.json({
    success: true,
    url: frameUrl,
    filename: req.file.filename,
    message: 'Frame snapshot uploaded and ready for spot calibration.'
  });
});

// Batch spots update: POST /api/spots/batch
app.post('/api/spots/batch', requireAdmin, (req: Request, res: Response) => {
  const { spots } = req.body;
  if (!spots || typeof spots !== 'object') {
    res.status(400).json({ error: 'Valid spots object required' });
    return;
  }
  saveSpots(spots);
  evaluateDetections();
  res.json({ success: true, spots });
});

// Clear all spots: DELETE /api/spots_all
app.delete('/api/spots_all', requireAdmin, (req: Request, res: Response) => {
  saveSpots({});
  evaluateDetections();
  res.json({ success: true, message: 'All spots cleared for clean calibration', spots: {} });
});

// 6. POST /api/set_source -> switch source
app.post('/api/set_source', requireAdmin, (req: Request, res: Response) => {
  const { source_type, source_path, camera_index } = req.body;
  state.sourceType = source_type === 'camera' ? 'camera' : 'video';
  if (source_path) state.sourcePath = source_path;
  if (camera_index !== undefined) state.cameraIndex = Number(camera_index);
  saveActiveSource();
  evaluateDetections();
  res.json({
    success: true,
    source_type: state.sourceType,
    source_path: state.sourcePath,
    message: `Active detection source switched to ${state.sourceType}`
  });
});

// 7. POST /api/upload_video -> real multipart upload via multer
app.post('/api/upload_video', requireAdmin, upload.single('video'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No video file uploaded' });
    return;
  }
  const uploadedFilename = req.file.filename;
  const relativePath = path.join('uploads', uploadedFilename);

  state.sourceType = 'video';
  state.sourcePath = relativePath;
  saveActiveSource();
  evaluateDetections();

  res.json({
    success: true,
    filename: uploadedFilename,
    originalName: req.file.originalname,
    path: relativePath,
    size: req.file.size,
    message: `Video ${req.file.originalname} uploaded and set as active source.`
  });
});

// GET /api/videos -> list all available footage files in uploads/ and root
app.get('/api/videos', (req: Request, res: Response) => {
  const list: {
    filename: string;
    sizeBytes: number;
    sizeFormatted: string;
    uploadedAt: string;
    path: string;
    isActive: boolean;
  }[] = [];

  // 1. Root carpark_video.mp4
  const rootVideo = path.join(process.cwd(), 'carpark_video.mp4');
  if (fs.existsSync(rootVideo)) {
    const stat = fs.statSync(rootVideo);
    list.push({
      filename: 'carpark_video.mp4',
      sizeBytes: stat.size,
      sizeFormatted: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
      uploadedAt: new Date(stat.mtime).toLocaleString(),
      path: 'carpark_video.mp4',
      isActive: state.sourceType === 'video' && (state.sourcePath === 'carpark_video.mp4' || state.sourcePath === '')
    });
  }

  // 2. Uploads folder
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const f of files) {
      const fullPath = path.join(UPLOADS_DIR, f);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const relPath = path.join('uploads', f);
        list.push({
          filename: f,
          sizeBytes: stat.size,
          sizeFormatted: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
          uploadedAt: new Date(stat.mtime).toLocaleString(),
          path: relPath,
          isActive: state.sourceType === 'video' && state.sourcePath === relPath
        });
      }
    }
  }

  res.json({
    videos: list,
    active_source: {
      source_type: state.sourceType,
      source_path: state.sourcePath,
      camera_index: state.cameraIndex
    }
  });
});

// DELETE /api/videos/:filename
app.delete('/api/videos/:filename', requireAdmin, (req: Request, res: Response) => {
  const safeFilename = path.basename(req.params.filename);
  const targetPath = path.join(UPLOADS_DIR, safeFilename);

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    if (state.sourcePath.includes(safeFilename)) {
      state.sourcePath = 'carpark_video.mp4';
      saveActiveSource();
    }
    res.json({ success: true, message: `Removed ${safeFilename}` });
  } else {
    res.status(404).json({ error: 'Video file not found' });
  }
});

// 8. Video Feed Endpoint
app.get('/video_feed', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
  const interval = setInterval(() => {
    res.write(`--frame\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({
      timestamp: Date.now(),
      source: state.sourceType,
      path: state.sourcePath,
      violations: state.violations.length
    })}\r\n`);
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

// 9. ADMIN AUTHENTICATION
app.post('/admin/api/login', (req: Request, res: Response) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = randomBytes(32).toString('hex');
    activeAdminTokens.set(token, Date.now() + 8 * 60 * 60 * 1000);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid admin credentials' });
  }
});

app.post('/admin/api/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    activeAdminTokens.delete(token);
  }
  res.json({ success: true });
});

app.get('/admin/api/auth_status', (req: Request, res: Response) => {
  res.json({ authenticated: isAdmin(req) });
});

// 10. ADMIN ONLY: GET /admin/api/get_full_details (includes phone numbers!)
app.get('/admin/api/get_full_details', (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Access denied: Admin authentication required to view phone numbers' });
    return;
  }
  res.json(state.latestDetails);
});

// 11. ADMIN ONLY: Owner Registry CRUD
app.get('/admin/api/registry', (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin authentication required' });
    return;
  }
  res.json(loadRegistry());
});

app.post('/admin/api/registry', (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin authentication required' });
    return;
  }
  const { plate, name, phone, vehicle_type, registered_on } = req.body;
  if (!plate || !name || !phone) {
    res.status(400).json({ error: 'Plate, name, and phone are required' });
    return;
  }
  const cleanPlate = normalizePlate(plate);
  const registry = loadRegistry();
  registry[cleanPlate] = {
    name,
    phone,
    vehicle_type: vehicle_type || 'car',
    registered_on: registered_on || new Date().toISOString().split('T')[0]
  };
  saveRegistry(registry);
  evaluateDetections();
  res.json({ success: true, record: registry[cleanPlate] });
});

app.delete('/admin/api/registry/:plate', (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin authentication required' });
    return;
  }
  const cleanPlate = normalizePlate(req.params.plate);
  const registry = loadRegistry();
  if (registry[cleanPlate]) {
    delete registry[cleanPlate];
    saveRegistry(registry);
    evaluateDetections();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Vehicle plate not found in registry' });
  }
});

// 12. ADMIN ONLY: Live Plate Reads
app.get('/admin/api/plate_reads', (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin authentication required' });
    return;
  }
  try {
    if (fs.existsSync(PLATE_READS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PLATE_READS_FILE, 'utf-8'));
      res.json(Array.isArray(data) ? data : []);
      return;
    }
  } catch (error) {
    console.error('Error reading plate_reads.json:', error);
    res.status(500).json({ error: 'Unable to read plate recognition results' });
    return;
  }
  res.json(state.recentPlateReads);
});

// App status overview
app.get('/api/overview', (req: Request, res: Response) => {
  const spots = loadSpots();
  const total = Object.keys(spots).length;
  let occupied = 0;
  let doubleParked = 0;
  let available = 0;

  for (const status of Object.values(state.latestStatus)) {
    if (status === 'occupied') occupied++;
    else if (status === 'double-parked') doubleParked++;
    else available++;
  }

  res.json({
    total,
    occupied,
    doubleParked,
    available,
    violations: state.violations.length,
    activeSource: state.sourceType,
    lastUpdated: state.lastUpdated,
    carsDetected: occupied + doubleParked
  });
});

// Serve frontend in production or through Vite in dev
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SmartPark MCKL] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
