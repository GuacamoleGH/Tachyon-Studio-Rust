import { VehicleConfig } from '../model/session';

export type ShiftLightPattern = 'left_to_right' | 'center_out' | 'right_to_left';

export interface ShiftLightColorRange {
  fromLed: number;
  toLed: number;
  color: string;
}

export interface ShiftLightsConfig {
  enabled: boolean;
  led_count: number;
  start_rpm: number;       // Primera luz encendida
  all_on_rpm: number;      // Todas las luces encendidas fijas
  flash_rpm: number;       // Régimen donde todas parpadean + aviso SHIFT!
  flash_hz: number;        // Frecuencia del parpadeo (por defecto 8 o 6 Hz)
  pattern: ShiftLightPattern;
  colors: ShiftLightColorRange[];
  off_color: string;
}

export interface RpmConfig {
  idle: number;
  scale_max: number;          // Fin de la escala
  redline_start: number;      // Inicio de la zona roja
  limiter?: number;           // Corte de inyección opcional
  major_tick: number;
  minor_tick: number;
  label_divisor: number;      // e.g. 1000 para mostrar 0..8
}

export interface VehicleProfile {
  schema_version: '1.0.0';
  id: string;
  name: string;
  rpm: RpmConfig;
  shift_lights: ShiftLightsConfig;
}

export interface ProfileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const PRESET_GASOLINA_ESTANDAR: VehicleProfile = {
  schema_version: '1.0.0',
  id: 'preset_gasolina',
  name: 'Gasolina Estándar (7500 RPM)',
  rpm: {
    idle: 850,
    scale_max: 7500,
    redline_start: 6500,
    limiter: 7200,
    major_tick: 1000,
    minor_tick: 500,
    label_divisor: 1000,
  },
  shift_lights: {
    enabled: true,
    led_count: 10,
    start_rpm: 5200,
    all_on_rpm: 5800,
    flash_rpm: 6000,
    flash_hz: 8,
    pattern: 'left_to_right',
    colors: [
      { fromLed: 0, toLed: 3, color: '#00E676' }, // Verde
      { fromLed: 4, toLed: 7, color: '#FFB300' }, // Ámbar
      { fromLed: 8, toLed: 9, color: '#FF1744' }, // Rojo
    ],
    off_color: '#1F2937',
  },
};

export const PRESET_MAZDA3: VehicleProfile = {
  schema_version: '1.0.0',
  id: 'preset_mazda3',
  name: 'Mazda3 (8000 RPM)',
  rpm: {
    idle: 750,
    scale_max: 8000,
    redline_start: 6500,
    limiter: 7000,
    major_tick: 1000,
    minor_tick: 500,
    label_divisor: 1000,
  },
  shift_lights: {
    enabled: true,
    led_count: 10,
    start_rpm: 5200,
    all_on_rpm: 6000,
    flash_rpm: 6300,
    flash_hz: 8,
    pattern: 'left_to_right',
    colors: [
      { fromLed: 0, toLed: 3, color: '#00E676' }, // Verde
      { fromLed: 4, toLed: 7, color: '#FFB300' }, // Ámbar
      { fromLed: 8, toLed: 9, color: '#FF1744' }, // Rojo
    ],
    off_color: '#1F2937',
  },
};

export const PRESET_DIESEL: VehicleProfile = {
  schema_version: '1.0.0',
  id: 'preset_diesel',
  name: 'Diésel Turbo (5500 RPM)',
  rpm: {
    idle: 750,
    scale_max: 5500,
    redline_start: 4500,
    limiter: 4800,
    major_tick: 1000,
    minor_tick: 500,
    label_divisor: 1000,
  },
  shift_lights: {
    enabled: true,
    led_count: 10,
    start_rpm: 3400,
    all_on_rpm: 3900,
    flash_rpm: 4100,
    flash_hz: 8,
    pattern: 'center_out',
    colors: [
      { fromLed: 0, toLed: 3, color: '#00E676' },
      { fromLed: 4, toLed: 7, color: '#FFB300' },
      { fromLed: 8, toLed: 9, color: '#FF1744' },
    ],
    off_color: '#1F2937',
  },
};

export const PRESET_DEPORTIVO_ALTAS_VUELTAS: VehicleProfile = {
  schema_version: '1.0.0',
  id: 'preset_gt3',
  name: 'Deportivo Altas Vueltas / GT3 (9000 RPM)',
  rpm: {
    idle: 950,
    scale_max: 9500,
    redline_start: 8500,
    limiter: 9000,
    major_tick: 1000,
    minor_tick: 500,
    label_divisor: 1000,
  },
  shift_lights: {
    enabled: true,
    led_count: 12,
    start_rpm: 7000,
    all_on_rpm: 8000,
    flash_rpm: 8300,
    flash_hz: 8,
    pattern: 'center_out',
    colors: [
      { fromLed: 0, toLed: 3, color: '#00E676' },
      { fromLed: 4, toLed: 7, color: '#00E5FF' },
      { fromLed: 8, toLed: 11, color: '#FF1744' },
    ],
    off_color: '#1F2937',
  },
};

