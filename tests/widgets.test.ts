import { describe, it, expect } from 'vitest';
import { TachometerCircularWidget } from '../src/engine/widgets/TachometerWidget';
import { ShiftLightsWidget } from '../src/engine/widgets/ShiftLightsWidget';
import { SpeedometerWidget } from '../src/engine/widgets/SpeedometerWidget';
import { GMeterWidget } from '../src/engine/widgets/GMeterWidget';
import { GearIndicatorWidget } from '../src/engine/widgets/GearIndicatorWidget';
import { CoolantTempWidget } from '../src/engine/widgets/CoolantTempWidget';
import { BrakeThrottleWidget } from '../src/engine/widgets/BrakeThrottleWidget';
import { TachometerBarWidget } from '../src/engine/widgets/TachometerBarWidget';
import { MapWidget } from '../src/engine/widgets/MapWidget';
import { SessionTimerWidget } from '../src/engine/widgets/SessionTimerWidget';
import { GForceBarsWidget } from '../src/engine/widgets/GForceBarsWidget';
import { AltitudeWidget } from '../src/engine/widgets/AltitudeWidget';
import { CompassWidget } from '../src/engine/widgets/CompassWidget';
import { PRESET_GASOLINA_ESTANDAR } from '../src/core/profile/vehicleProfile';
import { TelemetrySnapshot } from '../src/core/telemetry/timeEngine';
import { STANDARD_SIGNALS, StandardSignalKey } from '../src/core/model/telemetry';

// Mock simple de CanvasRenderingContext2D para entorno Node / Vitest
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
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fillText: () => {},
    clip: () => {},
    translate: () => {},
    rotate: () => {},
    closePath: () => {},
    setLineDash: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    set fillStyle(_: any) {},
    set strokeStyle(_: any) {},
    set lineWidth(_: any) {},
    set lineCap(_: any) {},
    set lineJoin(_: any) {},
    set font(_: any) {},
    set textAlign(_: any) {},
    set textBaseline(_: any) {},
  };
}

function createSnapshot(rpm: number | null, speed: number | null, latG: number | null): TelemetrySnapshot {
  const signals = {} as any;
  for (const k of Object.keys(STANDARD_SIGNALS) as StandardSignalKey[]) {
    signals[k] = {
      key: k,
      value: k === 'engine_rpm' ? rpm : k === 'gps_speed_kmh' ? speed : 0,
      isAvailable: true,
      status: 'VALID',
    };
  }

  return {
    timeSec: 10.0,
    signals,
    activeEvents: [],
    speedKmh: speed,
    speedAvailable: speed !== null,
    rpm,
    rpmAvailable: rpm !== null,
    throttlePct: 50,
    throttleAvailable: true,
    lateralG: latG,
    lateralGAvailable: latG !== null,
    longitudinalG: 0.2,
    longitudinalGAvailable: true,
    derivedGpsLongG: null,
    derivedGpsLongGAvailable: false,
    latitude: 36.7,
    longitude: -4.4,
    gpsAvailable: true,
    bearingDeg: 90,
    bearingAvailable: true,
  };
}

