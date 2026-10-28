import { invoke } from '@tauri-apps/api/core';
import { CustomSource, type Source } from 'mediabunny';
import { sanitizeFilename } from '../utils/fileUtils';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface NativeFileInfo {
  exists: boolean;
  size: number;
  is_file: boolean;
}

export interface FfmpegCapabilities {
  available: boolean;
  path?: string;
  version?: string;
  has_nvenc: boolean;
  has_qsv: boolean;
  has_amf: boolean;
  has_libx264: boolean;
  recommended_encoder?: string;
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
    const selected = await invoke<string | null>('pick_file_dialog', {
      title: 'Seleccionar Paquete de Sesión Tachyon (ZIP)',
      filters: [
        {
          name: 'Sesión Tachyon (*.zip)',
          extensions: ['zip'],
        },
      ],
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
    const selected = await invoke<string | null>('pick_file_dialog', {
      title: 'Seleccionar Archivo de Vídeo Original',
      filters: [
        {
          name: 'Vídeo MP4 / MOV / WebM',
          extensions: ['mp4', 'mov', 'mkv', 'webm'],
        },
      ],
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
    // Sanitizar de forma defensiva para evitar caracteres prohibidos en Windows (<, >, :, ", /, \, |, ?, *)
    const cleanBase = sanitizeFilename(suggestedName.replace(new RegExp(`\\.${ext}$`, 'i'), ''));
    const safeDefaultPath = `${cleanBase}.${ext}`;

    const selected = await invoke<string | null>('pick_save_file_dialog', {
      title: 'Guardar Vídeo Exportado',
      defaultPath: safeDefaultPath,
      filters: [
        {
          name: ext === 'webm' ? 'Vídeo WebM' : 'Vídeo MP4',
          extensions: [ext],
        },
      ],
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

/**
 * Detecta si FFmpeg está disponible (en sidecar, WinGet o PATH del sistema)
 * y qué aceleradores por hardware (NVENC, QSV, AMF) soporta.
 */
export async function detectFfmpegCapabilities(): Promise<FfmpegCapabilities> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<FfmpegCapabilities>('detect_ffmpeg');
    } catch (e) {
      console.warn('Error detectando FFmpeg nativo:', e);
    }
  }
  return {
    available: false,
    has_nvenc: false,
    has_qsv: false,
    has_amf: false,
    has_libx264: false,
  };
}

/**
 * Ejecuta un comando FFmpeg a través del sidecar nativo de Tauri.
 */
export async function runFfmpegCommand(args: string[]): Promise<string> {
  if (!isTauriEnvironment()) {
    throw new Error('FFmpeg sidecar solo está disponible en el entorno de escritorio nativo (Tauri).');
  }
  return await invoke<string>('run_ffmpeg_command', { args });
}

export interface SafeFfmpegOp {
  operation: 'version' | 'extract_audio';
  input_path?: string;
  output_path?: string;
  codec?: string;
}

/**
 * Ejecuta una operación fija de FFmpeg con parámetros y rutas validadas.
 */
export async function executeSafeFfmpeg(op: SafeFfmpegOp): Promise<string> {
  if (!isTauriEnvironment()) {
    throw new Error('FFmpeg nativo solo está disponible en el entorno de escritorio nativo (Tauri).');
  }
  return await invoke<string>('execute_safe_ffmpeg', { op });
}

export interface VideoFileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  chapterInfo?: {
    isGoPro: boolean;
    session: string;
    chapter: number;
    label: string;
  };
}

/**
 * Identifica la sesión y el número de capítulo de un archivo según la nomenclatura de GoPro:
 * - HERO Session / HERO 5 Session / HERO 4 / HERO 5: GOPR0001.MP4, GP010001.MP4, GP020001.MP4
 * - HERO 6 / 7 / 8 / 9 / 10 / 11 / 12 / 13: GH010001.MP4, GH020001.MP4, GX010001.MP4
 */
export function parseGoProOrder(filename: string): {
  isGoPro: boolean;
  session: string;
  chapter: number;
  label: string;
} {
  const base = filename.trim().split(/[\\/]/).pop() || filename;
  const upper = base.toUpperCase();

  // Caso 1: HERO Session / HERO 5 Session / HERO 4 / HERO 5
  // Primer capítulo: GOPR0123.MP4 (Capítulo 1)
  const goprMatch = upper.match(/^GOPR(\d{4})\.(MP4|MOV)$/);
  if (goprMatch) {
    return {
      isGoPro: true,
      session: goprMatch[1],
      chapter: 1,
      label: `Capítulo 1 (Sesión ${goprMatch[1]})`,
    };
  }
  // Capítulos posteriores: GP010123.MP4 (Capítulo 2), GP020123.MP4 (Capítulo 3)
  const gpMatch = upper.match(/^GP(\d{2})(\d{4})\.(MP4|MOV)$/);
  if (gpMatch) {
    const chapterNum = parseInt(gpMatch[1], 10) + 1;
    return {
      isGoPro: true,
      session: gpMatch[2],
      chapter: chapterNum,
      label: `Capítulo ${chapterNum} (Sesión ${gpMatch[2]})`,
    };
  }

  // Caso 2: HERO 6, 7, 8, 9, 10, 11, 12, 13 (H.264 o HEVC)
  // GH010123.MP4 (Capítulo 1), GH020123.MP4 (Capítulo 2)
  const modernMatch = upper.match(/^G[HXSA](\d{2})(\d{4})\.(MP4|MOV)$/);
  if (modernMatch) {
    const chapterNum = parseInt(modernMatch[1], 10);
    return {
      isGoPro: true,
      session: modernMatch[2],
      chapter: chapterNum,
      label: `Capítulo ${chapterNum} (Sesión ${modernMatch[2]})`,
    };
  }

  return {
    isGoPro: false,
    session: '',
    chapter: 0,
    label: 'Clip de vídeo',
  };
}

/**
 * Ordena una lista de archivos de vídeo cronológicamente, detectando automáticamente
 * las secuencias de capítulos de cámaras GoPro (HERO Session, HERO 5, HERO 7-13, etc.).
 */
export function sortGoProFiles(items: VideoFileItem[]): VideoFileItem[] {
  return [...items].sort((a, b) => {
    const pa = parseGoProOrder(a.name);
    const pb = parseGoProOrder(b.name);

    if (pa.isGoPro && pb.isGoPro) {
      if (pa.session !== pb.session) {
        return pa.session.localeCompare(pb.session);
      }
      return pa.chapter - pb.chapter;
    }

    if (pa.isGoPro && !pb.isGoPro) return -1;
    if (!pa.isGoPro && pb.isGoPro) return 1;

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Diálogo interactivo para seleccionar múltiples archivos de vídeo (capítulos de GoPro).
 */
export async function openMultipleVideosDialog(): Promise<VideoFileItem[]> {
  if (isTauriEnvironment()) {
    const selected = await invoke<string[] | null>('pick_files_dialog', {
      title: 'Seleccionar capítulos de vídeo GoPro para unir',
      filters: [
        {
          name: 'Vídeos (*.mp4, *.mov, *.mkv)',
          extensions: ['mp4', 'mov', 'mkv', 'webm', 'm4v'],
        },
      ],
    });

    if (!selected) return [];
    const paths = Array.isArray(selected) ? selected : [selected];
    const items: VideoFileItem[] = [];

    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      if (typeof p === 'string') {
        const info = await invoke<NativeFileInfo>('get_file_info', { path: p });
        const name = p.split(/[\\/]/).pop() || `video_${i + 1}.mp4`;
        const chapter = parseGoProOrder(name);
        items.push({
          id: `${p}_${Date.now()}_${i}`,
          name,
          path: p,
          size: info.size,
          chapterInfo: chapter,
        });
      }
    }
    return sortGoProFiles(items);
  }

  // Fallback web
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'video/mp4,video/quicktime,.mp4,.mov,.mkv';
    input.onchange = () => {
      if (!input.files || input.files.length === 0) {
        resolve([]);
        return;
      }
      const files: VideoFileItem[] = [];
      for (let i = 0; i < input.files.length; i++) {
        const f = input.files[i];
        const chapter = parseGoProOrder(f.name);
        files.push({
          id: `${f.name}_${Date.now()}_${i}`,
          name: f.name,
          path: f.name,
          size: f.size,
          chapterInfo: chapter,
        });
      }
      resolve(sortGoProFiles(files));
    };
    input.click();
  });
}

/**
 * Diálogo para elegir la ruta de guardado del archivo unido.
 */
export async function saveVideoDialog(suggestedName: string): Promise<string | null> {
  if (isTauriEnvironment()) {
    const selected = await invoke<string | null>('pick_save_file_dialog', {
      defaultPath: suggestedName,
      title: 'Guardar vídeo GoPro unido',
      filters: [
        {
          name: 'Vídeo MP4 (*.mp4)',
          extensions: ['mp4'],
        },
      ],
    });
    return selected || null;
  }
  return suggestedName;
}

/**
 * Concatena múltiples archivos de vídeo en disco sin recodificación (-c copy)
 * a través de FFmpeg nativo, preservando el 100% de calidad y sincronía de audio.
 */
export async function concatenateVideos(inputPaths: string[], outputPath: string): Promise<string> {
  if (!isTauriEnvironment()) {
    throw new Error('La unión de vídeos nativa con FFmpeg requiere el entorno de escritorio Tachyon Studio.');
  }
  return await invoke<string>('concatenate_videos', {
    inputs: inputPaths,
    outputPath,
  });
}


