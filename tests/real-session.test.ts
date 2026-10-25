import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { importSessionZip } from '../src/core/zip/zipImporter';
import { TimeEngine } from '../src/core/telemetry/timeEngine';

describe('Importación y Validación con Exportación REAL de Android', () => {
  const realZipPath = path.resolve(__dirname, '../samples/real/sesion_real_android.zip');

  it('verifica que el paquete de sesión real existe en el entorno local', () => {
    // Si no existiera en CI, saltar suavemente
    if (!fs.existsSync(realZipPath)) {
      console.warn('Paquete real no presente en el entorno, omitiendo test real.');
      return;
    }
    expect(fs.existsSync(realZipPath)).toBe(true);
  });

  it('importa y procesa con éxito la exportación real de Tachyon Android', async () => {
    if (!fs.existsSync(realZipPath)) return;

    const fileBuffer = fs.readFileSync(realZipPath);
    const bundle = await importSessionZip(fileBuffer);

    // 1. Identificación de la sesión
    expect(bundle).toBeDefined();
    expect(bundle.id).toContain('61207f0c');
    expect(bundle.hasVideo).toBe(true);
    expect(bundle.videoBlob).toBeDefined();

    // 2. Esquema detectado
    expect(bundle.csvFormat).toBe('official_wide');

    // 3. Configuración de vehículo extraída de session.json
    expect(bundle.vehicleConfigWithOrigin.source).toBe('app');
    expect(bundle.vehicleConfigWithOrigin.config.max_rpm).toBe(7500);
    expect(bundle.vehicleConfigWithOrigin.config.redline_rpm).toBe(6500);
    expect(bundle.vehicleConfigWithOrigin.config.shift_light_rpm).toBe(6000);

    // 4. Puntos y sincronización
    expect(bundle.totalPoints).toBe(28);
    expect(bundle.points[0].time_offset_video_sec).toBeCloseTo(-0.099);

    // Comprobar que celdas ausentes son null y no 0
    expect(bundle.points[0].latitude).toBeNull();
    expect(bundle.points[0].gps_speed_kmh).toBeNull();
    expect(bundle.points[0].engine_rpm).toBeNull();
    expect(bundle.points[0].lateral_g).toBeCloseTo(-0.081);
    expect(bundle.points[0].longitudinal_g).toBeCloseTo(0.07);

    // 5. Motor de tiempo funcionando con la sesión real
    const engine = TimeEngine.fromBundle(bundle);
    const snap = engine.query(0.0);
    expect(snap).toBeDefined();
    expect(snap.lateralGAvailable).toBe(true);
    expect(typeof snap.lateralG).toBe('number');
  });
});
