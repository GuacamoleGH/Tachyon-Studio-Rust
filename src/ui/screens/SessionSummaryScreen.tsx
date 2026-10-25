import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  Film,
  Gauge,
  SlidersHorizontal,
  WifiOff,
  Zap,
} from 'lucide-react';
import { SessionBundle } from '../../core/model/session';
import { StandardSignalKey } from '../../core/model/telemetry';
import { ColumnMapperModal } from '../components/ColumnMapperModal';
import { TimeEngineInspector } from '../components/TimeEngineInspector';
import { parseTelemetryCsv } from '../../core/csv/csvParser';

interface SessionSummaryScreenProps {
  session: SessionBundle;
  onUpdateSession: (updated: SessionBundle) => void;
}

export const SessionSummaryScreen: React.FC<SessionSummaryScreenProps> = ({
  session,
  onUpdateSession,
}) => {
  const [isMapperOpen, setIsMapperOpen] = useState(false);

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    const tenths = Math.floor((totalSec - Math.floor(totalSec)) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
  };

  const handleSaveMapping = (newMapping: Partial<Record<StandardSignalKey, string>>) => {
    // Re-parsear el CSV con el nuevo mapeo
    const reparseResult = parseTelemetryCsv(session.rawCsvText, {
      customSignalToHeader: newMapping,
    });

    onUpdateSession({
      ...session,
      points: reparseResult.points,
      timeRange: reparseResult.timeRange,
      totalPoints: reparseResult.points.length,
      csvFormat: 'custom_mapped',
    });
  };

  const vc = session.vehicleConfigWithOrigin.config;
  const vcSource = session.vehicleConfigWithOrigin.source;

  // Extraer cabeceras del CSV
  const csvHeaders = session.rawCsvText.split(/\r?\n/)[0]?.split(',').map((h) => h.trim()) || [];
  const currentSignalToHeader: Partial<Record<StandardSignalKey, string>> = {};
  for (const [sigKey, stat] of Object.entries(session.signalsStats)) {
    if (stat.foundInCsv) {
      currentSignalToHeader[sigKey as StandardSignalKey] = sigKey;
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* 1. Header con métricas principales */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#00E676] via-[#00E5FF] to-[#FF1744]" />

        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-[#F0F4F8] tracking-wide">{session.title}</h1>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  session.csvFormat === 'official_wide'
                    ? 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30'
                    : session.csvFormat === 'sparse_multisource'
                    ? 'bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/30'
                    : 'bg-[#FFB300]/10 text-[#FFB300] border-[#FFB300]/30'
                }`}
              >
                {session.csvFormat === 'official_wide'
                  ? 'Formato Oficial Android'
                  : session.csvFormat === 'sparse_multisource'
                  ? 'Formato Disperso (Sintético)'
                  : 'Mapeo Personalizado'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#8B9CB0] mt-1 font-mono">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#00E5FF]" />
                {new Date(session.startTimeIso).toLocaleString()}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#00E676]" />
                {session.totalPoints.toLocaleString()} muestras
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-[#FFB300]" />
                {session.hasVideo ? 'Vídeo incluido (video.mp4)' : 'Sin archivo de vídeo'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsMapperOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#00E5FF] border border-[#2C3947] transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Ajustar Mapeo de Columnas</span>
          </button>
        </div>

        {/* Tarjetas de métricas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-[#1A222B] border border-[#2C3947]/70 rounded-lg p-3">
            <span className="text-[11px] font-mono text-[#8B9CB0] uppercase tracking-wider block">
              Duración
            </span>
            <span className="text-xl font-bold font-mono text-[#F0F4F8] mt-0.5 block">
              {formatDuration(session.durationSec)}
            </span>
          </div>

          <div className="bg-[#1A222B] border border-[#2C3947]/70 rounded-lg p-3">
            <span className="text-[11px] font-mono text-[#8B9CB0] uppercase tracking-wider block">
              Distancia
            </span>
            <span className="text-xl font-bold font-mono text-[#00E676] mt-0.5 block">
              {(session.totalDistanceMeters / 1000).toFixed(2)}{' '}
              <span className="text-xs text-[#8B9CB0]">km</span>
            </span>
          </div>

          <div className="bg-[#1A222B] border border-[#2C3947]/70 rounded-lg p-3">
            <span className="text-[11px] font-mono text-[#8B9CB0] uppercase tracking-wider block">
              Vel. Máxima
            </span>
            <span className="text-xl font-bold font-mono text-[#00E5FF] mt-0.5 block">
              {session.maxSpeedKmh.toFixed(1)}{' '}
              <span className="text-xs text-[#8B9CB0]">km/h</span>
            </span>
          </div>

          <div className="bg-[#1A222B] border border-[#2C3947]/70 rounded-lg p-3">
            <span className="text-[11px] font-mono text-[#8B9CB0] uppercase tracking-wider block">
              Vel. Media
            </span>
            <span className="text-xl font-bold font-mono text-[#F0F4F8] mt-0.5 block">
              {session.avgSpeedKmh.toFixed(1)}{' '}
              <span className="text-xs text-[#8B9CB0]">km/h</span>
            </span>
          </div>

          <div className="bg-[#1A222B] border border-[#2C3947]/70 rounded-lg p-3">
            <span className="text-[11px] font-mono text-[#8B9CB0] uppercase tracking-wider block">
              Offset Inicio
            </span>
            <span className="text-xl font-bold font-mono text-[#FFB300] mt-0.5 block">
              {session.timeRange.minSec.toFixed(3)}{' '}
              <span className="text-xs text-[#8B9CB0]">s</span>
            </span>
          </div>

          <div className="bg-[#1A222B] border border-[#2C3947]/70 rounded-lg p-3">
            <span className="text-[11px] font-mono text-[#8B9CB0] uppercase tracking-wider block">
              Eventos / Cortes
            </span>
            <span className="text-xl font-bold font-mono text-[#FF1744] mt-0.5 block">
              {session.events.length}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Sección Perfil de Vehículo & Tacómetro */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Gauge className="w-5 h-5 text-[#00E676]" />
            <h2 className="text-base font-bold text-[#F0F4F8]">Perfil de Tacómetro y Línea Roja</h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8B9CB0]">Origen:</span>
            <span
              className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                vcSource === 'app'
                  ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/40'
                  : 'bg-[#FFB300]/15 text-[#FFB300] border-[#FFB300]/40'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              {session.vehicleConfigWithOrigin.sourceDescription}
            </span>
          </div>
        </div>

        {/* Valores numéricos del tacómetro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1A222B] border border-[#2C3947] rounded-lg p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-[#8B9CB0] uppercase font-mono">Escala Máxima</span>
              <div className="text-2xl font-black font-mono text-[#F0F4F8]">{vc.max_rpm} RPM</div>
              <span className="text-[11px] text-[#8B9CB0]">Fin de la escala del tacómetro</span>
            </div>
            <div className="w-2.5 h-10 rounded bg-[#2C3947]" />
          </div>

          <div className="bg-[#1A222B] border border-[#2C3947] rounded-lg p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-[#FFB300] uppercase font-mono">Shift Light (Aviso)</span>
              <div className="text-2xl font-black font-mono text-[#FFB300]">
                {vc.shift_light_rpm} RPM
              </div>
              <span className="text-[11px] text-[#8B9CB0]">Parpadeo estroboscópico + SHIFT!</span>
            </div>
            <div className="w-2.5 h-10 rounded bg-[#FFB300]" />
          </div>

          <div className="bg-[#1A222B] border border-[#2C3947] rounded-lg p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-[#FF1744] uppercase font-mono">Línea Roja (Corte)</span>
              <div className="text-2xl font-black font-mono text-[#FF1744]">
                {vc.redline_rpm} RPM
              </div>
              <span className="text-[11px] text-[#8B9CB0]">Inicio de la zona roja</span>
            </div>
            <div className="w-2.5 h-10 rounded bg-[#FF1744]" />
          </div>
        </div>

        {/* Barra de visualización de rangos RPM */}
        <div className="bg-[#1A222B] p-4 rounded-lg border border-[#2C3947] space-y-2">
          <div className="flex justify-between text-xs font-mono text-[#8B9CB0]">
            <span>0 RPM</span>
            <span>Zona Normal (Verde)</span>
            <span className="text-[#FFB300]">{vc.shift_light_rpm} RPM (Shift)</span>
            <span className="text-[#FF1744]">{vc.redline_rpm} RPM (Redline)</span>
            <span>{vc.max_rpm} RPM</span>
          </div>

          <div className="h-4 rounded-full bg-[#090C0E] border border-[#2C3947] overflow-hidden flex relative">
            {/* Verde */}
            <div
              style={{ width: `${(vc.shift_light_rpm / vc.max_rpm) * 100}%` }}
              className="bg-[#00E676] h-full"
            />
            {/* Ámbar / Shift */}
            <div
              style={{
                width: `${((vc.redline_rpm - vc.shift_light_rpm) / vc.max_rpm) * 100}%`,
              }}
              className="bg-[#FFB300] h-full"
            />
            {/* Rojo */}
            <div
              style={{
                width: `${((vc.max_rpm - vc.redline_rpm) / vc.max_rpm) * 100}%`,
              }}
              className="bg-[#FF1744] h-full"
            />
          </div>
        </div>
      </div>

      {/* 3. Eventos y Cortes detectados */}
      {session.events.length > 0 && (
        <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-[#FFB300]" />
            <h2 className="text-base font-bold text-[#F0F4F8]">
              Línea Temporal de Eventos y Cortes de Sensor ({session.events.length})
            </h2>
          </div>
          <p className="text-xs text-[#8B9CB0]">
            Durante estos tramos, la herramienta no proyectará datos falsos e indicará el estado
            atenuado N/D.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {session.events.map((ev) => (
              <div
                key={ev.id}
                className="bg-[#1A222B] border border-[#2C3947] rounded-lg p-3.5 flex items-start gap-3"
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    ev.type === 'gps_lost'
                      ? 'bg-[#00E5FF]/10 text-[#00E5FF]'
                      : 'bg-[#FF1744]/10 text-[#FF1744]'
                  }`}
                >
                  <WifiOff className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-[#F0F4F8] truncate">{ev.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#090C0E] text-[#8B9CB0]">
                      {ev.source === 'app_json' ? 'session.json' : 'Auto-detect'}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-[#8B9CB0] mt-1">
                    t = {ev.startSec.toFixed(1)}s → {ev.endSec.toFixed(1)}s
                    <span className="text-[#FFB300] font-semibold ml-2">({ev.durationSec}s)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3.5. Inspector del Motor de Tiempo e Interpolación */}
      <TimeEngineInspector session={session} />

      {/* 4. Tabla de Señales Encontradas & Frecuencias */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#00E5FF]" />
            <h2 className="text-base font-bold text-[#F0F4F8]">
              Diagnóstico de Canales y Frecuencias Reales (Hz)
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#2C3947] text-[#8B9CB0] uppercase font-mono tracking-wider text-[11px] bg-[#1A222B]">
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Señal</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Unidad</th>
                <th className="py-2.5 px-3 text-right">Muestras</th>
                <th className="py-2.5 px-3 text-right">Hz Efectivos</th>
                <th className="py-2.5 px-3 text-right">Rango (Mín / Máx)</th>
                <th className="py-2.5 px-3 text-right">Huecos (&gt; umbral)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C3947]/60">
              {Object.values(session.signalsStats).map((stat) => (
                <tr
                  key={stat.signalKey}
                  className={`hover:bg-[#1A222B]/50 transition-colors ${
                    !stat.foundInCsv ? 'opacity-40' : ''
                  }`}
                >
                  <td className="py-2.5 px-3">
                    {stat.foundInCsv ? (
                      <span className="flex items-center gap-1.5 text-[#00E676] font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        OK
                      </span>
                    ) : (
                      <span className="text-[#8B9CB0] font-mono text-[11px]">N/D</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-[#F0F4F8]">
                    {stat.label}
                    <span className="block font-mono text-[10px] text-[#8B9CB0]">
                      {stat.signalKey}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        stat.category === 'GPS'
                          ? 'bg-[#00E5FF]/10 text-[#00E5FF]'
                          : stat.category === 'OBD'
                          ? 'bg-[#00E676]/10 text-[#00E676]'
                          : stat.category === 'IMU'
                          ? 'bg-[#FFB300]/10 text-[#FFB300]'
                          : 'bg-[#2C3947] text-[#8B9CB0]'
                      }`}
                    >
                      {stat.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[#00E5FF]">{stat.unit}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#F0F4F8]">
                    {stat.sampleCount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#00E676]">
                    {stat.foundInCsv ? `${stat.effectiveHz.toFixed(1)} Hz` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#8B9CB0]">
                    {stat.min !== undefined && stat.max !== undefined
                      ? `${stat.min} / ${stat.max}`
                      : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {stat.gapCount > 0 ? (
                      <span className="text-[#FFB300] font-semibold">
                        {stat.gapCount} huecos (máx {stat.maxGapSec}s)
                      </span>
                    ) : (
                      <span className="text-[#8B9CB0]">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Previsualizador de Vídeo si existe */}
      {session.videoUrl && (
        <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-[#FFB300]" />
            <h2 className="text-base font-bold text-[#F0F4F8]">Vídeo Original Extraído</h2>
          </div>
          <div className="max-w-2xl mx-auto rounded-lg overflow-hidden border border-[#2C3947] bg-black">
            <video src={session.videoUrl} controls className="w-full h-auto aspect-video" />
          </div>
        </div>
      )}

      {/* Modal de Mapeo de Columnas */}
      <ColumnMapperModal
        isOpen={isMapperOpen}
        onClose={() => setIsMapperOpen(false)}
        availableHeaders={csvHeaders}
        currentMapping={currentSignalToHeader}
        onSaveMapping={handleSaveMapping}
      />
    </div>
  );
};