export const VEHICLE_PRESETS: VehicleProfile[] = [
  PRESET_GASOLINA_ESTANDAR,
  PRESET_MAZDA3,
  PRESET_DIESEL,
  PRESET_DEPORTIVO_ALTAS_VUELTAS,
];

/**
 * Valida la coherencia física de los parámetros del perfil de vehículo.
 */
export function validateVehicleProfile(profile: VehicleProfile): ProfileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { idle, scale_max, redline_start, limiter } = profile.rpm;
  const { start_rpm, all_on_rpm, flash_rpm, led_count } = profile.shift_lights;

  if (scale_max <= 0) errors.push('scale_max debe ser mayor que 0.');
  if (idle < 0) errors.push('idle no puede ser negativo.');
  if (idle >= scale_max) errors.push('idle debe ser menor que scale_max.');

  if (redline_start <= idle) errors.push('redline_start debe ser mayor que el ralentí (idle).');
  if (redline_start > scale_max) errors.push('redline_start no puede ser mayor que scale_max.');

  if (limiter && limiter < redline_start) {
    warnings.push('El limitador de corte suele ser mayor o igual que redline_start.');
  }

  if (profile.shift_lights.enabled) {
    if (led_count <= 0) errors.push('led_count debe ser al menos 1.');
    if (start_rpm <= idle) errors.push('start_rpm de las luces debe ser mayor que idle.');
    if (start_rpm > all_on_rpm) errors.push('start_rpm no puede ser mayor que all_on_rpm.');
    if (all_on_rpm > flash_rpm) errors.push('all_on_rpm no puede ser mayor que flash_rpm.');
    if (flash_rpm > scale_max) errors.push('flash_rpm no puede ser mayor que scale_max.');

    if (flash_rpm > redline_start + 500) {
      warnings.push('flash_rpm está significativamente por encima de la línea roja.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Deriva un perfil completo a partir de la configuración `VehicleConfig` de la app Android.
 * La app solo exporta `max_rpm`, `redline_rpm` y `shift_light_rpm`.
 */
export function deriveProfileFromAppConfig(appConfig: VehicleConfig, profileName?: string): VehicleProfile {
  const maxRpm = appConfig.max_rpm;
  const redlineRpm = appConfig.redline_rpm;
  const shiftRpm = appConfig.shift_light_rpm;

  // Derivar start_rpm y all_on_rpm proporcionales
  const startRpm = Math.max(1000, Math.round(shiftRpm - 1000));
  const allOnRpm = Math.max(startRpm + 200, Math.round(shiftRpm - 200));

  return {
    schema_version: '1.0.0',
    id: 'derived_' + Date.now(),
    name: profileName || 'Perfil derivado de la App',
    rpm: {
      idle: 850,
      scale_max: maxRpm,
      redline_start: redlineRpm,
      limiter: maxRpm,
      major_tick: 1000,
      minor_tick: 500,
      label_divisor: 1000,
    },
    shift_lights: {
      enabled: true,
      led_count: 10,
      start_rpm: startRpm,
      all_on_rpm: allOnRpm,
      flash_rpm: shiftRpm,
      flash_hz: 8, // Paridad con render_telemetry_overlay.py (8 Hz)
      pattern: 'left_to_right',
      colors: [
        { fromLed: 0, toLed: 3, color: '#00E676' },
        { fromLed: 4, toLed: 7, color: '#FFB300' },
        { fromLed: 8, toLed: 9, color: '#FF1744' },
      ],
      off_color: '#1F2937',
    },
  };
}

const LOCAL_STORAGE_KEY = 'tachyon_saved_vehicle_profile';

export function saveProfileToStorage(profile: VehicleProfile): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
    }
  } catch (e) {
    console.warn('No se pudo guardar el perfil en localStorage:', e);
  }
}

export function loadProfileFromStorage(): VehicleProfile | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    }
  } catch (e) {
    console.warn('Error leyendo perfil de localStorage:', e);
  }
  return null;
}

export const CUSTOM_PRESETS_STORAGE_KEY = 'tachyon_custom_vehicle_presets';

export function loadCustomPresets(): VehicleProfile[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Error leyendo presets personalizados de localStorage:', e);
  }
  return [];
}

export function saveCustomPreset(preset: VehicleProfile): VehicleProfile[] {
  const current = loadCustomPresets().filter((p) => p.id !== preset.id);
  const updated = [...current, preset];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Error guardando preset personalizado:', e);
  }
  return updated;
}

export function deleteCustomPreset(id: string): VehicleProfile[] {
  const updated = loadCustomPresets().filter((p) => p.id !== id);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Error eliminando preset personalizado:', e);
  }
  return updated;
}
