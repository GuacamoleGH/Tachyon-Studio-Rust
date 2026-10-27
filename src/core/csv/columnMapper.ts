import { StandardSignalKey, STANDARD_SIGNALS } from '../model/telemetry';

export interface ColumnMappingConfig {
  headerToSignal: Record<string, StandardSignalKey>;
  signalToHeader: Partial<Record<StandardSignalKey, string>>;
  unitConversions: Partial<Record<StandardSignalKey, (val: number) => number>>;
  detectedFormat: 'official_wide' | 'sparse_multisource' | 'custom_mapped';
}

// Lista de posibles nombres de columnas para cada señal interna
export const SIGNAL_ALIASES: Record<StandardSignalKey, string[]> = {
  time_offset_video_sec: [
    'time_offset_video_sec',
    't_video',
    'time_video',
    'video_time_sec',
    'time_sec',
    'offset_video_sec',
    'time',
  ],
  time_offset_session_sec: [
    'time_offset_session_sec',
    't_session',
    'session_time_sec',
    'offset_session_sec',
  ],
  timestamp_utc_ms: ['timestamp_utc_ms', 'utc_ms', 'timestamp_ms', 'timestamp', 'time_utc_ms'],
  monotonic_nanos: [
    'monotonic_nanos',
    'elapsed_realtime_nanos',
    'monotonic_time_ns',
    'mono_nanos',
  ],
  latitude: ['latitude', 'lat', 'gps_latitude', 'gps_lat'],
  longitude: ['longitude', 'lon', 'lng', 'gps_longitude', 'gps_lon', 'gps_lng'],
  altitude_m: ['altitude_m', 'altitude', 'alt', 'ele', 'elevation_m'],
  gps_speed_kmh: ['gps_speed_kmh', 'speed_kmh', 'gps_speed', 'speed', 'speed_ms'],
  bearing_deg: ['bearing_deg', 'bearing', 'heading', 'track_deg'],
  accuracy_m: ['accuracy_m', 'accuracy', 'acc', 'gps_accuracy_m'],
  lateral_g: ['lateral_g', 'lat_g', 'accel_lat_g', 'accel_lat_ms2', 'accel_lat'],
  longitudinal_g: ['longitudinal_g', 'long_g', 'accel_long_g', 'accel_long_ms2', 'accel_long'],
  engine_rpm: ['engine_rpm', 'rpm', 'obd_rpm', 'motor_rpm'],
  obd_speed_kmh: ['obd_speed_kmh', 'obd_speed', 'vehicle_speed', 'speed_obd'],
  throttle_pct: ['throttle_pct', 'throttle', 'tps', 'pedal_pct', 'pedal', 'accel_pedal_pct'],
  coolant_temp_c: ['coolant_temp_c', 'coolant_c', 'coolant', 'water_temp_c', 'ect'],
  gear: ['gear', 'current_gear', 'gear_num', 'transmission_gear', 'selected_gear'],
  boost_bar: ['boost_bar', 'boost', 'turbo_bar', 'turbo', 'boost_psi', 'map_kpa', 'pressure_bar', 'manifold_boost'],
  fuel_l100km: ['fuel_l100km', 'fuel_consumption', 'consumption', 'fuel_rate_l100km', 'l100km', 'l_100km', 'fuel_econ'],
  intake_temp_c: ['intake_temp_c', 'intake_temp', 'iat', 'iat_c', 'intake_air_temp', 'intake_c', 'air_temp_c'],
  accel_x: ['accel_x', 'accel_x_raw', 'raw_accel_x'],
  accel_y: ['accel_y', 'accel_y_raw', 'raw_accel_y'],
  accel_z: ['accel_z', 'accel_z_raw', 'raw_accel_z'],
};

/**
 * Detecta automáticamente el mapeo óptimo para un conjunto de cabeceras CSV.
 */
export function detectColumnMapping(headers: string[]): ColumnMappingConfig {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

  // Comprobar formato oficial de Tachyon
  const matchesOfficial =
    normalizedHeaders.includes('time_offset_video_sec') &&
    normalizedHeaders.includes('latitude') &&
    normalizedHeaders.includes('lateral_g') &&
    normalizedHeaders.includes('engine_rpm');

  const matchesSparse =
    normalizedHeaders.includes('source') &&
    (normalizedHeaders.includes('lat') || normalizedHeaders.includes('speed_ms') || normalizedHeaders.includes('rpm'));

  let detectedFormat: 'official_wide' | 'sparse_multisource' | 'custom_mapped' = 'custom_mapped';
  if (matchesOfficial) {
    detectedFormat = 'official_wide';
  } else if (matchesSparse) {
    detectedFormat = 'sparse_multisource';
  }

  const headerToSignal: Record<string, StandardSignalKey> = {};
  const signalToHeader: Partial<Record<StandardSignalKey, string>> = {};
  const unitConversions: Partial<Record<StandardSignalKey, (val: number) => number>> = {};

  // Recorrer cada señal estándar y encontrar la cabecera correspondiente
  const standardKeys = Object.keys(STANDARD_SIGNALS) as StandardSignalKey[];

  for (const sigKey of standardKeys) {
    const aliases = SIGNAL_ALIASES[sigKey] || [sigKey];
    let matchedHeader: string | null = null;

    for (const alias of aliases) {
      const idx = normalizedHeaders.indexOf(alias.toLowerCase());
      if (idx !== -1) {
        matchedHeader = headers[idx];
        break;
      }
    }

    if (matchedHeader) {
      headerToSignal[matchedHeader] = sigKey;
      signalToHeader[sigKey] = matchedHeader;

      const normMatched = matchedHeader.trim().toLowerCase();
      // Conversiones de unidades automáticas basadas en el nombre de la cabecera encontrada
      if (sigKey === 'gps_speed_kmh' && (normMatched === 'speed_ms' || normMatched.endsWith('_ms'))) {
        unitConversions[sigKey] = (mPerSec: number) => mPerSec * 3.6;
      } else if (
        (sigKey === 'lateral_g' || sigKey === 'longitudinal_g') &&
        (normMatched.includes('_ms2') || normMatched.endsWith('ms2'))
      ) {
        unitConversions[sigKey] = (ms2: number) => ms2 / 9.80665;
      } else if (sigKey === 'boost_bar' && normMatched.includes('psi')) {
        unitConversions[sigKey] = (psi: number) => psi * 0.0689476;
      }
    }
  }

  return {
    headerToSignal,
    signalToHeader,
    unitConversions,
    detectedFormat,
  };
}
