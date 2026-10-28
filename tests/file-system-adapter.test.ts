import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isTauriEnvironment,
  createTauriFileSource,
  createZipStoredVideoSource,
  detectFfmpegCapabilities,
  runFfmpegCommand,
  executeSafeFfmpeg,
  openSessionDialog,
} from '../src/core/fs/fileSystemAdapter';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `http://asset.localhost/${path}`),
}));

describe('FileSystemAdapter & Tauri File Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detecta correctamente si el entorno es Tauri o Web', () => {
    delete (globalThis as any).__TAURI_INTERNALS__;
    delete (globalThis as any).__TAURI__;
    expect(isTauriEnvironment()).toBe(false);

    (globalThis as any).__TAURI_INTERNALS__ = {};
    expect(isTauriEnvironment()).toBe(true);

    delete (globalThis as any).__TAURI_INTERNALS__;
    expect(isTauriEnvironment()).toBe(false);
  });

  it('createTauriFileSource devuelve un Source con tamaño y lectura por rangos', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_file_range') {
        return new Array(args.length).fill(0x7a);
      }
      return [];
    });

    const source = createTauriFileSource('C:\\Videos\\session.mp4', 1024 * 1024 * 500); // 500 MB
    expect(source).toBeDefined();

    const size = await source.getSize();
    expect(size).toBe(524288000);

    // Verificamos que la función read configure y llame a invoke con los parámetros esperados
    const readFn = (source as any)._options.read;
    const chunk = await readFn(100, 108);
    expect(chunk).toBeInstanceOf(Uint8Array);
    expect(chunk.length).toBe(8);
    expect(chunk[0]).toBe(0x7a);

    expect(invoke).toHaveBeenCalledWith('read_file_range', {
      path: 'C:\\Videos\\session.mp4',
      offset: 100,
      length: 8,
    });
  });

  it('createZipStoredVideoSource calcula los offsets absolutos del ZIP STORED correctamente', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_file_range') {
        return new Array(args.length).fill(0x33);
      }
      return [];
    });

    const zipPath = 'C:\\Sesiones\\sesion.zip';
    const dataOffsetInZip = 1048576; // Offset en el byte 1 MB
    const videoSize = 50000;

    const source = createZipStoredVideoSource(zipPath, dataOffsetInZip, videoSize);
    expect(source).toBeDefined();

    const size = await source.getSize();
    expect(size).toBe(videoSize);

    // Leer rango relativo [100, 104)
    const readFn = (source as any)._options.read;
    const chunk = await readFn(100, 104);
    expect(chunk).toBeInstanceOf(Uint8Array);
    expect(chunk.length).toBe(4);
    expect(chunk[0]).toBe(0x33);

    // El offset absoluto debe ser dataOffset + start = 1048576 + 100 = 1048676, length = 4
    expect(invoke).toHaveBeenCalledWith('read_file_range', {
      path: zipPath,
      offset: 1048676,
      length: 4,
    });
  });

  it('detectFfmpegCapabilities devuelve capacidades detectadas en Tauri o fallback seguro en Web', async () => {
    // 1. En entorno web (sin __TAURI_INTERNALS__)
    delete (globalThis as any).__TAURI_INTERNALS__;
    const webCaps = await detectFfmpegCapabilities();
    expect(webCaps.available).toBe(false);

    // 2. En entorno Tauri
    (globalThis as any).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'detect_ffmpeg') {
        return {
          available: true,
          path: 'C:\\tools\\ffmpeg.exe',
          version: 'ffmpeg version 9.0.1',
          has_nvenc: true,
          has_qsv: false,
          has_amf: false,
          has_libx264: true,
          recommended_encoder: 'h264_nvenc',
        };
      }
      return null;
    });

    const tauriCaps = await detectFfmpegCapabilities();
    expect(tauriCaps.available).toBe(true);
    expect(tauriCaps.has_nvenc).toBe(true);
    expect(tauriCaps.recommended_encoder).toBe('h264_nvenc');
    expect(invoke).toHaveBeenCalledWith('detect_ffmpeg');

    delete (globalThis as any).__TAURI_INTERNALS__;
  });

  it('runFfmpegCommand invoca el comando nativo en Tauri y lanza error en entorno web', async () => {
    // En entorno web
    delete (globalThis as any).__TAURI_INTERNALS__;
    await expect(runFfmpegCommand(['-version'])).rejects.toThrow('solo está disponible');

    // En entorno Tauri
    (globalThis as any).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockResolvedValue('ffmpeg version 9.0.1');

    const result = await runFfmpegCommand(['-version']);
    expect(result).toBe('ffmpeg version 9.0.1');
    expect(invoke).toHaveBeenCalledWith('run_ffmpeg_command', { args: ['-version'] });

    delete (globalThis as any).__TAURI_INTERNALS__;
  });

  it('openSessionDialog usa pick_file_dialog para garantizar la concesión en Tauri', async () => {
    (globalThis as any).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockImplementation(async (cmd: string, _args: any) => {
      if (cmd === 'pick_file_dialog') {
        return 'C:\\Users\\User\\Downloads\\sesion.zip';
      }
      if (cmd === 'get_file_info') {
        return { exists: true, size: 1048576, is_file: true };
      }
      return null;
    });

    const handle = await openSessionDialog();
    expect(handle).not.toBeNull();
    expect(handle?.sourceType).toBe('tauri_path');
    expect(handle?.path).toBe('C:\\Users\\User\\Downloads\\sesion.zip');
    expect(handle?.size).toBe(1048576);
    expect(invoke).toHaveBeenCalledWith('pick_file_dialog', expect.objectContaining({
      title: expect.any(String),
      filters: expect.any(Array),
    }));

    delete (globalThis as any).__TAURI_INTERNALS__;
  });

  it('executeSafeFfmpeg invoca operaciones fijas y protegidas en Tauri', async () => {
    (globalThis as any).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockResolvedValue('ffmpeg extract audio success');

    const result = await executeSafeFfmpeg({
      operation: 'extract_audio',
      input_path: 'C:\\Videos\\in.mp4',
      output_path: 'C:\\Videos\\out.aac',
      codec: 'copy',
    });

    expect(result).toBe('ffmpeg extract audio success');
    expect(invoke).toHaveBeenCalledWith('execute_safe_ffmpeg', {
      op: {
        operation: 'extract_audio',
        input_path: 'C:\\Videos\\in.mp4',
        output_path: 'C:\\Videos\\out.aac',
        codec: 'copy',
      },
    });

    delete (globalThis as any).__TAURI_INTERNALS__;
  });
});
