import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { SessionBundle } from '../../core/model/session';
import { TimeEngine } from '../../core/telemetry/timeEngine';

interface TimeEngineInspectorProps {
  session: SessionBundle;
}

export const TimeEngineInspector: React.FC<TimeEngineInspectorProps> = ({ session }) => {
  const engine = useMemo(() => TimeEngine.fromBundle(session), [session]);

  const [currentTime, setCurrentTime] = useState<number>(0.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  const minSec = engine.timeRange.minSec;
  const maxSec = engine.timeRange.maxSec;

  // Bucle de reproducción sincronizada para prueba en vivo
  useEffect(() => {
    if (!isPlaying) return;

    let lastTimestamp = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      setCurrentTime((prev) => {
        const next = prev + dt * playbackSpeed;
        if (next > maxSec) {
          setIsPlaying(false);
          return maxSec;
        }
        return next;
      });
    }, 1000 / 30); // 30 fps

    return () => clearInterval(interval);
  }, [isPlaying, maxSec, playbackSpeed]);

  const snapshot = useMemo(() => engine.query(currentTime), [engine, currentTime]);

  const formatSec = (s: number) => `${s >= 0 ? '+' : ''}${s.toFixed(3)}s`;

  return (
    <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-5 animate-fadeIn">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2C3947] pb-3">
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-[#00E5FF]" />
          <div>
            <h2 className="text-base font-bold text-[#F0F4F8]">
              Inspector del Motor de Tiempo e Interpolación en Vivo
            </h2>
            <p className="text-xs text-[#8B9CB0]">
              Sincronización determinista t_video. Desplaza el control para comprobar la
              interpolación y el tratamiento de N/D en huecos y eventos.
            </p>
          </div>
        </div>

        {/* Acceso directo a eventos difíciles */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#8B9CB0] font-mono">Saltar a:</span>
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentTime(0.0);
            }}
            className="px-2 py-1 rounded text-[11px] font-mono bg-[#1A222B] hover:bg-[#2C3947] text-[#00E676] border border-[#2C3947] transition-colors"
          >
            t=0.0s (Inicio vídeo)
          </button>
          {session.events.map((ev) => (
            <button
              key={ev.id}
              onClick={() => {
                setIsPlaying(false);
                setCurrentTime(ev.startSec + 0.5);
              }}
              className="px-2 py-1 rounded text-[11px] font-mono bg-[#1A222B] hover:bg-[#2C3947] text-[#FFB300] border border-[#2C3947] transition-colors"
            >
              {ev.type === 'gps_lost' ? 'Corte GPS (58s)' : 'Corte OBD (30s)'}
            </button>
          ))}
        </div>
      </div>

      {/* Controles de transporte y barra de tiempo */}
      <div className="space-y-3 bg-[#1A222B] p-4 rounded-xl border border-[#2C3947]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] transition-all cursor-pointer shadow-[0_0_12px_rgba(0,230,118,0.25)]"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => setCurrentTime((t) => Math.max(minSec, t - 1.0))}
              className="p-2 rounded-lg bg-[#090C0E] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors"
              title="-1 segundo"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentTime((t) => Math.min(maxSec, t + 1.0))}
              className="p-2 rounded-lg bg-[#090C0E] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors"
              title="+1 segundo"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentTime(0.0);
              }}
              className="p-2 rounded-lg bg-[#090C0E] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors"
              title="Reiniciar a t=0.0s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Selector de velocidad */}
            <div className="flex items-center gap-1 bg-[#090C0E] px-2 py-1 rounded-lg border border-[#2C3947] text-xs font-mono ml-2">
              <span className="text-[#8B9CB0]">Vel:</span>
              {[0.5, 1.0, 2.0].map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    playbackSpeed === s
                      ? 'bg-[#00E5FF] text-[#090C0E] font-bold'
                      : 'text-[#8B9CB0] hover:text-[#F0F4F8]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#8B9CB0]">Tiempo actual:</span>
            <div className="px-3 py-1 bg-[#090C0E] border border-[#00E5FF]/40 rounded-lg text-lg font-mono font-black text-[#00E5FF]">
              {formatSec(currentTime)}
            </div>
          </div>
        </div>

        {/* Deslizador con marcadores visuales de eventos */}
        <div className="space-y-1 relative pt-2">
          <input
            type="range"
            min={minSec}
            max={maxSec}
            step={0.01}
            value={currentTime}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentTime(parseFloat(e.target.value));
            }}
            className="w-full accent-[#00E676] cursor-pointer"
          />

          <div className="flex justify-between text-[10px] font-mono text-[#8B9CB0]">
            <span>{formatSec(minSec)} (Inicio sesión)</span>
            <span className="text-[#00E676] font-bold">t = 0.000s (Fotograma 0 vídeo)</span>
            <span>{formatSec(maxSec)} (Fin sesión)</span>
          </div>

          {/* Marcadores de eventos en la barra */}
          {session.events.length > 0 && maxSec > minSec && (
            <div className="h-2 w-full bg-[#090C0E] rounded relative overflow-hidden mt-1">
              {session.events.map((ev) => {
                const totalDur = maxSec - minSec;
                const leftPct = ((ev.startSec - minSec) / totalDur) * 100;
                const widthPct = (ev.durationSec / totalDur) * 100;
                return (
                  <div
                    key={ev.id}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    className={`absolute top-0 bottom-0 ${
                      ev.type === 'gps_lost' ? 'bg-[#00E5FF]/60' : 'bg-[#FF1744]/60'
                    }`}
                    title={`${ev.title} (${ev.durationSec}s)`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Banner de eventos activos en el tiempo actual */}
      {snapshot.activeEvents.length > 0 && (
        <div className="p-3 bg-[#FF1744]/15 border border-[#FF1744]/40 rounded-lg flex items-center gap-3 text-xs text-[#FF1744] animate-pulse">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-bold">
              Evento de corte activo en t = {currentTime.toFixed(2)}s:
            </span>{' '}
            {snapshot.activeEvents.map((e) => e.title).join(' • ')} (datos simulados o bloqueados a N/D)
          </div>
        </div>
      )}

      {/* Tarjetas de valores en vivo en el instante t */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Velocidad */}
        <div className="bg-[#1A222B] border border-[#2C3947] rounded-lg p-3">
          <span className="text-[10px] uppercase font-mono text-[#8B9CB0] block">Velocidad GPS</span>
          <div className="text-xl font-black font-mono mt-1">
            {snapshot.speedAvailable && snapshot.speedKmh !== null ? (
              <span className="text-[#00E5FF]">{snapshot.speedKmh.toFixed(1)} km/h</span>
            ) : (
              <span className="text-[#4A5568]">N/D</span>
            )}
          </div>
          <span
            className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded inline-block mt-1 ${
              snapshot.speedAvailable ? 'bg-[#00E5FF]/10 text-[#00E5FF]' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {snapshot.signals.gps_speed_kmh.status}
          </span>
        </div>

        {/* RPM */}
        <div className="bg-[#1A222B] border border-[#2C3947] rounded-lg p-3">
          <span className="text-[10px] uppercase font-mono text-[#8B9CB0] block">Tacómetro RPM</span>
          <div className="text-xl font-black font-mono mt-1">
            {snapshot.rpmAvailable && snapshot.rpm !== null ? (
              <span className="text-[#00E676]">{Math.round(snapshot.rpm)} RPM</span>
            ) : (
              <span className="text-[#4A5568]">N/D</span>
            )}
          </div>
          <span
            className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded inline-block mt-1 ${
              snapshot.rpmAvailable ? 'bg-[#00E676]/10 text-[#00E676]' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {snapshot.signals.engine_rpm.status}
          </span>
        </div>

        {/* Pedal */}
        <div className="bg-[#1A222B] border border-[#2C3947] rounded-lg p-3">
          <span className="text-[10px] uppercase font-mono text-[#8B9CB0] block">Acelerador / Pedal</span>
          <div className="text-xl font-black font-mono mt-1">
            {snapshot.throttleAvailable && snapshot.throttlePct !== null ? (
              <span className="text-[#F0F4F8]">{snapshot.throttlePct.toFixed(1)}%</span>
            ) : (
              <span className="text-[#4A5568]">N/D</span>
            )}
          </div>
          <span
            className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded inline-block mt-1 ${
              snapshot.throttleAvailable ? 'bg-[#00E676]/10 text-[#00E676]' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {snapshot.signals.throttle_pct.status}
          </span>
        </div>

        {/* Lateral G */}
        <div className="bg-[#1A222B] border border-[#2C3947] rounded-lg p-3">
          <span className="text-[10px] uppercase font-mono text-[#8B9CB0] block">Lateral G (IMU)</span>
          <div className="text-xl font-black font-mono mt-1">
            {snapshot.lateralGAvailable && snapshot.lateralG !== null ? (
              <span className="text-[#FFB300]">{snapshot.lateralG.toFixed(3)} G</span>
            ) : (
              <span className="text-[#4A5568]">N/D</span>
            )}
          </div>
          <span className="text-[9px] font-mono text-[#8B9CB0] block mt-1">Inercial sensor</span>
        </div>

        {/* Longitudinal G (IMU vs GPS) */}
        <div className="bg-[#1A222B] border border-[#2C3947] rounded-lg p-3">
          <span className="text-[10px] uppercase font-mono text-[#8B9CB0] block">Long. G (IMU)</span>
          <div className="text-xl font-black font-mono mt-1">
            {snapshot.longitudinalGAvailable && snapshot.longitudinalG !== null ? (
              <span className="text-[#00E676]">{snapshot.longitudinalG.toFixed(3)} G</span>
            ) : (
              <span className="text-[#4A5568]">N/D</span>
            )}
          </div>
          <span className="text-[9px] font-mono text-[#8B9CB0] block mt-1">
            GPS dv/dt: {snapshot.derivedGpsLongGAvailable && snapshot.derivedGpsLongG !== null ? `${snapshot.derivedGpsLongG.toFixed(2)}G` : 'N/D'}
          </span>
        </div>

        {/* Rumbo */}
        <div className="bg-[#1A222B] border border-[#2C3947] rounded-lg p-3">
          <span className="text-[10px] uppercase font-mono text-[#8B9CB0] block">Rumbo GPS</span>
          <div className="text-xl font-black font-mono mt-1">
            {snapshot.bearingAvailable && snapshot.bearingDeg !== null ? (
              <span className="text-[#F0F4F8]">{snapshot.bearingDeg.toFixed(1)}°</span>
            ) : (
              <span className="text-[#4A5568]">N/D</span>
            )}
          </div>
          <span className="text-[9px] font-mono text-[#8B9CB0] block mt-1">
            {snapshot.gpsAvailable ? `${snapshot.latitude?.toFixed(4)}, ${snapshot.longitude?.toFixed(4)}` : 'Sin GPS'}
          </span>
        </div>
      </div>
    </div>
  );
};
