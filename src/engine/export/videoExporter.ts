import {
  Input,
  Output,
  BlobSource,
  Target,
  StreamTarget,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  CanvasSource,
  VideoSampleSink,
  EncodedPacketSink,
  EncodedAudioPacketSource,
  EncodedPacket,
  ALL_FORMATS,
  type Source,
} from 'mediabunny';
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

export interface ExportWarning {
  type: 'audio_missing' | 'audio_error' | 'seek_fallback';
  message: string;
}

export interface VideoExporterOptions {
  mode: ExportMode;
  startSec: number;
  endSec: number;
  fps: number;
  width: number;
  height: number;
  bitrate?: number; // bits por segundo, e.g. 12_000_000
  videoSourceElement?: HTMLVideoElement | null;
  videoBlob?: Blob;
  videoFile?: File | Blob;
  customSource?: Source;
  customTarget?: Target;
  useFileSystemAccess?: boolean;
  onProgress?: (p: ExportProgress) => void;
  onWarning?: (w: ExportWarning) => void;
  allowSilentAudio?: boolean;
  cancellationToken?: { isCancelled: boolean };
}

export interface ExportResult {
  blob?: Blob;
  fileSavedDirectly: boolean;
  durationSec: number;
  totalFramesEncoded: number;
  audioPassthroughSuccess?: boolean;
  audioWarning?: string;
  usedSeekFallback?: boolean;
}

/**
 * Comprueba si el entorno actual soporta WebCodecs VideoEncoder.
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
 * Exportador de vídeo y telemetría de alto rendimiento con memoria acotada.
 * Utiliza Mediabunny y WebCodecs para:
 * 1. Decodificación secuencial determinista sin seeks por frame.
 * 2. Muxing y escritura en streaming sin retención masiva en RAM (fastStart: false).
 * 3. Preservación del audio original (AAC passthrough) sin recodificar.
 * 4. Contrapresión continua y liberación inmediata de VideoFrame/VideoSample.
 */
export class VideoExporter {
  public static async exportVideo(
    engine: TimeEngine,
    renderer: OverlayRenderer,
    profile: VehicleProfile,
    allPoints: TelemetryPoint[],
    options: VideoExporterOptions
  ): Promise<ExportResult> {
    if (!isWebCodecsSupported()) {
      throw new Error(
        'El sistema o navegador actual no soporta WebCodecs (VideoEncoder). Asegúrate de contar con WebView2 o Chrome/Edge actualizado.'
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
      videoBlob,
      videoFile,
      customSource,
      videoSourceElement,
      useFileSystemAccess = false,
      onProgress,
      onWarning,
      cancellationToken,
    } = options;

    let audioWarning: string | undefined;
    let audioPassthroughConfigured = false;
    let usedSeekFallback = false;

    const durationSec = Math.max(0.1, endSec - startSec);
    const totalFrames = Math.max(1, Math.round(durationSec * fps));
    const isWebm = mode === 'webm_telemetry' || mode === 'webm_transparent';
    const isAlphaMode = mode === 'webm_transparent';
    const isCombined = mode === 'mp4_combined';

    onProgress?.({
      percent: 0,
      currentFrame: 0,
      totalFrames,
      fpsEncoding: 0,
      etaSec: 0,
      status: 'Inicializando pipeline de vídeo en streaming con Mediabunny...',
    });

    // 1. Configurar archivo de salida (Target personalizado, Streaming con File System Access API o Buffer en memoria)
    let fileHandle: any = null;
    let writableStream: any = null;
    let fileSavedDirectly = !!options.customTarget;

    if (!options.customTarget && useFileSystemAccess && isFileSystemAccessSupported()) {
      try {
        const fileExt = isWebm ? 'webm' : 'mp4';
        const fileMime = isWebm ? 'video/webm' : 'video/mp4';
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: `tachyon_${mode}_${height}p_${Math.round(startSec)}-${Math.round(endSec)}s.${fileExt}`,
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
        console.warn('No se pudo abrir FileSystemWritableStream, recurriendo a búfer en memoria:', e);
      }
    }

    // 2. Configurar Target de Mediabunny (Streaming sin saturar RAM)
    const target = options.customTarget
      ? options.customTarget
      : writableStream
      ? new StreamTarget(writableStream)
      : new BufferTarget();

    // 3. Configurar formato de salida (fastStart: false para evitar acumular todo el vídeo en RAM)
    const outputFormat = isWebm
      ? new WebMOutputFormat()
      : new Mp4OutputFormat({ fastStart: false });

    const output = new Output({
      format: outputFormat,
      target,
    });

    // 4. Preparar lienzo de renderizado (OffscreenCanvas si está disponible, o Canvas de DOM)
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d', { alpha: isAlphaMode }) as OffscreenCanvasRenderingContext2D;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d', { alpha: isAlphaMode }) as CanvasRenderingContext2D;
    }

