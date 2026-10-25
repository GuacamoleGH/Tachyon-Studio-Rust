import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { importSessionZip, resolveVehicleConfig } from '../src/core/zip/zipImporter';

describe('ZIP Importer con sesión sintética real', () => {
  const sampleZipPath = path.resolve(__dirname, '../samples/sesion_sintetica_prueba.zip');

  it('existe el archivo de muestra sesion_sintetica_prueba.zip', () => {
    expect(fs.existsSync(sampleZipPath)).toBe(true);
  });

  it('importa y procesa con éxito la sesión sintética con casos difíciles', async () => {
    const fileBuffer = fs.readFileSync(sampleZipPath);
    const bundle = await importSessionZip(fileBuffer);

    expect(bundle).toBeDefined();
    expect(bundle.totalPoints).toBeGreaterThan(100);

    // 1. Verificación del perfil de vehículo
    expect(bundle.vehicleConfigWithOrigin.source).toBe('app');
    expect(bundle.vehicleConfigWithOrigin.config.max_rpm).toBe(7500);
    expect(bundle.vehicleConfigWithOrigin.config.redline_rpm).toBe(6500);
    expect(bundle.vehicleConfigWithOrigin.config.shift_light_rpm).toBe(6200);

    // 2. Verificación de marcas temporales y offset negativo
    expect(bundle.timeRange.minSec).toBeLessThan(0); // Hay muestras anteriores al vídeo
    expect(bundle.timeRange.maxSec).toBeGreaterThan(80);

    // 3. Verificación de eventos importados de session.json
    expect(bundle.events.length).toBeGreaterThanOrEqual(2);
    const gpsLost = bundle.events.find((e) => e.type === 'gps_lost');
    expect(gpsLost).toBeDefined();
    expect(gpsLost?.startSec).toBe(58.0);
    expect(gpsLost?.endSec).toBe(63.0);

    const obdDisc = bundle.events.find((e) => e.type === 'obd_disconnected');
    expect(obdDisc).toBeDefined();
    expect(obdDisc?.startSec).toBe(30.0);
    expect(obdDisc?.endSec).toBe(32.5);

    // 4. Verificación de estadísticas de señales
    const rpmStats = bundle.signalsStats.engine_rpm;
    expect(rpmStats.foundInCsv).toBe(true);
    expect(rpmStats.sampleCount).toBeGreaterThan(0);
    expect(rpmStats.effectiveHz).toBeGreaterThan(0);

    const latStats = bundle.signalsStats.latitude;
    expect(latStats.foundInCsv).toBe(true);
    expect(latStats.sampleCount).toBeGreaterThan(0);

    // 5. Verificación de formato disperso detectado
    expect(bundle.csvFormat).toBe('sparse_multisource');
  });

  it('resuelve correctamente la prioridad del perfil de vehículo si session.json está vacío', () => {
    const resolved = resolveVehicleConfig(undefined);
    expect(resolved.source).toBe('default');
    expect(resolved.config.max_rpm).toBe(7500);
    expect(resolved.config.redline_rpm).toBe(6500);
    expect(resolved.config.shift_light_rpm).toBe(6000);
  });
});
