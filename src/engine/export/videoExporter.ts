import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget, FileSystemWritableFileStreamTarget as Mp4FileSystemTarget } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget, FileSystemWritableFileStreamTarget as WebmFileSystemTarget } from 'webm-muxer';
import { OverlayRenderer } from '../canvas/overlayRenderer';
import { TimeEngine } from '../../core/telemetry/timeEngine';
import { VehicleProfile } from '../../core/profile/vehicleProfile';
import { TelemetryPoint } from '../../core/model/telemetry';

export type ExportMode =
  | 'mp4_combined'
  | 'mp4_telemetry_only'
  | 'mp4_chroma_green'
  | 'webm_telemetry'
  | 'webm_transparent';

export interface ExportProgress {
  percent: number;
  currentFrame: number;
  totalFrames: number;
  fpsEncoding: number;
  etaSec: number;
  status: string;
}

export interface VideoExporterOptions {
  mode: ExportMode;
  startSec: number;
  endSec: number;
  fps: number;
  width: number;
  height: number;
  bitrate?: number; // en bits por segundo, e.g. 10_000_000
  videoSourceElement?: HTMLVideoElement | null;
  videoBlob?: Blob;
  useFileSystemAccess?: boolean;
  onProgress?: (p: ExportProgress) => void;
  cancellationToken?: { isCancelled: boolean };
}

export interface ExportResult {
  blob?: Blob;
  fileSavedDirectly: boolean;
  durationSec: number;
  totalFramesEncoded: number;
}

/**
 * Comprueba si el navegador actual soporta WebCodecs VideoEncoder.
 */
export function isWebCodecsSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).VideoEncoder !== 'undefined';
}

/**
 * Comprueba si File System Access API está disponible para streaming directo a disco.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showSaveFilePicker === 'function';
}

/**
 * Exportador de vídeo y overlay acelerado por hardware mediante WebCodecs y Muxer.
 */