    renderer.resize(width, height);

    // 5. Configurar pista de vídeo de salida en Mediabunny
    const canvasSource = new CanvasSource(canvas, {
      codec: isWebm ? 'vp9' : 'avc',
      bitrate,
      keyFrameInterval: 2,
      alpha: isAlphaMode ? 'keep' : 'discard',
    });
    output.addVideoTrack(canvasSource);

    // 6. Configurar fuente de entrada de vídeo y audio si el modo es combinado
    const inputBlob = customSource ? null : (videoBlob || (videoFile as Blob));
    let input: Input | null = null;
    let videoSink: VideoSampleSink | null = null;
    let audioTrack: any = null;
    let audioSource: EncodedAudioPacketSource | null = null;
    let inputVideoDuration = 0;

    if (isCombined && (inputBlob || customSource)) {
      const sourceInstance = customSource || new BlobSource(inputBlob!);
      input = new Input({
        source: sourceInstance,
        formats: ALL_FORMATS,
      });

      const videoTrack = await input.getPrimaryVideoTrack();
      if (videoTrack) {
        inputVideoDuration = await videoTrack.computeDuration().catch(() => 0);
        videoSink = new VideoSampleSink(videoTrack);
      }

      // Preparar audio original para passthrough (sin recodificar)
      audioTrack = await input.getPrimaryAudioTrack();
      if (audioTrack && !isWebm) {
        try {
          const audioCodec = await audioTrack.getCodec();
          if (audioCodec) {
            audioSource = new EncodedAudioPacketSource(audioCodec);
            output.addAudioTrack(audioSource);
            audioPassthroughConfigured = true;
          } else {
            audioWarning = 'La pista de audio original no posee un códec compatible para passthrough directo. El vídeo se exportará sin audio.';
            onWarning?.({ type: 'audio_missing', message: audioWarning });
          }
        } catch (err: any) {
          audioWarning = `No se pudo inicializar la pista de audio passthrough: ${err?.message || err}. El vídeo se exportará sin audio.`;
          onWarning?.({ type: 'audio_error', message: audioWarning });
        }
      } else if (!audioTrack && isCombined) {
        audioWarning = 'El vídeo de origen no contiene ninguna pista de audio. El vídeo exportado será mudo.';
        onWarning?.({ type: 'audio_missing', message: audioWarning });
      }
    }

    // 7. Iniciar el multiplexor de salida
    await output.start();

    // 8. Transferir audio original en segundo plano (streaming de paquetes de audio)
    let audioTransferPromise: Promise<void> = Promise.resolve();
    if (audioTrack && audioSource) {
      audioTransferPromise = (async () => {
        try {
          const audioSink = new EncodedPacketSink(audioTrack);
          const audioConfig = await audioTrack.getDecoderConfig();
          let isFirst = true;

          for await (const packet of audioSink.packets()) {
            if (cancellationToken?.isCancelled) break;

            const packetEnd = packet.timestamp + packet.duration;
            if (packetEnd < startSec) continue;
            if (packet.timestamp > endSec) break;

            const adjustedTimestamp = Math.max(0, packet.timestamp - startSec);
            const shiftedPacket = new EncodedPacket(
              packet.data,
              packet.type,
              adjustedTimestamp,
              packet.duration,
              packet.sequenceNumber,
              packet.byteLength,
              packet.sideData
            );

            if (isFirst && audioConfig) {
              await audioSource.add(shiftedPacket, { decoderConfig: audioConfig });
              isFirst = false;
            } else {
              await audioSource.add(shiftedPacket);
            }
          }
        } catch (audioErr: any) {
          audioWarning = `Advertencia durante la copia de paquetes de audio original: ${audioErr?.message || audioErr}. El audio exportado podría ser parcial o mudo.`;
          onWarning?.({ type: 'audio_error', message: audioWarning });
        }
      })();
    }

    // 9. Bucle determinista de renderizado de fotogramas
    const startTimeReal = performance.now();
    const frameDuration = 1 / fps;
    const tolerance = 0.5 * frameDuration; // Margen de medio frame para absorber imprecisiones flotantes

