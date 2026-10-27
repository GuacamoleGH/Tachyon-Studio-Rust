import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as fflate from 'fflate';
import { importSessionZip } from '../src/core/zip/zipImporter';
import { TimeEngine } from '../src/core/telemetry/timeEngine';

describe('Validación de Esquema Oficial de Android (Sesión Sintética)', () => {
  // Construir una sesión sintética idéntica al formato oficial generado por la app Tachyon en Android
  function createOfficialAndroidSyntheticZip(): Uint8Array {
    const header = [
      'time_offset_video_sec', 'time_offset_session_sec', 'timestamp_utc_ms', 'iso_time', 'monotonic_nanos',
      'latitude', 'longitude', 'altitude_m', 'gps_speed_kmh', 'bearing_deg', 'accuracy_m',
      'lateral_g', 'longitudinal_g', 'engine_rpm', 'obd_speed_kmh', 'throttle_pct', 'coolant_temp_c',
      'accel_x', 'accel_y', 'accel_z'
    ];

    const row0 = ['-0.099', '0.000', '1729864200000', '2026-10-25T12:30:00.000Z', '1000000000', '', '', '', '', '', '', '-0.081', '0.070', '', '', '', '', '0.12', '8.25', '-1.14'];
    const row1 = ['0.000', '0.099', '1729864200099', '2026-10-25T12:30:00.099Z', '1000099000', '40.4168', '-3.7038', '655.0', '85.5', '182.4', '1.8', '0.120', '0.340', '3200', '84.0', '45.0', '88.0', '0.15', '8.30', '-1.10'];
    const row2 = ['0.100', '0.199', '1729864200199', '2026-10-25T12:30:00.199Z', '1000199000', '40.4169', '-3.7039', '655.2', '87.2', '183.0', '1.8', '0.250', '0.410', '3450', '86.0', '52.0', '89.0', '0.18', '8.45', '-1.05'];

    const csvContent = [header.join(','), row0.join(','), row1.join(','), row2.join(',')].join('\n');

    const sessionJsonContent = JSON.stringify({
      schema_version: '1.0.0',
      generator: {
        app_name: 'Tachyon Mobile',
        app_version: '1.4.0',
        platform: 'Android',
      },
      session: {
        id: 'session-synthetic-official-61207f0c',
        title: 'Tanda Sintética Oficial Android',
        start_time_iso: '2026-10-25T12:30:00.000Z',
        duration_seconds: 30.5,
        total_distance_meters: 750.0,
        max_speed_kmh: 87.2,
      },
      vehicle_config: {
        max_rpm: 7500,
        redline_rpm: 6500,
        shift_light_rpm: 6000,
      },
      video_synchronization: {
        has_video: true,
        video_filename: 'video.mp4',
        sync_offset_sec: 0.0,
      },
      signals: {
        has_gps: true,
        has_obd: true,
        has_imu: true,
      },
    }, null, 2);

    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1"><trk><trkseg><trkpt lat="40.4168" lon="-3.7038"></trkpt></trkseg></trk></gpx>`;
    const dummyVideo = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]); // Dummy ftyp mp4

    return fflate.zipSync({
      'telemetria.csv': fflate.strToU8(csvContent),
      'session.json': fflate.strToU8(sessionJsonContent),
      'ruta.gpx': fflate.strToU8(gpxContent),
      'video.mp4': dummyVideo,
      'LEEME_SINCRONIZACION.txt': fflate.strToU8('Documentación de sincronización oficial'),
    });
  }

  it('importa y procesa con éxito la sesión sintética con el esquema completo de 20 columnas de Android', async () => {
    const zipBytes = createOfficialAndroidSyntheticZip();
    const bundle = await importSessionZip(zipBytes);

    // 1. Identificación de la sesión
    expect(bundle).toBeDefined();
    expect(bundle.id).toContain('61207f0c');
    expect(bundle.hasVideo).toBe(true);

    // 2. Esquema detectado
    expect(bundle.csvFormat).toBe('official_wide');

    // 3. Configuración de vehículo extraída de session.json
    expect(bundle.vehicleConfigWithOrigin.source).toBe('app');
    expect(bundle.vehicleConfigWithOrigin.config.max_rpm).toBe(7500);
    expect(bundle.vehicleConfigWithOrigin.config.redline_rpm).toBe(6500);
    expect(bundle.vehicleConfigWithOrigin.config.shift_light_rpm).toBe(6000);

    // 4. Puntos y sincronización
    expect(bundle.totalPoints).toBe(3);
    expect(bundle.points[0].time_offset_video_sec).toBeCloseTo(-0.099);

    // Comprobar que celdas ausentes en la muestra 0 son null y no 0
    expect(bundle.points[0].latitude).toBeNull();
    expect(bundle.points[0].gps_speed_kmh).toBeNull();
    expect(bundle.points[0].engine_rpm).toBeNull();
    expect(bundle.points[0].lateral_g).toBeCloseTo(-0.081);
    expect(bundle.points[0].longitudinal_g).toBeCloseTo(0.07);

    // Comprobar muestra con todos los canales
    expect(bundle.points[1].latitude).toBeCloseTo(40.4168);
    expect(bundle.points[1].gps_speed_kmh).toBeCloseTo(85.5);
    expect(bundle.points[1].engine_rpm).toBe(3200);

    // 5. Motor de tiempo funcionando con la sesión sintética
    const engine = TimeEngine.fromBundle(bundle);
    const snap = engine.query(0.0);
    expect(snap).toBeDefined();
    expect(snap.lateralGAvailable).toBe(true);
    expect(typeof snap.lateralG).toBe('number');
  });
});

// Suite para sesión real local opcional (ignorada en Git)
const realZipPath = path.resolve(__dirname, '../samples/real/sesion_real_android.zip');
const hasRealZip = fs.existsSync(realZipPath);

describe.skipIf(!hasRealZip)('Validación con Sesión REAL de Android (Local en samples/real/)', () => {
  it('importa y procesa con éxito la exportación real de Tachyon Android si está presente localmente', async () => {
    const fileBuffer = fs.readFileSync(realZipPath);
    const bundle = await importSessionZip(fileBuffer);

    expect(bundle).toBeDefined();
    expect(bundle.id).toBeDefined();
    expect(bundle.csvFormat).toBe('official_wide');
    expect(bundle.vehicleConfigWithOrigin.source).toBe('app');

    const engine = TimeEngine.fromBundle(bundle);
    const snap = engine.query(0.0);
    expect(snap).toBeDefined();
  });
});
