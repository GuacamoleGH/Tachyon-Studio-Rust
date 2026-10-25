import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { CustomSource, type Source } from 'mediabunny';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface NativeFileInfo {
  exists: boolean;
  size: number;
  is_file: boolean;
}

export interface ZipVideoEntryInfo {
  entry_name: string;
  is_stored: boolean;
  data_offset: number;
  size: number;
}

export interface ZipSessionInspection {
  valid_session: boolean;
  session_json?: string;
  telemetria_csv?: string;
  ruta_gpx?: string;
  video_entry?: ZipVideoEntryInfo;
  error_message?: string;
}

export interface UnifiedFileHandle {
  sourceType: 'tauri_path' | 'web_file';
  name: string;
  path?: string;
  file?: File;
  size: number;
}

/**
 * Detecta si la aplicación está ejecutándose dentro del contenedor de escritorio de Tauri 2.
 */
export function isTauriEnvironment(): boolean {
  const g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? (globalThis as any) : null);
  return (
    g !== null &&
    ('__TAURI_INTERNALS__' in g || '__TAURI__' in g)
  );
}

/**
 * Abre un diálogo nativo o web para seleccionar el archivo ZIP de sesión.
 */
export async function openSessionDialog(): Promise<UnifiedFileHandle | null> {
  if (isTauriEnvironment()) {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: 'Sesión Tachyon (*.zip)',
          extensions: ['zip'],
        },
      ],
      title: 'Seleccionar Paquete de Sesión Tachyon (ZIP)',
    });

    if (!selected || typeof selected !== 'string') return null;

    const info = await invoke<NativeFileInfo>('get_file_info', { path: selected });
    const name = selected.split(/[\\/]/).pop() || 'sesion.zip';

    return {
      sourceType: 'tauri_path',
      name,
      path: selected,
      size: info.size,
    };
  }

  // Fallback web: input file
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        resolve({
          sourceType: 'web_file',
          name: file.name,
          file,
          size: file.size,
        });
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Abre un diálogo nativo o web para vincular un archivo de vídeo MP4 / WebM desde disco.
 */
export async function openVideoDialog(): Promise<UnifiedFileHandle | null> {
  if (isTauriEnvironment()) {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: 'Vídeo MP4 / MOV / WebM',
          extensions: ['mp4', 'mov', 'mkv', 'webm'],
        },
      ],
      title: 'Seleccionar Archivo de Vídeo Original',
    });

    if (!selected || typeof selected !== 'string') return null;

    const info = await invoke<NativeFileInfo>('get_file_info', { path: selected });
    const name = selected.split(/[\\/]/).pop() || 'video.mp4';

    return {
      sourceType: 'tauri_path',
      name,
      path: selected,
      size: info.size,
    };
  }

  // Fallback web
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm,.mkv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        resolve({
          sourceType: 'web_file',
          name: file.name,
          file,
          size: file.size,
        });
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Inspecciona un archivo ZIP de sesión nativamente en Rust sin cargarlo en RAM.
 */
export async function inspectNativeZipSession(zipPath: string): Promise<ZipSessionInspection> {
  return await invoke<ZipSessionInspection>('inspect_zip_session', { zipPath });
}

/**
 * Extrae en streaming un vídeo comprimido (DEFLATED) dentro del ZIP hacia un archivo temporal en disco.
 */
export async function extractNativeZipVideoToTemp(zipPath: string, entryName: string): Promise<string> {
  return await invoke<string>('extract_zip_video_to_temp', { zipPath, entryName });
}

/**
 * Crea un Source de Mediabunny respaldado por un archivo local en disco leído por rangos en Rust.
 * Memoria acotada: solo lee los bytes solicitados (cero copias del archivo completo en RAM).
 */
export function createTauriFileSource(filePath: string, totalSize: number): Source {
  return new CustomSource({
    getSize: () => totalSize,
    read: async (start, end) => {
      const length = end - start;
      const bytes = await invoke<number[]>('read_file_range', {
        path: filePath,
        offset: start,
        length,
      });
      return new Uint8Array(bytes);
    },
    prefetchProfile: 'fileSystem',
  });
}

/**
 * Crea un Source de Mediabunny que lee un vídeo almacenado sin compresión (STORED)
 * directamente dentro del archivo ZIP por offset absoluto, sin descomprimir nada.
 */
export function createZipStoredVideoSource(
  zipPath: string,
  dataOffset: number,
  videoSize: number
): Source {
  return new CustomSource({
    getSize: () => videoSize,
    read: async (start, end) => {
      const length = end - start;
      const absoluteOffset = dataOffset + start;
      const bytes = await invoke<number[]>('read_file_range', {
        path: zipPath,
        offset: absoluteOffset,
        length,
      });
      return new Uint8Array(bytes);
    },
    prefetchProfile: 'fileSystem',
  });
}

export interface NativeStreamWriterOutput {
  writable: WritableStream<{ type: 'write'; data: Uint8Array; position: number }>;
  path: string;
  close: () => Promise<void>;
  abort: () => Promise<void>;
}

/**
 * Abre un diálogo para guardar un vídeo y crea un WritableStream que escribe directamente a disco en Rust.
 */
export async function createSaveVideoWriter(
  suggestedName: string,
  ext: 'mp4' | 'webm'
): Promise<NativeStreamWriterOutput | null> {
  if (isTauriEnvironment()) {
    const selected = await save({
      filters: [
        {
          name: ext === 'webm' ? 'Vídeo WebM' : 'Vídeo MP4',
          extensions: [ext],
        },
      ],
      defaultPath: suggestedName,
      title: 'Guardar Vídeo Exportado',
    });

    if (!selected || typeof selected !== 'string') return null;

    const handleId = await invoke<number>('open_stream_writer', { path: selected });

    const writable = new WritableStream<{ type: 'write'; data: Uint8Array; position: number }>({
      async write(chunk) {
        await invoke('write_stream_chunk', {
          handleId,
          position: chunk.position,
          chunk: Array.from(chunk.data),
        });
      },
      async close() {
        await invoke('close_stream_writer', { handleId });
      },
      async abort() {
        await invoke('close_stream_writer', { handleId }).catch(() => {});
      },
    });

    return {
      writable,
      path: selected,
      close: async () => {
        await invoke('close_stream_writer', { handleId });
      },
      abort: async () => {
        await invoke('close_stream_writer', { handleId }).catch(() => {});
      },
    };
  }

  // Fallback web: File System Access API
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: ext === 'webm' ? 'Vídeo WebM' : 'Vídeo MP4',
            accept: { [ext === 'webm' ? 'video/webm' : 'video/mp4']: [`.${ext}`] },
          },
        ],
      });
      const stream = await fileHandle.createWritable();
      return {
        writable: stream,
        path: fileHandle.name,
        close: async () => stream.close(),
        abort: async () => stream.abort(),
      };
    } catch (e: any) {
      if (e.name === 'AbortError') return null;
      console.warn('Fallback web showSaveFilePicker falló:', e);
    }
  }

  return null;
}


