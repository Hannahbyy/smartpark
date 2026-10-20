export type SpotStatus = 'empty' | 'occupied' | 'double-parked';

export interface SpotCoordinates {
  [spotId: string]: [number, number][]; // 4 corner points [[x,y], [x,y], [x,y], [x,y]]
}

export interface OwnerRecord {
  name: string;
  phone: string;
  vehicle_type: 'car' | 'suv' | 'motorcycle' | 'van';
  registered_on: string;
}

export interface OwnerRegistry {
  [normalizedPlate: string]: OwnerRecord;
}

export interface PublicSpotDetail {
  status: SpotStatus;
  plate: string | null;
  owner_name: string | null;
  confidence?: number;
}

export interface AdminSpotDetail extends PublicSpotDetail {
  phone?: string | null;
  vehicle_type?: string | null;
  registered_on?: string | null;
  overlap_ratios?: { spotId: string; ratio: number }[];
}

export interface Violation {
  id: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  type: 'out_of_bounds' | 'double_parking';
  description: string;
  timestamp: string;
  spotIds?: string[];
}

export interface PlateRead {
  id: string;
  plate: string;
  confidence: number;
  timestamp: string;
  spotId?: string;
  registered: boolean;
  ownerName?: string;
  vehicleType?: string;
}

export interface ServerStateResponse {
  source_type: 'video' | 'camera';
  source_name: string;
  fps: number;
  is_active: boolean;
  total_spots: number;
  occupied_count: number;
  available_count: number;
  violation_count: number;
  last_updated: string;
}

export interface VideoFileInfo {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  uploadedAt: string;
  path: string;
  isActive: boolean;
}

export interface LayoutZoneConfig {
  id: string;
  name: string;
  count: number;
  startIndex: number;
  vertical?: boolean;
  horizontal?: boolean;
  classes?: string;
}
