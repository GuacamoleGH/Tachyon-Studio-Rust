import { SessionBundle, SessionEvent } from '../model/session';
import { STANDARD_SIGNALS, StandardSignalKey, TelemetryPoint } from '../model/telemetry';
import { SignalQueryResult, SignalTimeline } from './signalTimeline';

export interface SignalSnapshot {
  key: StandardSignalKey;
  value: number | null;
  isAvailable: boolean;
  status: 'VALID' | 'GAP_TIMEOUT' | 'EVENT_BLOCKED' | 'OUT_OF_BOUNDS';
  unit: string;
  category: 'GPS' | 'IMU' | 'OBD' | 'SYSTEM';
  label: string;
}

export interface TelemetrySnapshot {
  timeSec: number;
  signals: Record<StandardSignalKey, SignalSnapshot>;
  activeEvents: SessionEvent[];

  // Señales de conveniencia tipadas directamente
  speedKmh: number | null;
  speedAvailable: boolean;
  rpm: number | null;
  rpmAvailable: boolean;
  throttlePct: number | null;
  throttleAvailable: boolean;

  // Aceleraciones separadas
  lateralG: number | null;
  lateralGAvailable: boolean;
  longitudinalG: number | null; // IMU
  longitudinalGAvailable: boolean;
  derivedGpsLongG: number | null; // Derivada de velocidad GPS
  derivedGpsLongGAvailable: boolean;

  // Coordenadas GPS
  latitude: number | null;
  longitude: number | null;
  gpsAvailable: boolean;
  bearingDeg: number | null;
  bearingAvailable: boolean;
}

export interface TimeEngineOptions {
  customMaxGaps?: Partial<Record<StandardSignalKey, number>>;
  enableSmoothing?: boolean;
}

/**
 * Motor de tiempo y sincronización determinista para vídeo y telemetría.
 */
export class TimeEngine {
  private readonly timelines: Map<StandardSignalKey, SignalTimeline> = new Map();
  private readonly events: SessionEvent[] = [];
  public readonly timeRange: { minSec: number; maxSec: number };

  constructor(points: TelemetryPoint[], events: SessionEvent[] = [], options?: TimeEngineOptions) {
    this.events = [...events];

    let minSec = Infinity;
    let maxSec = -Infinity;

    // Agrupar muestras por señal
    const samplesBySignal = new Map<StandardSignalKey, Array<{ t: number; val: number }>>();

    const allKeys = Object.keys(STANDARD_SIGNALS) as StandardSignalKey[];
    for (const key of allKeys) {
      samplesBySignal.set(key, []);
    }

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const t = p.time_offset_video_sec;
      if (t < minSec) minSec = t;
      if (t > maxSec) maxSec = t;

      for (const key of allKeys) {
        const val = p[key];
        if (typeof val === 'number' && !isNaN(val)) {
          samplesBySignal.get(key)!.push({ t, val });
        }
      }
    }

    this.timeRange = {
      minSec: isFinite(minSec) ? minSec : 0,
      maxSec: isFinite(maxSec) ? maxSec : 0,
    };

