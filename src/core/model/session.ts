import { StandardSignalKey, TelemetryPoint } from './telemetry';

export type ConfigSource = 'manual' | 'app' | 'saved' | 'default';

export interface VehicleConfig {
  max_rpm: number;
  redline_rpm: number;
  shift_light_rpm: number;
}

export interface VehicleConfigWithOrigin {
  config: VehicleConfig;
  source: ConfigSource;
  sourceDescription: string;
}

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  max_rpm: 7500,
  redline_rpm: 6500,
  shift_light_rpm: 6000,
};

export interface SessionMetadataRaw {
  schema_version?: string;
  generator?: string;
  session?: {
    id?: string;
    title?: string;
    status?: string;
    start_time_iso?: string;
    start_time_utc_ms?: number;
    end_time_utc_ms?: number;
    start_monotonic_nanos?: number;
    duration_seconds?: number;
    total_distance_meters?: number;
    max_speed_kmh?: number;
    avg_speed_kmh?: number;
    point_count?: number;
  };
  vehicle_config?: Partial<VehicleConfig>;
  video_synchronization?: {
    has_video?: boolean;
    video_filename?: string;
    video_start_monotonic_nanos?: number;
    video_start_epoch_ms?: number;
    telemetry_to_video_offset_ms?: number;
    sync_formula?: string;
  };
  signals?: Record<string, { unit?: string; source?: string; desc?: string }>;

  // Campos alternativos de sesión sintética o exportadores externos
  session_id?: string;
  started_utc?: string;
  vehicle?: { name?: string; fuel?: string };
  obd_adapter?: { name?: string; protocol?: string };
  video?: {
    file?: string;
    width?: number;
    height?: number;
    fps?: number;
    duration_sec?: number;
    frame0_elapsed_realtime_nanos?: number;
    frame0_utc_ms?: number;
    note?: string;
  };
  channels?: Record<string, { nominal_hz?: number; effective_hz?: number }>;
  events?: Array<{
    type: string;
    start_sec: number;
    end_sec: number;
    description?: string;
  }>;
  stats?: {
    distance_m?: number;
    max_speed_kmh?: number;
    avg_speed_kmh?: number;
  };
  [key: string]: unknown;
}

export interface SessionEvent {
  id: string;
  type: 'gps_lost' | 'obd_disconnected' | 'session_pause' | 'custom';
  title: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  source: 'app_json' | 'detected_gap';
}

export interface SignalStats {
  signalKey: StandardSignalKey;
  label: string;
  unit: string;
  category: 'SYSTEM' | 'GPS' | 'IMU' | 'OBD';
  foundInCsv: boolean;
  sampleCount: number;
  effectiveHz: number;
  nominalHz?: number;
  min?: number;
  max?: number;
  avg?: number;
  gapCount: number;
  maxGapSec: number;
  gaps: Array<{ startSec: number; endSec: number; durationSec: number }>;
}

export interface SessionBundle {
  id: string;
  title: string;
  startTimeIso: string;
  durationSec: number;
  totalDistanceMeters: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  totalPoints: number;

  hasVideo: boolean;
  videoFileName?: string;
  videoBlob?: Blob;
  videoUrl?: string;
  videoPath?: string;
  videoSource?: any;
  videoStoredInZip?: boolean;
  videoCompressedInZip?: boolean;
  videoZipPath?: string;
  videoOversized?: boolean;
  videoLoadWarning?: string;

  rawCsvText: string;
  points: TelemetryPoint[];
  timeRange: { minSec: number; maxSec: number };

  rawJsonText?: string;
  metadata?: SessionMetadataRaw;

  rawGpxText?: string;
  rawReadmeText?: string;

  vehicleConfigWithOrigin: VehicleConfigWithOrigin;
  signalsStats: Record<StandardSignalKey, SignalStats>;
  events: SessionEvent[];

  // Detección del formato de entrada
  csvFormat: 'official_wide' | 'sparse_multisource' | 'custom_mapped';
}
