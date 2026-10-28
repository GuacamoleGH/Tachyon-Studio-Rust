import { StandardSignalKey, STANDARD_SIGNALS } from '../model/telemetry';

export type InterpolationType = 'linear' | 'angle' | 'step';

export interface SignalSample {
  t: number;
  val: number;
}

export interface SignalTimelineConfig {
  signalKey: StandardSignalKey;
  maxGapSec: number;
  interpolation: InterpolationType;
  category: 'GPS' | 'IMU' | 'OBD' | 'SYSTEM';
}

export interface SignalQueryResult {
  value: number | null;
  isAvailable: boolean;
  status: 'VALID' | 'GAP_TIMEOUT' | 'EVENT_BLOCKED' | 'OUT_OF_BOUNDS';
  timeBefore?: number;
  timeAfter?: number;
}

/**
 * Línea temporal indexada para una señal individual con búsqueda binaria O(log N).
 */
export class SignalTimeline {
  public readonly signalKey: StandardSignalKey;
  public readonly maxGapSec: number;
  public readonly interpolation: InterpolationType;
  public readonly category: 'GPS' | 'IMU' | 'OBD' | 'SYSTEM';

  private readonly timestamps: number[];
  private readonly values: number[];

  constructor(
    signalKey: StandardSignalKey,
    samples: SignalSample[],
    maxGapSec?: number,
    interpolation?: InterpolationType
  ) {
    this.signalKey = signalKey;
    const def = STANDARD_SIGNALS[signalKey];
    this.maxGapSec = maxGapSec ?? def?.defaultMaxGapSec ?? 1.5;
    this.category = def?.category ?? 'SYSTEM';

    if (interpolation) {
      this.interpolation = interpolation;
    } else if (signalKey === 'bearing_deg') {
      this.interpolation = 'angle';
    } else if (signalKey === 'gear') {
      this.interpolation = 'step';
    } else {
      this.interpolation = 'linear';
    }

    // Filtrar y ordenar cronológicamente
    samples.sort((a, b) => a.t - b.t);

    this.timestamps = new Array(samples.length);
    this.values = new Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      this.timestamps[i] = samples[i].t;
      this.values[i] = samples[i].val;
    }
  }

  public get sampleCount(): number {
    return this.timestamps.length;
  }

  public get minTime(): number | null {
    return this.timestamps.length > 0 ? this.timestamps[0] : null;
  }

  public get maxTime(): number | null {
    return this.timestamps.length > 0 ? this.timestamps[this.timestamps.length - 1] : null;
  }

  /**
   * Consulta el valor interpolado de la señal en el instante t.
   */
  public query(t: number): SignalQueryResult {
    const len = this.timestamps.length;
    if (len === 0) {
      return { value: null, isAvailable: false, status: 'OUT_OF_BOUNDS' };
    }

    const tFirst = this.timestamps[0];
    const tLast = this.timestamps[len - 1];

    // Caso 1: Antes de la primera muestra
    if (t < tFirst) {
      const dt = tFirst - t;
      if (dt <= this.maxGapSec * 0.5) {
        // Ligera tolerancia de extrapolación hacia el inicio
        return {
          value: this.values[0],
          isAvailable: true,
          status: 'VALID',
          timeBefore: tFirst,
          timeAfter: tFirst,
        };
      }
      return { value: null, isAvailable: false, status: 'OUT_OF_BOUNDS' };
    }

    // Caso 2: Tras la última muestra
    if (t > tLast) {
      const dt = t - tLast;
      if (dt <= this.maxGapSec * 0.5) {
        return {
          value: this.values[len - 1],
          isAvailable: true,
          status: 'VALID',
          timeBefore: tLast,
          timeAfter: tLast,
        };
      }
      return { value: null, isAvailable: false, status: 'OUT_OF_BOUNDS' };
    }

    // Caso 3: Búsqueda binaria del intervalo [idx, idx+1] tal que timestamps[idx] <= t <= timestamps[idx+1]
    let low = 0;
    let high = len - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.timestamps[mid] < t) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx1 = Math.max(0, low - 1);
    const idx2 = Math.min(len - 1, low);

    const t1 = this.timestamps[idx1];
    const t2 = this.timestamps[idx2];
    const v1 = this.values[idx1];
    const v2 = this.values[idx2];

    const dt = t2 - t1;

    // Si coincide con una muestra exacta o dt es prácticamente 0
    if (dt <= 0.0001) {
      return {
        value: v1,
        isAvailable: true,
        status: 'VALID',
        timeBefore: t1,
        timeAfter: t1,
      };
    }

    // Comprobar si hay un hueco mayor a la tolerancia máxima
    if (dt > this.maxGapSec) {
      return {
        value: null,
        isAvailable: false,
        status: 'GAP_TIMEOUT',
        timeBefore: t1,
        timeAfter: t2,
      };
    }

    // Interpolación
    const factor = (t - t1) / dt;

    if (this.interpolation === 'step') {
      return {
        value: factor < 0.5 ? v1 : v2,
        isAvailable: true,
        status: 'VALID',
        timeBefore: t1,
        timeAfter: t2,
      };
    }

    if (this.interpolation === 'angle') {
      // Interpolación angular por el camino más corto en el círculo 0-360°
      const interpolatedAngle = interpolateAngle(v1, v2, factor);
      return {
        value: interpolatedAngle,
        isAvailable: true,
        status: 'VALID',
        timeBefore: t1,
        timeAfter: t2,
      };
    }

    // Interpolación lineal estándar
    const interpolatedVal = v1 + factor * (v2 - v1);
    return {
      value: interpolatedVal,
      isAvailable: true,
      status: 'VALID',
      timeBefore: t1,
      timeAfter: t2,
    };
  }
}

/**
 * Interpola entre dos ángulos en grados (0..360) tomando la distancia mínima.
 */
export function interpolateAngle(deg1: number, deg2: number, factor: number): number {
  let diff = (deg2 - deg1) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  const result = (deg1 + factor * diff) % 360;
  return result < 0 ? result + 360 : result;
}
