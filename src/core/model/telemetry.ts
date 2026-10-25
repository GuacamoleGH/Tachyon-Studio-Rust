/**
 * Identificadores normalizados de señales internas en Tachyon Studio.
 */
export type StandardSignalKey =
  | 'time_offset_video_sec'
  | 'time_offset_session_sec'
  | 'timestamp_utc_ms'
  | 'monotonic_nanos'
  | 'latitude'
  | 'longitude'
  | 'altitude_m'
  | 'gps_speed_kmh'
  | 'bearing_deg'
  | 'accuracy_m'
  | 'lateral_g'
  | 'longitudinal_g'
  | 'engine_rpm'
  | 'obd_speed_kmh'
  | 'throttle_pct'
  | 'coolant_temp_c'
  | 'accel_x'
  | 'accel_y'
  | 'accel_z';

export interface SignalDefinition {
  key: StandardSignalKey;
  label: string;
  unit: string;
  category: 'SYSTEM' | 'GPS' | 'IMU' | 'OBD';
  description: string;
  defaultMaxGapSec: number; // Tiempo sin muestras tras el cual se considera N/D o corte
  isPrimaryForUI?: boolean;
}

export const STANDARD_SIGNALS: Record<StandardSignalKey, SignalDefinition> = {
  time_offset_video_sec: {
    key: 'time_offset_video_sec',
    label: 'Tiempo Vídeo',
    unit: 's',
    category: 'SYSTEM',
    description: 'Segundos relativos al frame 0 del vídeo (t=0.000 es inicio de vídeo)',
    defaultMaxGapSec: 0.5,
  },
  time_offset_session_sec: {
    key: 'time_offset_session_sec',
    label: 'Tiempo Sesión',
    unit: 's',
    category: 'SYSTEM',
    description: 'Segundos relativos al inicio de la sesión grabada',
    defaultMaxGapSec: 0.5,
  },
  timestamp_utc_ms: {
    key: 'timestamp_utc_ms',
    label: 'Marca UTC',
    unit: 'ms',
    category: 'SYSTEM',
    description: 'Época Unix en milisegundos',
    defaultMaxGapSec: 1.0,
  },
  monotonic_nanos: {
    key: 'monotonic_nanos',
    label: 'Reloj Monotónico',
    unit: 'ns',
    category: 'SYSTEM',
    description: 'Reloj monotónico del hardware (elapsedRealtimeNanos)',
    defaultMaxGapSec: 1.0,
  },
  latitude: {
    key: 'latitude',
    label: 'Latitud',
    unit: '°',
    category: 'GPS',
    description: 'Latitud WGS84 Fused Location',
    defaultMaxGapSec: 2.0,
    isPrimaryForUI: true,
  },
  longitude: {
    key: 'longitude',
    label: 'Longitud',
    unit: '°',
    category: 'GPS',
    description: 'Longitud WGS84 Fused Location',
    defaultMaxGapSec: 2.0,
    isPrimaryForUI: true,
  },
  altitude_m: {
    key: 'altitude_m',
    label: 'Altitud',
    unit: 'm',
    category: 'GPS',
    description: 'Altitud sobre nivel del mar WGS84',
    defaultMaxGapSec: 2.0,
  },
  gps_speed_kmh: {
    key: 'gps_speed_kmh',
    label: 'Velocidad GPS',
    unit: 'km/h',
    category: 'GPS',
    description: 'Velocidad Doppler / Fused Location',
    defaultMaxGapSec: 2.0,
    isPrimaryForUI: true,
  },
  bearing_deg: {
    key: 'bearing_deg',
    label: 'Rumbo',
    unit: '°',
    category: 'GPS',
    description: 'Rumbo GPS azimut (0-360°)',
    defaultMaxGapSec: 2.0,
  },
  accuracy_m: {
    key: 'accuracy_m',
    label: 'Precisión GPS',
    unit: 'm',
    category: 'GPS',
    description: 'Radio de precisión estimada en metros',
    defaultMaxGapSec: 2.0,
  },
  lateral_g: {
    key: 'lateral_g',
    label: 'Fuerza G Lateral',
    unit: 'G',
    category: 'IMU',
    description: 'Aceleración inercial lateral del vehículo (1G=9.80665 m/s²)',
    defaultMaxGapSec: 0.5,
    isPrimaryForUI: true,
  },
  longitudinal_g: {
    key: 'longitudinal_g',
    label: 'Fuerza G Longitudinal',
    unit: 'G',
    category: 'IMU',
    description: 'Aceleración inercial longitudinal del vehículo',
    defaultMaxGapSec: 0.5,
    isPrimaryForUI: true,
  },
  engine_rpm: {
    key: 'engine_rpm',
    label: 'Revoluciones Motor',
    unit: 'RPM',
    category: 'OBD',
    description: 'Régimen de giro OBD-II (PID 010C)',
    defaultMaxGapSec: 1.5,
    isPrimaryForUI: true,
  },
  obd_speed_kmh: {
    key: 'obd_speed_kmh',
    label: 'Velocidad OBD',
    unit: 'km/h',
    category: 'OBD',
    description: 'Velocidad del velocímetro del vehículo vía OBD-II (PID 010D)',
    defaultMaxGapSec: 1.5,
  },
  throttle_pct: {
    key: 'throttle_pct',
    label: 'Pedal / Acelerador',
    unit: '%',
    category: 'OBD',
    description: 'Posición de pedal o mariposa OBD-II (PID 0111/0149)',
    defaultMaxGapSec: 1.5,
    isPrimaryForUI: true,
  },
  coolant_temp_c: {
    key: 'coolant_temp_c',
    label: 'Temp. Refrigerante',
    unit: '°C',
    category: 'OBD',
    description: 'Temperatura del refrigerante OBD-II (PID 0105)',
    defaultMaxGapSec: 5.0,
  },
  accel_x: {
    key: 'accel_x',
    label: 'Acel. Bruta X',
    unit: 'm/s²',
    category: 'IMU',
    description: 'Acelerómetro del móvil eje X',
    defaultMaxGapSec: 0.5,
  },
  accel_y: {
    key: 'accel_y',
    label: 'Acel. Bruta Y',
    unit: 'm/s²',
    category: 'IMU',
    description: 'Acelerómetro del móvil eje Y',
    defaultMaxGapSec: 0.5,
  },
  accel_z: {
    key: 'accel_z',
    label: 'Acel. Bruta Z',
    unit: 'm/s²',
    category: 'IMU',
    description: 'Acelerómetro del móvil eje Z',
    defaultMaxGapSec: 0.5,
  },
};

/**
 * Muestra normalizada de telemetría en un instante dado.
 * Si una señal no fue muestreada o es ausente, su valor es `null` (NUNCA 0).
 */
export interface TelemetryPoint {
  time_offset_video_sec: number;
  time_offset_session_sec?: number | null;
  timestamp_utc_ms?: number | null;
  monotonic_nanos?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude_m?: number | null;
  gps_speed_kmh?: number | null;
  bearing_deg?: number | null;
  accuracy_m?: number | null;
  lateral_g?: number | null;
  longitudinal_g?: number | null;
  engine_rpm?: number | null;
  obd_speed_kmh?: number | null;
  throttle_pct?: number | null;
  coolant_temp_c?: number | null;
  accel_x?: number | null;
  accel_y?: number | null;
  accel_z?: number | null;
  // Campos auxiliares de origen
  source?: string | null;
}
