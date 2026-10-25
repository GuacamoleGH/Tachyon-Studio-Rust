import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isTauriEnvironment,
  createTauriFileSource,
  createZipStoredVideoSource,
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
});
