import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Film,
  Download,
  AlertCircle,
  HardDrive,
  CheckCircle2,
  Cpu,
  Layers,
  StopCircle,
  Clock,
  Gauge,
  Zap,
} from 'lucide-react';
import { SessionBundle } from '../../core/model/session';
import { TimeEngine } from '../../core/telemetry/timeEngine';
import { OverlayRenderer } from '../../engine/canvas/overlayRenderer';
import { VehicleProfile } from '../../core/profile/vehicleProfile';
import { StreamTarget } from 'mediabunny';
import {
  ExportMode,
  ExportProgress,
  ExportWarning,
  isFileSystemAccessSupported,
  isWebCodecsSupported,
  VideoExporter,
} from '../../engine/export/videoExporter';
import {
  isTauriEnvironment,
  createSaveVideoWriter,
  detectFfmpegCapabilities,
  type FfmpegCapabilities,
} from '../../core/fs/fileSystemAdapter';
import {
  formatTimeMinutes,
  parseTimeToSeconds,
  formatDurationHuman,
} from '../../core/utils/timeFormat';
import { sanitizeFilename } from '../../core/utils/fileUtils';

interface RenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionBundle;
  profile: VehicleProfile;
  renderer: OverlayRenderer;
  initialStartSec?: number;
  initialEndSec?: number;
  currentTime?: number;
}