describe('Base Widgets Render Tests', () => {
  const ctx = createMockCtx();
  const profile = PRESET_GASOLINA_ESTANDAR;

  it('renderiza el tacómetro circular en estado normal y con RPM superior a scale_max', () => {
    const tach = new TachometerCircularWidget();
    expect(tach).toBeDefined();

    // Estado normal
    tach.render({
      ctx,
      snapshot: createSnapshot(3500, 80, 0.1),
      profile,
      timeSec: 1.0,
    });

    // RPM por encima de scale_max (8500 > 7500): no debe lanzar error ni desbordar
    tach.render({
      ctx,
      snapshot: createSnapshot(8500, 80, 0.1),
      profile,
      timeSec: 1.0,
    });

    // Estado N/D (rpm null)
    tach.render({
      ctx,
      snapshot: createSnapshot(null, 80, 0.1),
      profile,
      timeSec: 1.0,
    });
  });

  it('renderiza la barra de shift lights con parpadeo estroboscópico en flash_rpm', () => {
    const shift = new ShiftLightsWidget();
    expect(shift).toBeDefined();

    // Régimen normal
    shift.render({
      ctx,
      snapshot: createSnapshot(3000, 80, 0.1),
      profile,
      timeSec: 1.0,
    });

    // Régimen de cambio flash_rpm (6000 RPM)
    shift.render({
      ctx,
      snapshot: createSnapshot(6100, 80, 0.1),
      profile,
      timeSec: 1.0, // flashState determinista
    });

    // Estado N/D
    shift.render({
      ctx,
      snapshot: createSnapshot(null, 80, 0.1),
      profile,
      timeSec: 1.0,
    });
  });

  it('renderiza el velocímetro en km/h e imperial (mph)', () => {
    const speed = new SpeedometerWidget();

    speed.render({
      ctx,
      snapshot: createSnapshot(3000, 100, 0.1),
      profile,
      timeSec: 1.0,
      unitSystem: 'metric',
    });

    speed.render({
      ctx,
      snapshot: createSnapshot(3000, 100, 0.1),
      profile,
      timeSec: 1.0,
      unitSystem: 'imperial',
    });
  });

  it('renderiza el G-Meter en estado normal y N/D', () => {
    const gmeter = new GMeterWidget();

    gmeter.render({
      ctx,
      snapshot: createSnapshot(3000, 100, 0.85),
      profile,
      timeSec: 1.0,
    });

    gmeter.render({
      ctx,
      snapshot: createSnapshot(3000, 100, null),
      profile,
      timeSec: 1.0,
    });
  });

  it('renderiza el GearIndicator calculando marchas y neutral', () => {
    const gear = new GearIndicatorWidget();

    // Neutro o parado
    gear.render({
      ctx,
      snapshot: createSnapshot(850, 0, 0),
      profile,
      timeSec: 1.0,
    });

    // En movimiento a fondo (marcha 3)
    gear.render({
      ctx,
      snapshot: createSnapshot(5500, 120, 0.2),
      profile,
      timeSec: 1.0,
    });

    // Zona roja
    gear.render({
      ctx,
      snapshot: createSnapshot(7200, 160, 0.2),
      profile,
      timeSec: 1.0,
    });
  });

  it('renderiza CoolantTempWidget en métrico e imperial', () => {
    const tempWidget = new CoolantTempWidget();
    const snap = createSnapshot(3000, 100, 0);
    snap.signals.coolant_temp_c = {
      key: 'coolant_temp_c',
      value: 95,
      isAvailable: true,
      status: 'VALID',
      unit: '°C',
      category: 'OBD',
      label: 'Temp. Refrigerante',
    };

    tempWidget.render({
      ctx,
      snapshot: snap,
      profile,
      timeSec: 1.0,
      unitSystem: 'metric',
    });

    tempWidget.render({
      ctx,
      snapshot: snap,
      profile,
      timeSec: 1.0,
      unitSystem: 'imperial',
    });
  });

  it('renderiza BrakeThrottleWidget y TachometerBarWidget', () => {
    const dualPedals = new BrakeThrottleWidget();
    const tachBar = new TachometerBarWidget();
    const snap = createSnapshot(6200, 140, 0);
    snap.longitudinalG = -0.8; // Freno fuerte

    dualPedals.render({
      ctx,
      snapshot: snap,
      profile,
      timeSec: 1.0,
    });

    tachBar.render({
      ctx,
      snapshot: snap,
      profile,
      timeSec: 1.0,
    });
  });

  it('renderiza MapWidget en modo minimapa dinámico de videojuego (chase_heading) y circuito completo', () => {
    const map = new MapWidget();
    map.mode = 'chase_heading';
    map.zoomMeters = 400;

    const snap = createSnapshot(5000, 110, 0.4);
    snap.latitude = 40.4168;
    snap.longitude = -3.7038;
    snap.gpsAvailable = true;
    snap.bearingDeg = 45;
    snap.bearingAvailable = true;

    const points = [
      { time_offset_video_sec: 0, latitude: 40.416, longitude: -3.704 } as any,
      { time_offset_video_sec: 1, latitude: 40.4168, longitude: -3.7038 } as any,
      { time_offset_video_sec: 2, latitude: 40.4175, longitude: -3.703 } as any,
    ];

    // Modo minimapa de videojuego rotando con el rumbo
    map.render({
      ctx,
      snapshot: snap,
      profile,
      timeSec: 1.0,
      allPoints: points,
    });

    // Modo minimapa norte arriba
    map.mode = 'chase_north';
    map.render({
      ctx,
      snapshot: snap,
      profile,
      timeSec: 1.0,
      allPoints: points,
    });

    // Modo circuito completo estático
    map.mode = 'full_circuit';
    map.render({
      ctx,
      snapshot: snap,
      profile,
      timeSec: 1.0,
      allPoints: points,
    });

    expect(map.mode).toBe('full_circuit');
  });

  it('renderiza con éxito los nuevos widgets: SessionTimer, GForceBars, Altitude y Compass', () => {
    const ctx = createMockCtx();
    const snap = createSnapshot(3500, 80, 0.5);
    snap.signals.altitude_m = {
      key: 'altitude_m',
      value: 650,
      isAvailable: true,
      status: 'VALID',
      unit: 'm',
      category: 'GPS',
      label: 'Altitud',
    };
    snap.bearingDeg = 180;
    snap.bearingAvailable = true;
    snap.lateralG = 1.25;
    snap.lateralGAvailable = true;
    snap.longitudinalG = -0.85;
    snap.longitudinalGAvailable = true;

    const timer = new SessionTimerWidget({ x: 20, y: 20, width: 140, height: 44 });
    const gBars = new GForceBarsWidget({ x: 20, y: 70, width: 180, height: 90 });
    const altitude = new AltitudeWidget({ x: 20, y: 170, width: 140, height: 75 });
    const compass = new CompassWidget({ x: 20, y: 250, width: 120, height: 120 });

    const context = {
      ctx,
      snapshot: snap,
      profile,
      timeSec: 125.4,
    };

    expect(() => timer.render(context)).not.toThrow();
    expect(() => gBars.render(context)).not.toThrow();
    expect(() => altitude.render(context)).not.toThrow();
    expect(() => compass.render(context)).not.toThrow();
  });
});
