import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { importSessionZip, resolveVehicleConfig } from '../src/core/zip/zipImporter';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((p: string) => `http://asset.localhost/${p}`),
}));

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

  it('en Tauri lee vídeo STORED por rangos directamente del ZIP sin extraer a temp', async () => {
    (globalThis as any).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'inspect_zip_session') {
        return {
          valid_session: true,
          telemetria_csv: 'time_offset_video_sec,latitude,longitude\n0.0,40.1,-3.7\n1.0,40.2,-3.8',
          session_json: JSON.stringify({ schema_version: '1.1.0' }),
          video_entry: {
            entry_name: 'video.mp4',
            is_stored: true,
            data_offset: 1048576,
            size: 50000000,
          },
        };
      }
      return null;
    });

    const bundle = await importSessionZip({ nativeZipPath: 'C:\\Sessions\\stored_session.zip' });
    expect(bundle.hasVideo).toBe(true);
    expect(bundle.videoStoredInZip).toBe(true);
    expect(bundle.videoCompressedInZip).toBe(false);
    expect(bundle.videoPath).toBe('C:\\Sessions\\stored_session.zip');
    expect(invoke).not.toHaveBeenCalledWith('extract_zip_video_to_temp', expect.anything());

    delete (globalThis as any).__TAURI_INTERNALS__;
  });

  it('en Tauri detecta vídeo externo suelto en la carpeta del ZIP y avisa si falta', async () => {
    (globalThis as any).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockImplementation(async (cmd: string, _args: any) => {
      if (cmd === 'inspect_zip_session') {
        return {
          valid_session: true,
          telemetria_csv: 'time_offset_video_sec,latitude,longitude\n0.0,40.1,-3.7\n1.0,40.2,-3.8',
          session_json: JSON.stringify({
            schema_version: '1.1.0',
            video_synchronization: {
              has_video: true,
              external_video_filename: 'gopro_hero_clip.mp4',
            },
          }),
          video_entry: null,
        };
      }
      if (cmd === 'get_file_info') {
        // Simular que el archivo no existe en disco
        return { exists: false, size: 0, is_file: false };
      }
      return null;
    });

    const bundle = await importSessionZip({ nativeZipPath: 'C:\\Sessions\\gopro_session.zip' });
    expect(bundle.hasVideo).toBe(true);
    expect(bundle.videoLoadWarning).toBeDefined();
    expect(bundle.videoLoadWarning).toContain('gopro_hero_clip.mp4');

    delete (globalThis as any).__TAURI_INTERNALS__;
  });
});
