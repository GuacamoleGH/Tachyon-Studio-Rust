import { describe, it, expect } from 'vitest';
import { OverlayRenderer } from '../src/engine/canvas/overlayRenderer';
import { PRESET_GASOLINA_ESTANDAR } from '../src/core/profile/vehicleProfile';
import { TelemetrySnapshot } from '../src/core/telemetry/timeEngine';
import { STANDARD_SIGNALS, StandardSignalKey } from '../src/core/model/telemetry';

function createMockCtx(): any {
  return {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    roundRect: () => {},
    fillText: () => {},
    clearRect: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    set fillStyle(_: any) {},
    set strokeStyle(_: any) {},
    set lineWidth(_: any) {},
    set lineCap(_: any) {},
    set lineJoin(_: any) {},
    set font(_: any) {},
    set textAlign(_: any) {},
    set textBaseline(_: any) {},
    set globalAlpha(_: any) {},
  };
}

function createDummySnapshot(rpm: number | null, speed: number | null): TelemetrySnapshot {
  const signals = {} as any;
  for (const k of Object.keys(STANDARD_SIGNALS) as StandardSignalKey[]) {
    signals[k] = {
      key: k,
      value: k === 'engine_rpm' ? rpm : k === 'gps_speed_kmh' ? speed : 0,
      isAvailable: rpm !== null,
      status: rpm !== null ? 'VALID' : 'GAP_TIMEOUT',
    };
  }

  return {
    timeSec: 15.5,
    signals,
    activeEvents: [],
    speedKmh: speed,
    speedAvailable: speed !== null,
    rpm,
    rpmAvailable: rpm !== null,
    throttlePct: 75,
    throttleAvailable: true,
    lateralG: 0.8,
    lateralGAvailable: true,
    longitudinalG: -0.3,
    longitudinalGAvailable: true,
    derivedGpsLongG: null,
    derivedGpsLongGAvailable: false,
    latitude: 36.72,
    longitude: -4.41,
    gpsAvailable: true,
    bearingDeg: 120,
    bearingAvailable: true,
  };
}

describe('OverlayRenderer Pipeline', () => {
  it('inicializa la plantilla MyChron 5 por defecto con todos los widgets base', () => {
    const renderer = new OverlayRenderer(1280, 720);
    expect(renderer.widgets.length).toBeGreaterThanOrEqual(6);

    const types = renderer.widgets.map((w) => w.type);
    expect(types).toContain('shift_lights');
    expect(types).toContain('tachometer_circular');
    expect(types).toContain('speedometer');
    expect(types).toContain('throttle');
    expect(types).toContain('g_meter');
    expect(types).toContain('map');
  });

  it('redimensiona la plantilla dinámicamente si cambia la resolución del vídeo', () => {
    const renderer = new OverlayRenderer(1280, 720);
    renderer.resize(1920, 1080);
    expect(renderer.width).toBe(1920);
    expect(renderer.height).toBe(1080);
  });

  it('renderiza un fotograma completo sin errores con telemetría activa', () => {
    const renderer = new OverlayRenderer(1280, 720);
    const ctx = createMockCtx();
    const snap = createDummySnapshot(5800, 115);
    const profile = PRESET_GASOLINA_ESTANDAR;

    expect(() => {
      renderer.render(ctx, snap, profile, 15.5);
    }).not.toThrow();
  });

  it('renderiza correctamente en condiciones de N/D (cortes de señal)', () => {
    const renderer = new OverlayRenderer(1280, 720);
    const ctx = createMockCtx();
    const snap = createDummySnapshot(null, null);
    const profile = PRESET_GASOLINA_ESTANDAR;

    expect(() => {
      renderer.render(ctx, snap, profile, 31.0);
    }).not.toThrow();
  });
});
