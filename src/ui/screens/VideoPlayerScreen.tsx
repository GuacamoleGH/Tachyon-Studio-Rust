import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Gauge,
  Film,
  Cpu,
  Upload,
  Zap,
} from 'lucide-react';
import { SessionBundle } from '../../core/model/session';
import { TimeEngine } from '../../core/telemetry/timeEngine';
import { OverlayRenderer } from '../../engine/canvas/overlayRenderer';
import { VehicleProfile, deriveProfileFromAppConfig, PRESET_GASOLINA_ESTANDAR, loadProfileFromStorage } from '../../core/profile/vehicleProfile';
import { OverlayTemplate, loadTemplateFromStorage as loadStoredTemplate, TEMPLATE_MYCHRON_5 } from '../../core/templates/templateModel';
import { RenderModal } from './RenderModal';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import {
  isTauriEnvironment,
  openVideoDialog,
  createTauriFileSource,
  extractNativeZipVideoToTemp,
  NativeFileInfo,
} from '../../core/fs/fileSystemAdapter';

interface VideoPlayerScreenProps {
  session: SessionBundle;
  profile?: VehicleProfile;
  template?: OverlayTemplate;
}

export const VideoPlayerScreen: React.FC<VideoPlayerScreenProps> = ({ session, profile: propProfile, template: propTemplate }) => {
  const profile = useMemo(() => {
    if (propProfile) return propProfile;
    const stored = loadProfileFromStorage();
    if (stored) return stored;
    if (session.vehicleConfigWithOrigin) {
      return deriveProfileFromAppConfig(session.vehicleConfigWithOrigin.config);
    }
    return PRESET_GASOLINA_ESTANDAR;
  }, [propProfile, session]);

  const engine = useMemo(() => TimeEngine.fromBundle(session), [session]);

  const overlayRenderer = useMemo(() => {
    const tpl = propTemplate || loadStoredTemplate() || TEMPLATE_MYCHRON_5;
    const r = new OverlayRenderer(tpl.resolution.width, tpl.resolution.height);
    r.applyTemplate(tpl);
    return r;
  }, [propTemplate]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const [videoUrl, setVideoUrl] = useState<string | undefined>(session.videoUrl);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(
    session.videoLoadWarning || null
  );

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0.0);
  const [duration, setDuration] = useState<number>(session.durationSec || 90.0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(1.0);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  const handleAutoExtractVideo = useCallback(async () => {
    if (!session.videoZipPath || !session.videoFileName) return;
    setIsExtracting(true);
    setVideoLoadError('Extrayendo vídeo de la sesión a disco temporal (%TEMP%) sin consumo de RAM...');
    try {
      const tempPath = await extractNativeZipVideoToTemp(session.videoZipPath, session.videoFileName);
      const info = await invoke<NativeFileInfo>('get_file_info', { path: tempPath });
      const tauriSource = createTauriFileSource(tempPath, info.size);
      const assetUrl = convertFileSrc(tempPath);

      session.videoPath = tempPath;
      session.videoSource = tauriSource;
      session.videoUrl = assetUrl;
      session.hasVideo = true;
      session.videoOversized = false;
      session.videoLoadWarning = undefined;
      session.videoCompressedInZip = false;

      setVideoUrl(assetUrl);
      setVideoLoadError(null);
      if (videoRef.current) {
        videoRef.current.src = assetUrl;
        videoRef.current.load();
      }
    } catch (err: any) {
      console.error('Error al extraer vídeo del ZIP:', err);
      setVideoLoadError(`No se pudo extraer el vídeo automáticamente: ${err?.message || err}. Puedes vincularlo desde disco.`);
    } finally {
      setIsExtracting(false);
    }
  }, [session]);

  // Si el vídeo está comprimido en el ZIP y estamos en Tauri, intentar auto-extraer de inmediato
  useEffect(() => {
    if (!videoUrl && session.videoCompressedInZip && session.videoZipPath && isTauriEnvironment() && !isExtracting) {
      handleAutoExtractVideo();
    }
  }, [videoUrl, session, isExtracting, handleAutoExtractVideo]);

  // Snapshot actual en currentTime
  const snapshot = useMemo(() => engine.query(currentTime), [engine, currentTime]);

  const handleSelectLocalVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newUrl = URL.createObjectURL(file);
      session.videoUrl = newUrl;
      session.videoBlob = file;
      session.hasVideo = true;
      session.videoFileName = file.name;
      session.videoOversized = false;
      session.videoLoadWarning = undefined;
      setVideoUrl(newUrl);
      setVideoLoadError(null);
      if (videoRef.current) {
        videoRef.current.src = newUrl;
        videoRef.current.load();
      }
    }
  };

  const handleLinkVideoClick = async () => {
    if (isTauriEnvironment()) {
      try {
        const handle = await openVideoDialog();
        if (handle?.path) {
          const tauriSource = createTauriFileSource(handle.path, handle.size);
          const assetUrl = convertFileSrc(handle.path);

          session.videoPath = handle.path;
          session.videoSource = tauriSource;
          session.videoBlob = undefined;
          session.videoFileName = handle.name;
          session.hasVideo = true;
          session.videoOversized = false;
          session.videoLoadWarning = undefined;
          session.videoUrl = assetUrl;

          setVideoUrl(assetUrl);
          setVideoLoadError(null);
          if (videoRef.current) {
            videoRef.current.src = assetUrl;
            videoRef.current.load();
          }
          return;
        } else if (handle?.file) {
          const newUrl = URL.createObjectURL(handle.file);
          session.videoUrl = newUrl;
          session.videoBlob = handle.file;
          session.hasVideo = true;
          session.videoFileName = handle.name;
          session.videoOversized = false;
          session.videoLoadWarning = undefined;
          setVideoUrl(newUrl);
          setVideoLoadError(null);
          if (videoRef.current) {
            videoRef.current.src = newUrl;
            videoRef.current.load();
          }
          return;
        }
      } catch (err) {
        console.warn('Error al abrir diálogo nativo de vídeo:', err);
      }
    }
    videoFileInputRef.current?.click();
  };

  // Actualizar opacidad del renderizador
  useEffect(() => {
    overlayRenderer.opacity = overlayOpacity;
  }, [overlayOpacity, overlayRenderer]);

  // Redibujar el overlay sobre el canvas
  const drawOverlayFrame = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const snap = engine.query(t);
      overlayRenderer.render(ctx, snap, profile, t, session.points);
    },
    [engine, overlayRenderer, profile, session.points]
  );

  // Redibujar cuando cambia currentTime estando pausado
  useEffect(() => {
    if (!isPlaying) {
      drawOverlayFrame(currentTime);
    }
  }, [currentTime, isPlaying, drawOverlayFrame]);

  // Bucle de sincronización de vídeo con requestVideoFrameCallback o requestAnimationFrame
  useEffect(() => {
    let animId: number;
    const video = videoRef.current;

    if (session.hasVideo && video) {
      let isCallbackActive = true;
      let lastReactTimeUpdate = 0;

      const onFrame = () => {
        if (!isCallbackActive) return;
        if (!video.paused && !video.ended) {
          const t = video.currentTime;
          drawOverlayFrame(t);

          // Throttling del estado de React a ~4 Hz para no disparar 60 re-renders
          // de todo el componente por segundo, liberando la CPU para el canvas y vídeo
          const now = performance.now();
          if (now - lastReactTimeUpdate > 250) {
            lastReactTimeUpdate = now;
            setCurrentTime(t);
          }

          if ('requestVideoFrameCallback' in video) {
            (video as any).requestVideoFrameCallback(onFrame);
          } else {
            animId = requestAnimationFrame(onFrame);
          }
        }
      };

      if (isPlaying) {
        if ('requestVideoFrameCallback' in video) {
          (video as any).requestVideoFrameCallback(onFrame);
        } else {
          animId = requestAnimationFrame(onFrame);
        }
      }

      return () => {
        isCallbackActive = false;
        cancelAnimationFrame(animId);
      };
    } else if (isPlaying) {
      // Modo sin vídeo (simulación de tiempo)
      let lastTime = performance.now();
      const interval = setInterval(() => {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        setCurrentTime((prev) => {
          const next = prev + dt * playbackSpeed;
          if (next >= duration) {
            setIsPlaying(false);
            return duration;
          }
          drawOverlayFrame(next);
          return next;
        });
      }, 1000 / 60);

      return () => clearInterval(interval);
    }
  }, [isPlaying, session.hasVideo, duration, playbackSpeed, drawOverlayFrame]);

  // Inicializar dimensiones del vídeo al cargar metadatos
  const handleVideoLoadedMetadata = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      canvas.width = vw;
      canvas.height = vh;
      overlayRenderer.resize(vw, vh);
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration);
      }
      drawOverlayFrame(video.currentTime);
    }
  };

  // Controles de transporte
  const togglePlay = () => {
    const video = videoRef.current;
    if (session.hasVideo && video) {
      if (video.paused) {
        video.play();
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const seekTo = (t: number) => {
    const clamped = Math.max(0, Math.min(duration, t));
    setCurrentTime(clamped);
    const video = videoRef.current;
    if (session.hasVideo && video) {
      video.currentTime = clamped;
    }
    drawOverlayFrame(clamped);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    const video = videoRef.current;
    if (video) {
      video.volume = newVol;
      video.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (isMuted) {
      setIsMuted(false);
      if (video) video.muted = false;
    } else {
      setIsMuted(true);
      if (video) video.muted = true;
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // Atajos de teclado (Espacio = Play/Pause, Flechas = Seek)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekTo(currentTime - (e.shiftKey ? 1.0 : 5.0));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekTo(currentTime + (e.shiftKey ? 1.0 : 5.0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec - Math.floor(sec)) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 animate-fadeIn">
      {/* 1. Barra superior de estado */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#13181E] border border-[#2C3947] rounded-xl px-4 py-2.5 shadow-md">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5 text-[#00E5FF]" />
          <div>
            <span className="text-sm font-bold text-[#F0F4F8]">{session.title}</span>
            <span className="text-xs text-[#8B9CB0] ml-2 font-mono">
              {session.hasVideo ? 'Vídeo original sincronizado (t=0.000s)' : 'Modo sólo telemetría'}
            </span>
          </div>
        </div>

        {/* Alerta de evento activo en el segundo actual */}
        {snapshot.activeEvents.length > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF1744]/15 border border-[#FF1744]/40 text-[#FF1744] text-xs font-mono font-bold animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Corte activo: {snapshot.activeEvents.map((e) => e.title).join(' • ')} (N/D)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-mono text-[#00E676]">
            <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
            <span>Telemetría normal (todos los canales válidos)</span>
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* Vincular vídeo MP4 directo */}
          <input
            ref={videoFileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleSelectLocalVideo}
          />
          <button
            onClick={handleLinkVideoClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#00E5FF] border border-[#00E5FF]/40 transition-colors cursor-pointer"
            title="Vincular archivo de vídeo MP4 directamente desde tu disco (ideal para vídeos pesados de más de 2 GB)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{videoUrl ? 'Cambiar Vídeo' : 'Vincular Vídeo MP4'}</span>
          </button>

          {/* Control de opacidad del overlay */}
          <div className="flex items-center gap-2 text-xs font-mono text-[#8B9CB0]">
            <span>Opacidad:</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              className="w-16 accent-[#00E676] cursor-pointer"
            />
            <span className="text-[#F0F4F8] w-7">{Math.round(overlayOpacity * 100)}%</span>
          </div>

          <button
            onClick={() => {
              if (isPlaying) togglePlay();
              setIsRenderModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] transition-all cursor-pointer shadow-[0_0_12px_rgba(0,230,118,0.25)]"
          >
            <Cpu className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Exportar Vídeo</span>
          </button>
        </div>
      </div>

      {/* 2. Contenedor de Vídeo + Canvas Superpuesto */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-2xl overflow-hidden border border-[#2C3947] shadow-2xl aspect-video flex items-center justify-center select-none group"
      >
        {session.hasVideo && videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            onLoadedMetadata={() => {
              setVideoLoadError(null);
              handleVideoLoadedMetadata();
            }}
            onError={() => {
              console.error('Error al decodificar vídeo en el reproductor:', videoRef.current?.error);
              setVideoLoadError(
                isTauriEnvironment()
                  ? 'No se pudo reproducir el vídeo automáticamente. Puedes vincular el archivo de vídeo MP4 original directamente desde tu disco con el botón de abajo.'
                  : 'El navegador no pudo reproducir el vídeo. Vincula el archivo MP4 original directamente desde tu disco.'
              );
            }}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
            playsInline
            className="w-full h-full object-contain cursor-pointer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-[#090C0E] to-[#13181E] flex flex-col items-center justify-center text-center p-6">
            <Gauge className="w-16 h-16 text-[#00E676]/30 mb-3" />
            <span className="text-base font-bold text-[#F0F4F8]">
              Vista previa sobre lienzo de telemetría
            </span>
            <span className="text-xs text-[#8B9CB0] mt-1 max-w-sm mb-3">
              Esta sesión no incluye pista de vídeo activa o puedes vincular el archivo de vídeo MP4 original.
            </span>
            <button
              onClick={handleLinkVideoClick}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#00E5FF] hover:bg-[#00cce6] text-[#090C0E] transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Vincular archivo video.mp4</span>
            </button>
          </div>
        )}

        {/* Banner de error o aviso de vídeo */}
        {videoLoadError && (
          <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
            <div className={`w-12 h-12 rounded-2xl ${isExtracting ? 'bg-[#00E5FF]/20 border-[#00E5FF]/40 text-[#00E5FF] animate-pulse' : 'bg-[#FF1744]/20 border-[#FF1744]/40 text-[#FF1744]'} border flex items-center justify-center mb-3`}>
              {isExtracting ? <Zap className="w-6 h-6 stroke-[2.2] animate-spin" /> : <AlertTriangle className="w-6 h-6 stroke-[2.2]" />}
            </div>
            <h3 className="text-base font-bold text-[#F0F4F8] mb-1">
              {isExtracting
                ? 'Extrayendo vídeo en segundo plano...'
                : isTauriEnvironment()
                ? 'Vídeo pendiente de vinculación o extracción'
                : 'Vídeo bloqueado por límite de memoria del navegador (> 1.5 GB)'}
            </h3>
            <p className="text-xs text-[#8B9CB0] max-w-md mb-4 leading-relaxed">
              {videoLoadError}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {session.videoCompressedInZip && session.videoZipPath && isTauriEnvironment() && (
                <button
                  onClick={handleAutoExtractVideo}
                  disabled={isExtracting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] shadow-[0_0_20px_rgba(0,230,118,0.35)] transition-all cursor-pointer hover:scale-105 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 stroke-[2.5]" />
                  <span>{isExtracting ? 'Extrayendo a disco temporal...' : '⚡ Extraer vídeo automáticamente'}</span>
                </button>
              )}
              <button
                onClick={handleLinkVideoClick}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#00E5FF] hover:bg-[#00cce6] text-[#090C0E] shadow-[0_0_20px_rgba(0,229,255,0.35)] transition-all cursor-pointer hover:scale-105"
              >
                <Film className="w-4 h-4 stroke-[2.5]" />
                <span>Seleccionar archivo video.mp4 desde tu disco</span>
              </button>
            </div>
          </div>
        )}

        {/* Canvas del Overlay superpuesto exactamente sobre el vídeo */}
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />

        {/* Overlay de pausa en el centro */}
        {!isPlaying && !videoLoadError && (
          <button
            onClick={togglePlay}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[#13181E]/80 backdrop-blur-md border border-[#2C3947] text-[#00E676] flex items-center justify-center shadow-2xl hover:scale-110 transition-all cursor-pointer opacity-85 hover:opacity-100"
          >
            <Play className="w-8 h-8 fill-current ml-1" />
          </button>
        )}
      </div>

      {/* 3. Barra de Control de Transporte y Scrubber */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-4 shadow-lg space-y-3">
        {/* Barra de progreso de tiempo con cortes de sensor visualizados */}
        <div className="space-y-1">
          <div className="relative pt-1">
            <input
              type="range"
              min={0}
              max={duration}
              step={0.033} // ~30 fps step
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="w-full accent-[#00E676] cursor-pointer"
            />

            {/* Eventos de corte dibujados sobre la barra */}
            {session.events.length > 0 && duration > 0 && (
              <div className="h-1.5 w-full bg-[#090C0E] rounded relative overflow-hidden mt-0.5">
                {session.events.map((ev) => {
                  const leftPct = (ev.startSec / duration) * 100;
                  const widthPct = (ev.durationSec / duration) * 100;
                  return (
                    <div
                      key={ev.id}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute top-0 bottom-0 ${
                        ev.type === 'gps_lost' ? 'bg-[#00E5FF]/80' : 'bg-[#FF1744]/80'
                      }`}
                      title={`${ev.title} (${ev.durationSec}s)`}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs font-mono text-[#8B9CB0]">
            <span className="text-[#00E5FF] font-bold">{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Botones de control inferiores */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] transition-all cursor-pointer shadow-[0_0_15px_rgba(0,230,118,0.3)]"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => seekTo(currentTime - 5.0)}
              className="p-2.5 rounded-lg bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors"
              title="-5 segundos"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => seekTo(currentTime + 5.0)}
              className="p-2.5 rounded-lg bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors"
              title="+5 segundos"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={() => seekTo(0.0)}
              className="p-2.5 rounded-lg bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors"
              title="Reiniciar a 0.0s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Selector de velocidad de reproducción */}
            <div className="flex items-center gap-1 bg-[#1A222B] px-2 py-1 rounded-lg border border-[#2C3947] text-xs font-mono ml-2">
              {[0.5, 1.0, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    playbackSpeed === s
                      ? 'bg-[#00E5FF] text-[#090C0E]'
                      : 'text-[#8B9CB0] hover:text-[#F0F4F8]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Control de volumen si hay vídeo */}
            {session.hasVideo && (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-lg bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-[#FF1744]" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-[#00E676]" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20 accent-[#00E676] cursor-pointer"
                />
              </div>
            )}

            {/* Pantalla completa */}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-lg bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors"
              title="Pantalla completa"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Renderizado por WebCodecs */}
      <RenderModal
        isOpen={isRenderModalOpen}
        onClose={() => setIsRenderModalOpen(false)}
        session={session}
        profile={profile}
        renderer={overlayRenderer}
      />
    </div>
  );
};