    // Crear las líneas temporales individuales
    for (const key of allKeys) {
      const samples = samplesBySignal.get(key) || [];
      const customGap = options?.customMaxGaps?.[key];
      const timeline = new SignalTimeline(key, samples, customGap);
      this.timelines.set(key, timeline);
    }
  }

  /**
   * Crea un TimeEngine directamente a partir de un SessionBundle.
   */
  public static fromBundle(bundle: SessionBundle, options?: TimeEngineOptions): TimeEngine {
    return new TimeEngine(bundle.points, bundle.events, options);
  }

  /**
   * Consulta el estado de la telemetría en el instante exacto t del vídeo.
   */
  public query(t: number): TelemetrySnapshot {
    // 1. Identificar eventos activos en t
    const activeEvents = this.events.filter((e) => t >= e.startSec && t <= e.endSec);

    const hasGpsLost = activeEvents.some((e) => e.type === 'gps_lost');
    const hasObdDisc = activeEvents.some((e) => e.type === 'obd_disconnected');

    const signals = {} as Record<StandardSignalKey, SignalSnapshot>;
    const allKeys = Object.keys(STANDARD_SIGNALS) as StandardSignalKey[];

    for (const key of allKeys) {
      const def = STANDARD_SIGNALS[key];
      const timeline = this.timelines.get(key);

      let queryResult: SignalQueryResult;

      // Si hay un evento que bloquea la señal, marcar como EVENT_BLOCKED
      if (def.category === 'GPS' && hasGpsLost) {
        queryResult = { value: null, isAvailable: false, status: 'EVENT_BLOCKED' };
      } else if (def.category === 'OBD' && hasObdDisc) {
        queryResult = { value: null, isAvailable: false, status: 'EVENT_BLOCKED' };
      } else if (timeline) {
        queryResult = timeline.query(t);
      } else {
        queryResult = { value: null, isAvailable: false, status: 'OUT_OF_BOUNDS' };
      }

      signals[key] = {
        key,
        value: queryResult.value,
        isAvailable: queryResult.isAvailable,
        status: queryResult.status,
        unit: def.unit,
        category: def.category,
        label: def.label,
      };
    }

    // 2. Aceleración longitudinal derivada de la velocidad GPS (d v / d t)
    const derivedGpsLongG = this.calculateDerivedGpsAccel(t, hasGpsLost);

    // 3. Empaquetar snapshot
    const speedSignal = signals['gps_speed_kmh']?.isAvailable
      ? signals['gps_speed_kmh']
      : signals['obd_speed_kmh'];

    return {
      timeSec: t,
      signals,
      activeEvents,

      speedKmh: speedSignal?.value ?? null,
      speedAvailable: speedSignal?.isAvailable ?? false,

      rpm: signals['engine_rpm']?.value ?? null,
      rpmAvailable: signals['engine_rpm']?.isAvailable ?? false,

      throttlePct: signals['throttle_pct']?.value ?? null,
      throttleAvailable: signals['throttle_pct']?.isAvailable ?? false,

      lateralG: signals['lateral_g']?.value ?? null,
      lateralGAvailable: signals['lateral_g']?.isAvailable ?? false,

      longitudinalG: signals['longitudinal_g']?.value ?? null,
      longitudinalGAvailable: signals['longitudinal_g']?.isAvailable ?? false,

      derivedGpsLongG: derivedGpsLongG.val,
      derivedGpsLongGAvailable: derivedGpsLongG.isAvailable,

      latitude: signals['latitude']?.value ?? null,
      longitude: signals['longitude']?.value ?? null,
      gpsAvailable: (signals['latitude']?.isAvailable && signals['longitude']?.isAvailable) ?? false,

      bearingDeg: signals['bearing_deg']?.value ?? null,
      bearingAvailable: signals['bearing_deg']?.isAvailable ?? false,
    };
  }

  /**
   * Calcula la aceleración longitudinal a partir de la tasa de cambio de la velocidad GPS.
   * a = (v(t + dt) - v(t - dt)) / (2 * dt * 9.80665 m/s^2)
   */
  private calculateDerivedGpsAccel(
    t: number,
    hasGpsLost: boolean
  ): { val: number | null; isAvailable: boolean } {
    if (hasGpsLost) return { val: null, isAvailable: false };

    const speedTimeline = this.timelines.get('gps_speed_kmh');
    if (!speedTimeline) return { val: null, isAvailable: false };

    const dt = 0.2; // Ventana de diferenciación de 200 ms
    const s1 = speedTimeline.query(t - dt);
    const s2 = speedTimeline.query(t + dt);

    if (s1.isAvailable && s2.isAvailable && s1.value !== null && s2.value !== null) {
      const v1Ms = s1.value / 3.6;
      const v2Ms = s2.value / 3.6;
      const accelMs2 = (v2Ms - v1Ms) / (2 * dt);
      const accelG = accelMs2 / 9.80665;
      return { val: Math.round(accelG * 1000) / 1000, isAvailable: true };
    }

    return { val: null, isAvailable: false };
  }
}