export class VideoExporter {
  /**
   * Renderiza y codifica el vídeo con overlay o la pista de overlay transparente.
   */
  public static async exportVideo(
    engine: TimeEngine,
    renderer: OverlayRenderer,
    profile: VehicleProfile,
    allPoints: TelemetryPoint[],
    options: VideoExporterOptions
  ): Promise<ExportResult> {
    if (!isWebCodecsSupported()) {
      throw new Error(
        'Tu navegador no soporta WebCodecs (VideoEncoder). Utiliza Google Chrome o Microsoft Edge actualizados.'
      );
    }

    const {
      mode,
      startSec,
      endSec,
      fps,
      width,
      height,
      bitrate = 12_000_000,
      videoSourceElement,
      useFileSystemAccess = false,
      onProgress,
      cancellationToken,
    } = options;

    const durationSec = Math.max(0.1, endSec - startSec);
    const totalFrames = Math.max(1, Math.round(durationSec * fps));
    const isWebm = mode === 'webm_telemetry' || mode === 'webm_transparent';

    onProgress?.({
      percent: 0,
      currentFrame: 0,
      totalFrames,
      fpsEncoding: 0,
      etaSec: 0,
      status: 'Configurando codificador por hardware y archivo de salida...',
    });

    // 1. Configurar archivo de salida (Streaming a disco o Buffer en memoria)
    let fileHandle: any = null;
    let writableStream: any = null;
    let fileSavedDirectly = false;

    if (useFileSystemAccess && isFileSystemAccessSupported()) {
      try {
        const fileExt = isWebm ? 'webm' : 'mp4';
        const fileMime = isWebm ? 'video/webm' : 'video/mp4';
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: `tachyon_${mode}_${width}p_${Math.round(startSec)}-${Math.round(endSec)}s.${fileExt}`,
          types: [
            {
              description: isWebm ? 'Vídeo WebM' : 'Vídeo MP4 con telemetría',
              accept: { [fileMime]: [`.${fileExt}`] },
            },
          ],
        });
        writableStream = await fileHandle.createWritable();
        fileSavedDirectly = true;
      } catch (e: any) {
        if (e.name === 'AbortError') {
          throw new Error('Exportación cancelada por el usuario al elegir archivo.');
        }
        console.warn('No se pudo abrir FileSystemWritableStream, recurriendo a descarga en memoria:', e);
      }
    }

    // 2. Instanciar Muxer correspondiente
    let mp4Muxer: Mp4Muxer<any> | null = null;
    let webmMuxer: WebmMuxer<any> | null = null;

    if (isWebm) {
      const target = writableStream
        ? new WebmFileSystemTarget(writableStream)
        : new WebmArrayBufferTarget();

      webmMuxer = new WebmMuxer({
        target,
        video: {
          codec: 'V_VP9',
          width,
          height,
        },
      });
    } else {
      const target = writableStream
        ? new Mp4FileSystemTarget(writableStream)
        : new Mp4ArrayBufferTarget();

      mp4Muxer = new Mp4Muxer({
        target,
        video: {
          codec: 'avc',
          width,
          height,
        },
        fastStart: 'in-memory',
      });
    }

    // 3. Configurar VideoEncoder de WebCodecs
    const VideoEncoderClass = (window as any).VideoEncoder;
    let videoEncoder: any = null;
    let encoderError: Error | null = null;

    const encoderConfig: any = isWebm
      ? {
          codec: 'vp09.00.10.08',
          width,
          height,
          bitrate,
          framerate: fps,
        }
      : {
          codec: 'avc1.640028', // H.264 High Profile Level 4.0
          width,
          height,
          bitrate,
          framerate: fps,
        };

    const isSupported = await VideoEncoderClass.isConfigSupported(encoderConfig);
    if (!isSupported.supported) {
      // Fallback a Baseline profile si High profile no está soportado en la GPU
      if (!isWebm) {
        encoderConfig.codec = 'avc1.42001f';
      }
    }

    videoEncoder = new VideoEncoderClass({
      output: (chunk: any, meta: any) => {
        if (isWebm && webmMuxer) {
          webmMuxer.addVideoChunk(chunk, meta);
        } else if (mp4Muxer) {
          mp4Muxer.addVideoChunk(chunk, meta);
        }
      },
      error: (e: any) => {
        console.error('Error en VideoEncoder:', e);
        encoderError = e instanceof Error ? e : new Error(e?.message || String(e));
      },
    });

    try {
      videoEncoder.configure(encoderConfig);
    } catch (err: any) {
      throw new Error(
        `Error al configurar el codificador de vídeo (${encoderConfig.codec}): ${err?.message || err}`
      );
    }

    // 4. Canvas de renderizado fuera de pantalla (OffscreenCanvas si está disponible)
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    // Adaptar escala del renderizador al tamaño de exportación
    renderer.resize(width, height);

    const VideoFrameClass = (window as any).VideoFrame;
    const startTimeReal = performance.now();

    // 5. Bucle cuadro a cuadro determinista
    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      if (cancellationToken?.isCancelled) {
        try { videoEncoder.close(); } catch (_) {}
        if (writableStream) await writableStream.abort();
        throw new Error('Renderizado cancelado por el usuario.');
      }

      if (encoderError) {
        throw encoderError;
      }

      if (videoEncoder.state !== 'configured') {
        throw new Error(
          `El codificador de vídeo no está disponible (estado: ${videoEncoder.state}). Intenta exportar en resolución 1080p o cambiar de formato.`
        );
      }

      const t = startSec + frameIdx * (1 / fps);

      // Limpiar lienzo
      ctx.clearRect(0, 0, width, height);

      // Establecer fondo según el modo elegido
      if (mode === 'mp4_combined' && videoSourceElement) {
        if (t >= 0 && t <= videoSourceElement.duration) {
          await seekVideoTo(videoSourceElement, t);
          ctx.drawImage(videoSourceElement, 0, 0, width, height);
        } else {
          // Fondo negro si t está en offset negativo o fuera del vídeo
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
        }
      } else if (mode === 'mp4_chroma_green') {
        // Fondo verde croma puro (#00FF00) para eliminar con 1 clic en Premiere o DaVinci (Ultra Key)
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(0, 0, width, height);
      } else {
        // Fondo negro puro para modo telemetría (se hace transparente con modo de fusión 'Pantalla' / 'Screen')
        ctx.fillStyle = '#090C0E';
        ctx.fillRect(0, 0, width, height);
      }

      // Dibujar overlay de telemetría determinista en el instante t
      const snap = engine.query(t);
      renderer.render(ctx, snap, profile, t, allPoints);

      // Crear VideoFrame de WebCodecs con timestamp en microsegundos
      const timestampMicros = Math.round(frameIdx * (1_000_000 / fps));
      const videoFrame = new VideoFrameClass(canvas, {
        timestamp: timestampMicros,
        duration: Math.round(1_000_000 / fps),
      });

      // Insertar keyframe cada 2 segundos
      const isKeyFrame = frameIdx % (fps * 2) === 0;
      videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close();

      // Control de contrapresión de codificación (evita acumular fotogramas en cola)
      if (videoEncoder.encodeQueueSize > 4) {
        await new Promise((r) => setTimeout(r, 10));
      }

      // Notificar progreso periódico
      if (frameIdx % 10 === 0 || frameIdx === totalFrames - 1) {
        const elapsedSec = (performance.now() - startTimeReal) / 1000;
        const currentFps = elapsedSec > 0 ? (frameIdx + 1) / elapsedSec : 0;
        const remainingFrames = totalFrames - (frameIdx + 1);
        const etaSec = currentFps > 0 ? remainingFrames / currentFps : 0;

        onProgress?.({
          percent: Math.round(((frameIdx + 1) / totalFrames) * 100),
          currentFrame: frameIdx + 1,
          totalFrames,
          fpsEncoding: Math.round(currentFps * 10) / 10,
          etaSec: Math.round(etaSec),
          status: `Codificando cuadro ${frameIdx + 1} de ${totalFrames}...`,
        });
      }
    }

    // 6. Finalizar codificación y muxer
    onProgress?.({
      percent: 99,
      currentFrame: totalFrames,
      totalFrames,
      fpsEncoding: 0,
      etaSec: 0,
      status: 'Finalizando archivo y cerrando contenedor...',
    });

    await videoEncoder.flush();
    videoEncoder.close();

    let outputBlob: Blob | undefined;

    if (isWebm && webmMuxer) {
      webmMuxer.finalize();
      if (!writableStream) {
        const buffer = (webmMuxer.target as WebmArrayBufferTarget).buffer;
        outputBlob = new Blob([buffer], { type: 'video/webm' });
      }
    } else if (mp4Muxer) {
      mp4Muxer.finalize();
      if (!writableStream) {
        const buffer = (mp4Muxer.target as Mp4ArrayBufferTarget).buffer;
        outputBlob = new Blob([buffer], { type: 'video/mp4' });
      }
    }

    if (writableStream) {
      await writableStream.close();
    }

    onProgress?.({
      percent: 100,
      currentFrame: totalFrames,
      totalFrames,
      fpsEncoding: 0,
      etaSec: 0,
      status: '¡Renderizado completado con éxito!',
    });

    return {
      blob: outputBlob,
      fileSavedDirectly,
      durationSec,
      totalFramesEncoded: totalFrames,
    };
  }
}

function seekVideoTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    // Si el tiempo solicitado es prácticamente el actual (menos de 2ms de diferencia)
    if (Math.abs(video.currentTime - time) < 0.002 && !video.seeking) {
      resolve();
      return;
    }

    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        video.removeEventListener('seeked', onSeeked);
        resolve();
      }
    }, 250); // Timeout protector de 250ms por frame para garantizar render sin bloqueos

    const onSeeked = () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        video.removeEventListener('seeked', onSeeked);
        resolve();
      }
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.currentTime = time;
  });
}