    try {
      for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
        if (cancellationToken?.isCancelled) {
          await output.cancel();
          if (writableStream) await writableStream.abort().catch(() => {});
          input?.dispose();
          throw new Error('Renderizado cancelado por el usuario.');
        }

        const t = startSec + frameIdx * frameDuration;
        const outTimestampSec = frameIdx * frameDuration;

        // Limpiar lienzo
        ctx.clearRect(0, 0, width, height);

        // Fondo y decodificación de vídeo
        if (isCombined) {
          if (videoSink && t >= 0 && (inputVideoDuration === 0 || t <= inputVideoDuration + tolerance)) {
            // Decodificación de fotograma con verificación determinista
            const sample = await videoSink.getSample(t);
            if (sample) {
              const sampleStart = sample.timestamp;
              const sampleEnd = sample.timestamp + (sample.duration || frameDuration);

              // Verificación estricta: el fotograma devuelto debe corresponder al instante pedido
              if (t < sampleStart - tolerance || t > sampleEnd + tolerance) {
                sample.close();
                throw new Error(
                  `Desincronización en decodificación: el fotograma devuelto (timestamp: ${sampleStart.toFixed(3)}s) ` +
                  `no cubre el instante requerido t=${t.toFixed(3)}s (esperado en rango [${(sampleStart - tolerance).toFixed(3)}, ${(sampleEnd + tolerance).toFixed(3)}]).`
                );
              }

              sample.draw(ctx as any, 0, 0, width, height);
              sample.close();
            } else {
              // Si no hay muestra en este instante (ej. t previo al primer frame), dibujar fondo negro
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, width, height);
            }
          } else if (videoSourceElement && t >= 0 && t <= videoSourceElement.duration) {
            // Fallback para elementos de vídeo del navegador si no hay blob
            if (!usedSeekFallback) {
              usedSeekFallback = true;
              onWarning?.({
                type: 'seek_fallback',
                message: 'Modo de compatibilidad HTMLVideoElement activo: la sincronización de fotogramas utiliza el navegador (precisión estándar).',
              });
            }
            await seekVideoTo(videoSourceElement, t);
            (ctx as CanvasRenderingContext2D).drawImage(videoSourceElement, 0, 0, width, height);
          } else {
            // Fuera de límites de duración o t < 0: fondo negro determinista
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
          }
        } else if (mode === 'mp4_chroma_green') {
          // Fondo verde croma puro (#00FF00) para keying en editores NLE
          ctx.fillStyle = '#00FF00';
          ctx.fillRect(0, 0, width, height);
        } else if (!isAlphaMode) {
          // Fondo oscuro para modo telemetría estándar
          ctx.fillStyle = '#090C0E';
          ctx.fillRect(0, 0, width, height);
        }

        // Dibujar el instrumental vectorial y overlays en el instante t exacto
        const snap = engine.query(t);
        renderer.render(ctx as any, snap, profile, t, allPoints);

        // Añadir muestra al canal de salida con contrapresión automática integrada
        await canvasSource.add(outTimestampSec, frameDuration);

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
            status: `Renderizando cuadro ${frameIdx + 1} de ${totalFrames}...`,
          });
        }
      }

      // 10. Esperar que finalice la copia de paquetes de audio
      await audioTransferPromise;

      onProgress?.({
        percent: 99,
        currentFrame: totalFrames,
        totalFrames,
        fpsEncoding: 0,
        etaSec: 0,
        status: 'Finalizando contenedor y escribiendo metadata en streaming...',
      });

      // 11. Finalizar salida
      await output.finalize();
      input?.dispose();

      let outputBlob: Blob | undefined;
      if (!writableStream && target instanceof BufferTarget && target.buffer) {
        outputBlob = new Blob([target.buffer], { type: isWebm ? 'video/webm' : 'video/mp4' });
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
        audioPassthroughSuccess: audioPassthroughConfigured,
        audioWarning,
        usedSeekFallback,
      };
    } catch (err) {
      try { await output.cancel(); } catch (_) {}
      try { input?.dispose(); } catch (_) {}
      if (writableStream) {
        try { await writableStream.abort(); } catch (_) {}
      }
      throw err;
    }
  }
}

/**
 * Fallback auxiliar para elementos de vídeo HTML5 cuando no se dispone de blob de archivo.
 */
function seekVideoTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
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
    }, 250);

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