export const RenderModal: React.FC<RenderModalProps> = ({
  isOpen,
  onClose,
  session,
  profile,
  renderer,
  initialStartSec,
  initialEndSec,
  currentTime,
}) => {
  const [mode, setMode] = useState<ExportMode>(
    session.hasVideo ? 'mp4_combined' : 'mp4_telemetry_only'
  );

  const duration = session.durationSec || 90.0;
  const metadataVideoDur = session.metadata?.video?.duration_sec;
  const initialDuration =
    session.hasVideo && metadataVideoDur && metadataVideoDur > 0
      ? metadataVideoDur
      : duration;

  const [videoDuration, setVideoDuration] = useState<number | null>(metadataVideoDur || null);
  const [startSec, setStartSec] = useState<number>(() =>
    initialStartSec !== undefined ? Math.max(0, initialStartSec) : 0.0
  );
  const [endSec, setEndSec] = useState<number>(() =>
    initialEndSec !== undefined && initialEndSec > 0 ? Math.min(initialDuration, initialEndSec) : initialDuration
  );
  const [startInputText, setStartInputText] = useState<string>(() =>
    formatTimeMinutes(initialStartSec ?? 0.0, true)
  );
  const [endInputText, setEndInputText] = useState<string>(() =>
    formatTimeMinutes(initialEndSec && initialEndSec > 0 ? initialEndSec : initialDuration, true)
  );

  // Sincronizar rangos cuando se abre el modal con valores del reproductor
  useEffect(() => {
    if (isOpen) {
      const s = initialStartSec !== undefined ? Math.max(0, initialStartSec) : 0.0;
      const e =
        initialEndSec !== undefined && initialEndSec > s
          ? Math.min(initialDuration, initialEndSec)
          : initialDuration;
      setStartSec(s);
      setEndSec(e);
      setStartInputText(formatTimeMinutes(s, true));
      setEndInputText(formatTimeMinutes(e, true));
    }
  }, [isOpen, initialStartSec, initialEndSec, initialDuration]);

  const updateStartSec = (val: number) => {
    const clamped = Math.max(0, Math.min(endSec - 0.1, val));
    setStartSec(clamped);
    setStartInputText(formatTimeMinutes(clamped, true));
  };

  const updateEndSec = (val: number) => {
    const clamped = Math.max(startSec + 0.1, Math.min(initialDuration, val));
    setEndSec(clamped);
    setEndInputText(formatTimeMinutes(clamped, true));
  };

  const handleStartTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setStartInputText(text);
    const parsed = parseTimeToSeconds(text);
    if (parsed !== null && parsed >= 0 && parsed < endSec) {
      setStartSec(parsed);
    }
  };

  const handleStartTextBlur = () => {
    const parsed = parseTimeToSeconds(startInputText);
    if (parsed !== null && parsed >= 0 && parsed < endSec) {
      updateStartSec(parsed);
    } else {
      setStartInputText(formatTimeMinutes(startSec, true));
    }
  };

  const handleEndTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setEndInputText(text);
    const parsed = parseTimeToSeconds(text);
    if (parsed !== null && parsed > startSec && parsed <= initialDuration) {
      setEndSec(parsed);
    }
  };

  const handleEndTextBlur = () => {
    const parsed = parseTimeToSeconds(endInputText);
    if (parsed !== null && parsed > startSec && parsed <= initialDuration) {
      updateEndSec(parsed);
    } else {
      setEndInputText(formatTimeMinutes(endSec, true));
    }
  };
  const [fps, setFps] = useState<number>(30); // 30 FPS por defecto: el estándar en móviles y el doble de rápido
  const [resolution, setResolution] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });
  const [bitrate, setBitrate] = useState<number>(14_000_000);

  const isTauri = isTauriEnvironment();
  const hasWebCodecs = isWebCodecsSupported();
  const hasFSA = isFileSystemAccessSupported();
  const supportsStreaming = isTauri || hasFSA;
  const [useStreaming, setUseStreaming] = useState<boolean>(supportsStreaming);
  const [ffmpegCaps, setFfmpegCaps] = useState<FfmpegCapabilities | null>(null);

  useEffect(() => {
    if (isTauri) {
      detectFfmpegCapabilities()
        .then((caps) => {
          if (caps.available) setFfmpegCaps(caps);
        })
        .catch(() => {});
    }
  }, [isTauri]);

  // Estado del proceso de renderizado
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [fileSavedDirectly, setFileSavedDirectly] = useState<boolean>(false);
  const [warnings, setWarnings] = useState<ExportWarning[]>([]);
  const [resultAudioWarning, setResultAudioWarning] = useState<string | null>(null);
  const [usedSeekFallback, setUsedSeekFallback] = useState<boolean>(false);

  const cancellationTokenRef = useRef<{ isCancelled: boolean }>({ isCancelled: false });
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    setIsRendering(true);
    setError(null);
    setOutputBlob(null);
    setFileSavedDirectly(false);
    setWarnings([]);
    setResultAudioWarning(null);
    setUsedSeekFallback(false);
    cancellationTokenRef.current = { isCancelled: false };

    const engine = TimeEngine.fromBundle(session);
    const isWebm = mode === 'webm_telemetry' || mode === 'webm_transparent';
    const ext = isWebm ? 'webm' : 'mp4';
    const safeTitle = sanitizeFilename(session.title.toLowerCase());
    const suggestedName = `tachyon_${safeTitle}_${resolution.width}p_${Math.round(startSec)}-${Math.round(endSec)}s.${ext}`;

    let tauriWriter: any = null;
    let customTarget: StreamTarget | undefined = undefined;

    if (useStreaming && isTauri) {
      try {
        tauriWriter = await createSaveVideoWriter(suggestedName, ext);
        if (!tauriWriter) {
          setIsRendering(false);
          return;
        }
        customTarget = new StreamTarget(tauriWriter.writable);
      } catch (e: any) {
        setIsRendering(false);
        setError(`Error preparando archivo nativo de salida: ${e?.message || e}`);
        return;
      }
    }

    try {
      const res = await VideoExporter.exportVideo(engine, renderer, profile, session.points, {
        mode,
        startSec,
        endSec,
        fps,
        width: resolution.width,
        height: resolution.height,
        bitrate,
        videoSourceElement: hiddenVideoRef.current,
        videoBlob: session.videoBlob,
        customSource: session.videoSource,
        customTarget,
        useFileSystemAccess: useStreaming && !isTauri && hasFSA,
        onProgress: setProgress,
        onWarning: (w) => {
          setWarnings((prev) => [...prev, w]);
          if (w.type === 'seek_fallback') {
            setUsedSeekFallback(true);
          }
        },
        cancellationToken: cancellationTokenRef.current,
      });

      if (tauriWriter) {
        await tauriWriter.close();
      }

      if (res.blob) {
        setOutputBlob(res.blob);
      }
      setFileSavedDirectly(res.fileSavedDirectly);
      if (res.audioWarning) {
        setResultAudioWarning(res.audioWarning);
      }
      if (res.usedSeekFallback) {
        setUsedSeekFallback(true);
      }
    } catch (err: unknown) {
      if (tauriWriter) {
        try { await tauriWriter.abort(); } catch (_) {}
      }
      if (err instanceof Error && err.message.includes('cancelada')) {
        setProgress(null);
      } else {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Error desconocido durante el renderizado.');
      }
    } finally {
      setIsRendering(false);
    }
  };

  const handleCancel = () => {
    cancellationTokenRef.current.isCancelled = true;
    setIsRendering(false);
  };

  const handleDownloadBlob = () => {
    if (!outputBlob) return;
    const isWebm = mode === 'webm_transparent';
    const ext = isWebm ? 'webm' : 'mp4';
    const url = URL.createObjectURL(outputBlob);
    const safeTitle = sanitizeFilename(session.title.toLowerCase());
    const a = document.createElement('a');
    a.href = url;
    a.download = `tachyon_${safeTitle}_${resolution.width}p_${Math.round(startSec)}-${Math.round(endSec)}s.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      {/* Elemento de vídeo oculto para búsqueda de fotogramas en segundo plano */}
      {session.hasVideo && session.videoUrl && (
        <video
          ref={hiddenVideoRef}
          src={session.videoUrl}
          playsInline
          muted
          className="hidden"
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.duration && isFinite(v.duration) && v.duration > 0) {
              const dur = Math.round(v.duration * 10) / 10;
              setVideoDuration(dur);
              setEndSec((prevEnd) => {
                // Si endSec aún estaba por defecto al total de la sesión (ej. 672s o 1345s)
                // y el vídeo dura 6s, ajustarlo automáticamente a la duración real del vídeo.
                if (prevEnd >= duration || prevEnd > dur) {
                  return dur;
                }
                return prevEnd;
              });
            }
          }}
        />
      )}

      <div className="bg-[#13181E] border border-[#2C3947] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-[#2C3947] flex items-center justify-between bg-[#1A222B]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#090C0E] border border-[#2C3947] flex items-center justify-center text-[#00E676]">
              <Cpu className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F0F4F8] flex items-center gap-2">
                <span>Exportar y Renderizar Vídeo (WebCodecs)</span>
                {usedSeekFallback && (
                  <span className="text-[10px] bg-[#FFB300]/20 text-[#FFB300] border border-[#FFB300]/40 px-2 py-0.5 rounded-full font-bold">
                    Precisión estándar
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#8B9CB0]">
                Aceleración por hardware en el navegador. Sin servidores ni marcas de agua.
              </p>
            </div>
          </div>
          {!isRendering && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Contenido principal */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs font-mono">
          {!hasWebCodecs && (
            <div className="p-3 bg-[#FF1744]/15 border border-[#FF1744]/40 rounded-xl text-[#FF1744] flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Navegador no compatible con WebCodecs</span>
                Tu navegador no tiene la API VideoEncoder activa. Se recomienda Google Chrome o
                Microsoft Edge actualizados para procesar vídeo en local.
              </div>
            </div>
          )}

          {/* Estado de renderizado en progreso */}
          {isRendering && progress && (
            <div className="bg-[#1A222B] border border-[#2C3947] rounded-xl p-5 space-y-3 animate-fadeIn">
              <div className="flex justify-between items-center">
                <span className="text-[#00E5FF] font-bold text-sm flex items-center gap-2">
                  <Film className="w-4 h-4 animate-spin" />
                  {progress.status}
                </span>
                <span className="text-lg font-black text-[#00E676]">{progress.percent}%</span>
              </div>

              {/* Barra de progreso visual */}
              <div className="h-3 w-full bg-[#090C0E] rounded-full overflow-hidden border border-[#2C3947] p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#00E676] to-[#00E5FF] rounded-full transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              {/* Métricas de rendimiento en vivo */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-[#8B9CB0] text-center">
                <div className="bg-[#090C0E] p-2 rounded border border-[#2C3947]/70">
                  <span className="block text-[10px]">Fotogramas:</span>
                  <span className="text-[#F0F4F8] font-bold">
                    {progress.currentFrame} / {progress.totalFrames}
                  </span>
                </div>
                <div className="bg-[#090C0E] p-2 rounded border border-[#2C3947]/70">
                  <span className="block text-[10px]">Velocidad Real:</span>
                  <span className="text-[#00E676] font-bold">{progress.fpsEncoding} FPS</span>
                </div>
                <div className="bg-[#090C0E] p-2 rounded border border-[#2C3947]/70">
                  <span className="block text-[10px]">Tiempo Restante:</span>
                  <span className="text-[#FFB300] font-bold">{progress.etaSec}s</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF1744]/20 hover:bg-[#FF1744]/30 text-[#FF1744] border border-[#FF1744]/40 font-bold transition-colors cursor-pointer"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Cancelar Render</span>
                </button>
              </div>
            </div>
          )}

          {/* Resultado exitoso */}
          {!isRendering && (outputBlob || fileSavedDirectly) && (
            <div className="bg-[#00E676]/10 border border-[#00E676]/40 rounded-xl p-5 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 text-[#00E676] text-sm font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>¡Vídeo renderizado con éxito!</span>
              </div>

              <p className="text-[#8B9CB0] text-xs">
                {fileSavedDirectly
                  ? 'El archivo ha sido guardado por streaming directamente en la ubicación que elegiste en tu disco.'
                  : 'El vídeo ha sido generado en memoria listo para ser descargado a tu carpeta.'}
              </p>

              {resultAudioWarning && (
                <div className="p-3 bg-[#FFB300]/15 border border-[#FFB300]/40 rounded-xl text-[#FFB300] flex items-start gap-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Nota de pista de audio:</strong>
                    <span>{resultAudioWarning}</span>
                  </div>
                </div>
              )}

              {!fileSavedDirectly && outputBlob && (
                <button
                  onClick={handleDownloadBlob}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] font-bold shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    Descargar archivo ({mode === 'webm_telemetry' || mode === 'webm_transparent' ? '.webm' : '.mp4'})
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Advertencias visibles activas */}
          {warnings.length > 0 && !outputBlob && !fileSavedDirectly && (
            <div className="space-y-2">
              {warnings.map((w, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#FFB300]/15 border border-[#FFB300]/40 rounded-xl text-[#FFB300] flex items-start gap-2.5 text-xs animate-fadeIn"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">
                      {w.type === 'seek_fallback' ? 'Precisión de vídeo:' : 'Aviso de Audio:'}
                    </strong>
                    <span>{w.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-[#FF1744]/15 border border-[#FF1744]/40 rounded-xl text-[#FF1744] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Formulario de configuración (si no está renderizando) */}
          {!isRendering && !outputBlob && !fileSavedDirectly && (
            <div className="space-y-4">
              {/* 1. Modo de Exportación */}
              <div>
                <label className="block text-[#8B9CB0] uppercase mb-1.5 font-bold">
                  1. Formato y Modo de Salida:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Opción 1: Vídeo Completo (Cámara + Relojes) */}
                  <div
                    onClick={() => {
                      if (session.hasVideo) setMode('mp4_combined');
                    }}
                    className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                      !session.hasVideo
                        ? 'opacity-40 cursor-not-allowed bg-[#090C0E] border-[#2C3947]'
                        : mode === 'mp4_combined'
                        ? 'bg-[#1A222B] border-[#00E676] shadow-sm cursor-pointer'
                        : 'bg-[#090C0E] border-[#2C3947] hover:border-[#3D4F63] cursor-pointer'
                    }`}
                  >
                    <Film className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[#F0F4F8] font-bold block">Vídeo Completo MP4</span>
                      <span className="text-[#8B9CB0] text-[11px] block mt-0.5">
                        {session.hasVideo
                          ? 'Vídeo de la cámara con los instrumentos incrustados (H.264).'
                          : 'Requiere vídeo en la sesión para este modo.'}
                      </span>
                    </div>
                  </div>

                  {/* Opción 2: Solo Telemetría Fondo Oscuro (Modo Pantalla / Screen) */}
                  <div
                    onClick={() => setMode('mp4_telemetry_only')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      mode === 'mp4_telemetry_only'
                        ? 'bg-[#1A222B] border-[#00E676] shadow-sm'
                        : 'bg-[#090C0E] border-[#2C3947] hover:border-[#3D4F63]'
                    }`}
                  >
                    <Gauge className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[#F0F4F8] font-bold block">Solo Telemetría (Fondo Negro MP4)</span>
                      <span className="text-[#8B9CB0] text-[11px] block mt-0.5">
                        En Premiere o DaVinci usa el modo de fusión "Pantalla" (Screen) para transparencia.
                      </span>
                    </div>
                  </div>

                  {/* Opción 3: Solo Telemetría Croma Verde */}
                  <div
                    onClick={() => setMode('mp4_chroma_green')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      mode === 'mp4_chroma_green'
                        ? 'bg-[#1A222B] border-[#00E676] shadow-sm'
                        : 'bg-[#090C0E] border-[#2C3947] hover:border-[#3D4F63]'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[#F0F4F8] font-bold block">Solo Telemetría (Croma Verde MP4)</span>
                      <span className="text-[#8B9CB0] text-[11px] block mt-0.5">
                        Fondo verde #00FF00 para eliminarlo en 1 clic con "Ultra Key" o croma.
                      </span>
                    </div>
                  </div>

                  {/* Opción 4: Formato WebM VP9 */}
                  <div
                    onClick={() => setMode('webm_telemetry')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      mode === 'webm_telemetry' || mode === 'webm_transparent'
                        ? 'bg-[#1A222B] border-[#00E5FF] shadow-sm'
                        : 'bg-[#090C0E] border-[#2C3947] hover:border-[#3D4F63]'
                    }`}
                  >
                    <Cpu className="w-4 h-4 text-[#00E5FF] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[#F0F4F8] font-bold block">Solo Telemetría WebM (VP9)</span>
                      <span className="text-[#8B9CB0] text-[11px] block mt-0.5">
                        Formato contenedor WebM con códec VP9 compatible para web y navegadores.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Selección de Tramo */}
              <div className="bg-[#1A222B] p-3.5 rounded-xl border border-[#2C3947] space-y-2.5">
                <div className="flex justify-between items-center text-[#8B9CB0]">
                  <span className="font-bold flex items-center gap-1.5 uppercase">
                    <Clock className="w-3.5 h-3.5 text-[#00E5FF]" />
                    2. Selección de Tramo (Inicio y Fin):
                  </span>
                  <span className="text-[#00E676] font-bold">
                    Duración: {formatDurationHuman(endSec - startSec)} ({(endSec - startSec).toFixed(1)}s)
                  </span>
                </div>

                {/* Si se abrió desde un punto concreto del reproductor, botón rápido */}
                {currentTime !== undefined && (
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#090C0E] p-2 rounded-lg border border-[#2C3947]/70 text-xs font-mono">
                    <span className="text-[#8B9CB0]">
                      Momento actual del reproductor:{' '}
                      <strong className="text-[#00E5FF] font-bold">{formatTimeMinutes(currentTime, true)}</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateStartSec(currentTime)}
                        className="px-2 py-0.5 rounded bg-[#1A222B] hover:bg-[#2C3947] text-[#00E5FF] border border-[#00E5FF]/40 text-[11px] font-sans font-semibold cursor-pointer transition-colors"
                      >
                        Establecer como Inicio
                      </button>
                      <button
                        type="button"
                        onClick={() => updateEndSec(currentTime)}
                        className="px-2 py-0.5 rounded bg-[#1A222B] hover:bg-[#2C3947] text-[#00E676] border border-[#00E676]/40 text-[11px] font-sans font-semibold cursor-pointer transition-colors"
                      >
                        Establecer como Fin
                      </button>
                    </div>
                  </div>
                )}

                {/* Botones de ajuste rápido de tramo */}
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {videoDuration && (
                    <button
                      type="button"
                      onClick={() => {
                        updateStartSec(0);
                        updateEndSec(videoDuration);
                      }}
                      className="px-2.5 py-1 rounded bg-[#090C0E] hover:bg-[#2C3947] text-[#00E5FF] border border-[#00E5FF]/40 transition-colors cursor-pointer"
                    >
                      🎬 Vídeo completo (00:00 - {formatTimeMinutes(videoDuration)})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      updateStartSec(0);
                      updateEndSec(duration);
                    }}
                    className="px-2.5 py-1 rounded bg-[#090C0E] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors cursor-pointer"
                  >
                    📊 Toda la telemetría (00:00 - {formatTimeMinutes(duration)})
                  </button>
                  {duration > 15 && (
                    <button
                      type="button"
                      onClick={() => {
                        updateStartSec(0);
                        updateEndSec(Math.min(15, duration));
                      }}
                      className="px-2.5 py-1 rounded bg-[#090C0E] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors cursor-pointer"
                    >
                      ⏱️ 15s
                    </button>
                  )}
                  {duration > 30 && (
                    <button
                      type="button"
                      onClick={() => {
                        updateStartSec(0);
                        updateEndSec(Math.min(30, duration));
                      }}
                      className="px-2.5 py-1 rounded bg-[#090C0E] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors cursor-pointer"
                    >
                      ⏱️ 30s
                    </button>
                  )}
                  {duration > 60 && (
                    <button
                      type="button"
                      onClick={() => {
                        updateStartSec(0);
                        updateEndSec(Math.min(60, duration));
                      }}
                      className="px-2.5 py-1 rounded bg-[#090C0E] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors cursor-pointer"
                    >
                      ⏱️ 1 min
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[#8B9CB0] text-[11px] font-semibold">
                        Minuto Inicial (t_inicio):
                      </label>
                      {currentTime !== undefined && (
                        <button
                          type="button"
                          onClick={() => updateStartSec(currentTime)}
                          className="text-[10px] text-[#00E5FF] hover:underline cursor-pointer"
                          title="Poner en el momento actual del vídeo"
                        >
                          Momento actual
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="mm:ss (ej. 01:07)"
                      value={startInputText}
                      onChange={handleStartTextChange}
                      onBlur={handleStartTextBlur}
                      className="w-full bg-[#090C0E] border border-[#2C3947] focus:border-[#00E5FF] rounded px-2.5 py-1.5 text-[#00E5FF] font-mono text-sm outline-none transition-colors"
                    />
                    <span className="block text-[10px] text-[#8B9CB0] mt-0.5 font-mono">
                      {startSec.toFixed(1)} segundos ({formatTimeMinutes(startSec)})
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[#8B9CB0] text-[11px] font-semibold">
                        Minuto Final (t_fin):
                      </label>
                      {currentTime !== undefined && (
                        <button
                          type="button"
                          onClick={() => updateEndSec(currentTime)}
                          className="text-[10px] text-[#00E676] hover:underline cursor-pointer"
                          title="Poner en el momento actual del vídeo"
                        >
                          Momento actual
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="mm:ss (ej. 14:02)"
                      value={endInputText}
                      onChange={handleEndTextChange}
                      onBlur={handleEndTextBlur}
                      className="w-full bg-[#090C0E] border border-[#2C3947] focus:border-[#00E676] rounded px-2.5 py-1.5 text-[#00E676] font-mono text-sm outline-none transition-colors"
                    />
                    <span className="block text-[10px] text-[#8B9CB0] mt-0.5 font-mono">
                      {endSec.toFixed(1)} segundos ({formatTimeMinutes(endSec)})
                    </span>
                  </div>
                </div>

                {/* Estimación de fotogramas y tiempo */}
                <div className="flex items-center justify-between text-[11px] text-[#8B9CB0] bg-[#090C0E] p-2.5 rounded-lg border border-[#2C3947]/70">
                  <span>
                    Total a codificar:{' '}
                    <strong className="text-[#00E5FF]">
                      {formatDurationHuman(endSec - startSec)} ({Math.max(1, Math.round((endSec - startSec) * fps))} fotogramas a {fps} FPS)
                    </strong>
                  </span>
                  <span>
                    Tiempo estimado:{' '}
                    <strong className="text-[#00E676]">
                      ~{Math.max(1, Math.round(((endSec - startSec) * fps) / (fps === 60 ? 12 : 18)))} segundos
                    </strong>
                  </span>
                </div>
              </div>

              {/* 3. Parámetros de Calidad y Resolución */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#8B9CB0] mb-1 font-bold">Resolución:</label>
                  <select
                    value={`${resolution.width}x${resolution.height}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number);
                      setResolution({ width: w, height: h });
                    }}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2.5 py-1.5 text-[#F0F4F8]"
                  >
                    <option value="1280x720">720p HD</option>
                    <option value="1920x1080">1080p Full HD</option>
                    <option value="2560x1440">2K QHD (2560x1440)</option>
                    <option value="3840x2160">4K Ultra HD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#8B9CB0] mb-1 font-bold">Tasa de Cuadros (FPS):</label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value))}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2.5 py-1.5 text-[#F0F4F8]"
                  >
                    <option value={30}>30 FPS (Recomendado - 2x más rápido)</option>
                    <option value={60}>60 FPS (Ultra Suave)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#8B9CB0] mb-1 font-bold">Tasa de Bits (Bitrate):</label>
                  <select
                    value={bitrate}
                    onChange={(e) => setBitrate(parseInt(e.target.value))}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2.5 py-1.5 text-[#F0F4F8]"
                  >
                    <option value={8_000_000}>8 Mbps (Rápido)</option>
                    <option value={14_000_000}>14 Mbps (Alta Calidad)</option>
                    <option value={20_000_000}>20 Mbps (Competición)</option>
                  </select>
                </div>
              </div>

              {/* 4. Streaming a disco */}
              {supportsStreaming && (
                <div className="bg-[#1A222B] p-3 rounded-xl border border-[#2C3947] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-[#00E5FF]" />
                    <div>
                      <span className="text-[#F0F4F8] font-bold block">
                        Streaming directo a disco ({isTauri ? 'Nativo Rust' : 'File System Access'})
                      </span>
                      <span className="text-[#8B9CB0] text-[11px]">
                        Escribe los fotogramas directamente al almacenamiento evitando acumular datos en RAM.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={useStreaming}
                    onChange={(e) => setUseStreaming(e.target.checked)}
                    className="w-4 h-4 accent-[#00E676] cursor-pointer"
                  />
                </div>
              )}

              {/* 5. Aceleración por Hardware / FFmpeg Sidecar */}
              {ffmpegCaps?.available && (
                <div className="bg-[#1A222B] p-3 rounded-xl border border-[#00E676]/30 flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <Zap className="w-4 h-4 text-[#00E676]" />
                    <div>
                      <span className="text-[#F0F4F8] font-bold block flex items-center gap-2">
                        <span>Sidecar FFmpeg Activo</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00E676]/20 text-[#00E676] font-mono font-bold">
                          {ffmpegCaps.recommended_encoder || 'GPU/CPU'}
                        </span>
                      </span>
                      <span className="text-[#8B9CB0] text-[11px]">
                        {ffmpegCaps.has_nvenc
                          ? 'Acelerador NVIDIA NVENC detectado para codificación por hardware.'
                          : ffmpegCaps.has_qsv
                          ? 'Acelerador Intel QuickSync (QSV) detectado para codificación por hardware.'
                          : ffmpegCaps.has_amf
                          ? 'Acelerador AMD AMF detectado para codificación por hardware.'
                          : 'Procesamiento complementario FFmpeg disponible para remux y audio.'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#2C3947] bg-[#1A222B] flex items-center justify-end gap-3 font-mono">
          {!isRendering && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8B9CB0] hover:text-[#F0F4F8] hover:bg-[#2C3947] transition-colors"
            >
              {outputBlob || fileSavedDirectly ? 'Cerrar' : 'Cancelar'}
            </button>
          )}

          {!isRendering && !outputBlob && !fileSavedDirectly && (
            <button
              onClick={handleStartRender}
              disabled={!hasWebCodecs}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all cursor-pointer disabled:opacity-50"
            >
              <Cpu className="w-4 h-4 stroke-[2.5]" />
              <span>Iniciar Renderizado</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
