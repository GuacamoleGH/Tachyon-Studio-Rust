import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TimeEngine } from '../src/core/telemetry/timeEngine';
import { interpolateAngle, SignalTimeline } from '../src/core/telemetry/signalTimeline';
import { importSessionZip } from '../src/core/zip/zipImporter';

describe('Time Engine & Interpolation', () => {
  it('interpola linealmente de forma exacta entre dos muestras', () => {
    const timeline = new SignalTimeline('gps_speed_kmh', [
      { t: 10.0, val: 100.0 },
      { t: 11.0, val: 200.0 },
    ]);

    const res = timeline.query(10.5);
    expect(res.isAvailable).toBe(true);
    expect(res.value).toBeCloseTo(150.0);
    expect(res.status).toBe('VALID');
  });

  it('interpola ángulos correctamente cruzando el meridiano 0°/360°', () => {
    // Giro de 350° a 10° (diferencia de 20° en sentido horario)
    expect(interpolateAngle(350, 10, 0.5)).toBeCloseTo(0);

    // Giro de 10° a 350° (diferencia de 20° en sentido antihorario)
    expect(interpolateAngle(10, 350, 0.5)).toBeCloseTo(0);

    // Giro de 90° a 180°
    expect(interpolateAngle(90, 180, 0.5)).toBeCloseTo(135);

    const timeline = new SignalTimeline('bearing_deg', [
      { t: 1.0, val: 350.0 },
      { t: 2.0, val: 10.0 },
    ]);

    const res = timeline.query(1.5);
    expect(res.isAvailable).toBe(true);
    expect(res.value).toBeCloseTo(0.0);
  });

  it('marca N/D (GAP_TIMEOUT) cuando el intervalo supera maxGapSec', () => {
    // Hueco de 4 segundos con tolerancia máxima de 1.5s
    const timeline = new SignalTimeline(
      'engine_rpm',
      [
        { t: 10.0, val: 3000 },
        { t: 14.0, val: 4000 },
      ],
      1.5
    );

    // Instante dentro del hueco
    const resInsideGap = timeline.query(12.0);
    expect(resInsideGap.isAvailable).toBe(false);
    expect(resInsideGap.value).toBeNull();
    expect(resInsideGap.status).toBe('GAP_TIMEOUT');

    // Instante cerca de la muestra dentro de la tolerancia
    const resAtStart = timeline.query(10.0);
    expect(resAtStart.isAvailable).toBe(true);
    expect(resAtStart.value).toBe(3000);
  });

  it('bloquea señales durante eventos activos de session.json (corte GPS y desconexión OBD)', async () => {
    const sampleZipPath = path.resolve(__dirname, '../samples/sesion_sintetica_prueba.zip');
    const fileBuffer = fs.readFileSync(sampleZipPath);
    const bundle = await importSessionZip(fileBuffer);
    const engine = TimeEngine.fromBundle(bundle);

    // 1. Instante normal t = 20.0s (todos los sensores activos)
    const snapNormal = engine.query(20.0);
    expect(snapNormal.rpmAvailable).toBe(true);
    expect(snapNormal.rpm).toBeGreaterThan(0);
    expect(snapNormal.speedAvailable).toBe(true);
    expect(snapNormal.gpsAvailable).toBe(true);
    expect(snapNormal.activeEvents.length).toBe(0);

    // 2. Instante t = 31.0s (durante corte OBD: 30.0s - 32.5s)
    const snapObdCut = engine.query(31.0);
    expect(snapObdCut.rpmAvailable).toBe(false);
    expect(snapObdCut.rpm).toBeNull();
    expect(snapObdCut.throttleAvailable).toBe(false);
    expect(snapObdCut.signals.engine_rpm.status).toBe('EVENT_BLOCKED');
    // Pero GPS e IMU deben seguir funcionando
    expect(snapObdCut.speedAvailable).toBe(true);
    expect(snapObdCut.lateralGAvailable).toBe(true);
    expect(snapObdCut.activeEvents.some((e) => e.type === 'obd_disconnected')).toBe(true);

    // 3. Instante t = 60.0s (durante corte GPS: 58.0s - 63.0s)
    const snapGpsCut = engine.query(60.0);
    expect(snapGpsCut.gpsAvailable).toBe(false);
    expect(snapGpsCut.latitude).toBeNull();
    expect(snapGpsCut.signals.latitude.status).toBe('EVENT_BLOCKED');
    // Pero OBD e IMU deben seguir funcionando
    expect(snapGpsCut.rpmAvailable).toBe(true);
    expect(snapGpsCut.lateralGAvailable).toBe(true);
    expect(snapGpsCut.activeEvents.some((e) => e.type === 'gps_lost')).toBe(true);

    // 4. Muestras con offset negativo t = -0.5s
    const snapNegative = engine.query(-0.5);
    expect(snapNegative.lateralGAvailable).toBe(true);
  });

  it('calcula aceleración derivada de GPS separada de la inercial IMU', async () => {
    const sampleZipPath = path.resolve(__dirname, '../samples/sesion_sintetica_prueba.zip');
    const fileBuffer = fs.readFileSync(sampleZipPath);
    const bundle = await importSessionZip(fileBuffer);
    const engine = TimeEngine.fromBundle(bundle);

    const snap = engine.query(15.0);
    expect(snap.longitudinalGAvailable).toBe(true); // IMU
    expect(snap.derivedGpsLongGAvailable).toBe(true); // Derivada de GPS
    expect(typeof snap.longitudinalG).toBe('number');
    expect(typeof snap.derivedGpsLongG).toBe('number');
  });
});
