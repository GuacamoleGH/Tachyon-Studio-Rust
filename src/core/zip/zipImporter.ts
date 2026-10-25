import * as fflate from 'fflate';
import {
  DEFAULT_VEHICLE_CONFIG,
  SessionBundle,
  SessionEvent,
  SessionMetadataRaw,
  SignalStats,
  VehicleConfigWithOrigin,
} from '../model/session';
import { STANDARD_SIGNALS, StandardSignalKey, TelemetryPoint } from '../model/telemetry';
import { parseTelemetryCsv } from '../csv/csvParser';

export interface ImportProgressCallback {
  (step: string, percentage: number): void;
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) return new Uint8Array(0);
  if (chunks.length === 1) return chunks[0];
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

interface ExtractedZipData {
  csvBytes?: Uint8Array;
  jsonBytes?: Uint8Array;
  gpxBytes?: Uint8Array;
  readmeBytes?: Uint8Array;
  videoBlob?: Blob;
  videoFileName?: string;
  videoOversized?: boolean;
}

/**
 * Descomprime un paquete ZIP en streaming evitando cargar archivos de varios gigabytes (p.ej. vídeos 4K de 3GB)
 * en un único ArrayBuffer contiguo en memoria, lo que causaría fallo de asignación en el navegador.
 */
async function extractZipEntries(
  zipInput: File | Uint8Array | ArrayBuffer,
  onProgress?: ImportProgressCallback
): Promise<ExtractedZipData> {
  return new Promise((resolve, reject) => {
    try {
      const uz = new fflate.Unzip();
      uz.register(fflate.UnzipInflate);

      const textChunksMap: Record<string, Uint8Array[]> = {};
      const videoBlobParts: BlobPart[] = [];
      let totalVideoBytes = 0;
      let videoOversized = false;
      let detectedVideoName: string | undefined;
      let openFiles = 0;
      let streamFinished = false;

      function checkFinished() {
        if (streamFinished && openFiles === 0) {
          const findTextEntry = (name: string): Uint8Array | undefined => {
            const key = Object.keys(textChunksMap).find((k) => k.toLowerCase().endsWith(name.toLowerCase()));
            return key ? concatChunks(textChunksMap[key]) : undefined;
          };

          const csvBytes = findTextEntry('telemetria.csv');
          const jsonBytes = findTextEntry('session.json');
          const gpxBytes = findTextEntry('ruta.gpx');
          const readmeBytes = findTextEntry('leeme_sincronizacion.txt');

          let videoBlob: Blob | undefined;
          if (videoBlobParts.length > 0 && !videoOversized) {
            try {
              videoBlob = new Blob(videoBlobParts, { type: 'video/mp4' });
            } catch (e) {
              console.warn('No se pudo crear el Blob de vídeo en memoria:', e);
              videoOversized = true;
            }
          }

          resolve({
            csvBytes,
            jsonBytes,
            gpxBytes,
            readmeBytes,
            videoBlob,
            videoFileName: detectedVideoName,
            videoOversized,
          });
        }
      }

      uz.onfile = (file) => {
        openFiles++;
        const lowerName = file.name.toLowerCase();
        const isVideo =
          lowerName.endsWith('.mp4') ||
          lowerName.endsWith('.mov') ||
          lowerName.endsWith('.webm') ||
          lowerName.endsWith('.mkv');
        const isTargetText =
          lowerName.endsWith('telemetria.csv') ||
          lowerName.endsWith('session.json') ||
          lowerName.endsWith('ruta.gpx') ||
          lowerName.endsWith('leeme_sincronizacion.txt');

        if (isVideo) {
          detectedVideoName = file.name;
        }

        if (isTargetText) {
          textChunksMap[lowerName] = [];
        }

        file.ondata = (err, chunk, final) => {
          if (err) {
            console.error('Error descomprimiendo archivo:', file.name, err);
          }
          if (chunk) {
            if (isVideo) {
              totalVideoBytes += chunk.length;
              // Chrome / Chromium tiene un límite en memoria de 2 GB para Blobs creados en JS.
              // Si el vídeo supera 1.5 GB, evitamos saturar la RAM de V8 y descartamos acumular chunks en memoria.
              if (totalVideoBytes > 1.5 * 1024 * 1024 * 1024) {
                videoOversized = true;
                videoBlobParts.length = 0; // Liberar memoria para no crashear la pestaña
              } else if (!videoOversized) {
                videoBlobParts.push(chunk);
              }
            } else if (isTargetText) {
              textChunksMap[lowerName].push(chunk);
            }
          }
          if (final) {
            openFiles--;
            checkFinished();
          }
        };

        file.start();
      };

      (async () => {
        try {
          if (zipInput instanceof File) {
            const CHUNK_SIZE = 16 * 1024 * 1024; // Chunks de 16 MB para no saturar memoria
            const totalSize = zipInput.size;
            let offset = 0;

            while (offset < totalSize) {
              const end = Math.min(offset + CHUNK_SIZE, totalSize);
              const slice = zipInput.slice(offset, end);
              const arrayBuf = await slice.arrayBuffer();
              const isFinal = end >= totalSize;
              uz.push(new Uint8Array(arrayBuf), isFinal);
              offset = end;

              const progressPct = Math.min(45, 10 + Math.round((offset / totalSize) * 35));
              const mbDone = (offset / (1024 * 1024)).toFixed(0);
              const mbTotal = (totalSize / (1024 * 1024)).toFixed(0);
              onProgress?.(`Descomprimiendo archivos (${mbDone} MB de ${mbTotal} MB)...`, progressPct);
            }
          } else {
            const bytes = zipInput instanceof ArrayBuffer ? new Uint8Array(zipInput) : zipInput;
            uz.push(bytes, true);
          }

          streamFinished = true;
          checkFinished();
        } catch (e) {
          reject(e);
        }
      })();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Importa y analiza por completo un paquete ZIP de sesión exportado por Tachyon.
 */
export async function importSessionZip(
  zipInput: File | Uint8Array | ArrayBuffer,
  onProgress?: ImportProgressCallback
): Promise<SessionBundle> {
  onProgress?.('Iniciando lectura del archivo ZIP...', 10);

  const extracted = await extractZipEntries(zipInput, onProgress);

  const csvBytes = extracted.csvBytes;
  if (!csvBytes) {
    throw new Error('El paquete ZIP no contiene el archivo requerido "telemetria.csv".');
  }

  const jsonBytes = extracted.jsonBytes;
  const gpxBytes = extracted.gpxBytes;
  const readmeBytes = extracted.readmeBytes;

  const textDecoder = new TextDecoder('utf-8');

  onProgress?.('Decodificando metadatos y telemetría...', 50);
  const rawCsvText = textDecoder.decode(csvBytes);
  const rawJsonText = jsonBytes ? textDecoder.decode(jsonBytes) : undefined;
  const rawGpxText = gpxBytes ? textDecoder.decode(gpxBytes) : undefined;
  const rawReadmeText = readmeBytes ? textDecoder.decode(readmeBytes) : undefined;

  let metadata: SessionMetadataRaw | undefined;
  if (rawJsonText) {
    try {
      metadata = JSON.parse(rawJsonText);
    } catch (e) {
      console.warn('No se pudo parsear session.json:', e);
    }
  }

  // 1. Resolver VehicleConfig y su origen de prioridad
  const vehicleConfigWithOrigin = resolveVehicleConfig(metadata);

  // 2. Parsear CSV y telemetría
  onProgress?.('Parseando CSV y normalizando señales...', 70);
  const csvResult = parseTelemetryCsv(rawCsvText);
  const points = csvResult.points;
  const timeRange = csvResult.timeRange;

  // 3. Preparar vídeo si existe
  let hasVideo = false;
  let videoBlob: Blob | undefined = extracted.videoBlob;
  let videoUrl: string | undefined;
  const videoFileName = extracted.videoFileName || 'video.mp4';
  let videoLoadWarning: string | undefined;

  if (videoBlob && videoBlob.size > 0) {
    hasVideo = true;
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      videoUrl = URL.createObjectURL(videoBlob);
    }
  } else if (extracted.videoOversized || metadata?.video_synchronization?.has_video) {
    hasVideo = true;
    if (extracted.videoOversized) {
      videoLoadWarning =
        'El vídeo contenido en el archivo ZIP supera 1.5 GB. Los navegadores (Chrome/Edge) limitan a 2 GB los Blobs descompresos en memoria RAM. Puedes vincular el archivo video.mp4 directamente desde tu disco con 1 clic para una reproducción y exportación fluidas por hardware.';
    }
  }

  // 4. Calcular estadísticas de señales, frecuencias reales y detección de huecos
  onProgress?.('Analizando frecuencias reales y huecos temporales...', 85);
  const signalsStats = calculateSignalsStats(points, timeRange, metadata);

  // 5. Analizar y combinar eventos (del JSON o derivados de cortes de señal)
  const events = resolveEvents(metadata, signalsStats);

  // 6. Datos globales de la sesión
  const sessionId = metadata?.session?.id || metadata?.session_id || 'sesion-' + Date.now();
  const title = metadata?.session?.title || metadata?.vehicle?.name || 'Sesión de Telemetría';
  const startTimeIso =
    metadata?.session?.start_time_iso ||
    metadata?.started_utc ||
    (points[0]?.timestamp_utc_ms ? new Date(points[0].timestamp_utc_ms).toISOString() : new Date().toISOString());

  const totalDurationSec =
    timeRange.maxSec > timeRange.minSec
      ? timeRange.maxSec - timeRange.minSec
      : metadata?.session?.duration_seconds || 0;

  const totalDistance =
    metadata?.session?.total_distance_meters ||
    metadata?.stats?.distance_m ||
    calculateDistanceMeters(points);

  const maxSpeed =
    metadata?.session?.max_speed_kmh ||
    metadata?.stats?.max_speed_kmh ||
    calculateMaxSpeed(points);

  const avgSpeed =
    metadata?.session?.avg_speed_kmh ||
    metadata?.stats?.avg_speed_kmh ||
    (totalDurationSec > 0 ? (totalDistance / 1000) / (totalDurationSec / 3600) : 0);

  onProgress?.('¡Importación completada!', 100);

  return {
    id: sessionId,
    title,
    startTimeIso,
    durationSec: totalDurationSec,
    totalDistanceMeters: totalDistance,
    maxSpeedKmh: maxSpeed,
    avgSpeedKmh: avgSpeed,
    totalPoints: points.length,
    hasVideo,
    videoFileName: hasVideo ? videoFileName : undefined,
    videoBlob,
    videoUrl,
    videoOversized: extracted.videoOversized,
    videoLoadWarning,
    rawCsvText,
    points,
    timeRange,
    rawJsonText,
    metadata,
    rawGpxText,
    rawReadmeText,
    vehicleConfigWithOrigin,
    signalsStats,
    events,
    csvFormat: csvResult.mappingConfig.detectedFormat,
  };
}

/**
 * Resuelve la configuración del vehículo respetando la prioridad establecida.
 */
export function resolveVehicleConfig(metadata?: SessionMetadataRaw): VehicleConfigWithOrigin {
  const vc = metadata?.vehicle_config;
  if (vc && typeof vc.max_rpm === 'number' && typeof vc.redline_rpm === 'number') {
    const maxRpm = vc.max_rpm > 0 ? vc.max_rpm : DEFAULT_VEHICLE_CONFIG.max_rpm;
    const redlineRpm = vc.redline_rpm > 0 ? vc.redline_rpm : DEFAULT_VEHICLE_CONFIG.redline_rpm;
    const shiftLightRpm =
      typeof vc.shift_light_rpm === 'number' && vc.shift_light_rpm > 0
        ? vc.shift_light_rpm
        : Math.max(1000, redlineRpm - 500);

    return {
      config: {
        max_rpm: maxRpm,
        redline_rpm: redlineRpm,
        shift_light_rpm: shiftLightRpm,
      },
      source: 'app',
      sourceDescription: 'session.json (App Android)',
    };
  }

  return {
    config: { ...DEFAULT_VEHICLE_CONFIG },
    source: 'default',
    sourceDescription: 'Valores estándar por defecto (7500 / 6500 / 6000 RPM)',
  };
}

/**
 * Calcula estadísticas avanzadas por señal: muestras válidas, frecuencias reales y huecos.
 */
function calculateSignalsStats(
  points: TelemetryPoint[],
  timeRange: { minSec: number; maxSec: number },
  metadata?: SessionMetadataRaw
): Record<StandardSignalKey, SignalStats> {
  const durationSec = Math.max(0.001, timeRange.maxSec - timeRange.minSec);
  const result = {} as Record<StandardSignalKey, SignalStats>;

  const signalKeys = Object.keys(STANDARD_SIGNALS) as StandardSignalKey[];

  for (const sigKey of signalKeys) {
    const def = STANDARD_SIGNALS[sigKey];
    let validCount = 0;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    let lastValidTime: number | null = null;
    const gaps: Array<{ startSec: number; endSec: number; durationSec: number }> = [];
    let maxGapSec = 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const val = p[sigKey];

      if (val !== null && val !== undefined && typeof val === 'number') {
        validCount++;
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;

        if (lastValidTime !== null) {
          const gap = p.time_offset_video_sec - lastValidTime;
          if (gap > def.defaultMaxGapSec) {
            gaps.push({
              startSec: lastValidTime,
              endSec: p.time_offset_video_sec,
              durationSec: gap,
            });
            if (gap > maxGapSec) maxGapSec = gap;
          }
        }
        lastValidTime = p.time_offset_video_sec;
      }
    }

    const effectiveHz = validCount > 0 ? validCount / durationSec : 0;

    // Frecuencia nominal si viene en el JSON
    let nominalHz: number | undefined;
    if (metadata?.channels) {
      if (def.category === 'GPS' && metadata.channels.gps?.nominal_hz) {
        nominalHz = metadata.channels.gps.nominal_hz;
      } else if (def.category === 'IMU' && metadata.channels.imu?.nominal_hz) {
        nominalHz = metadata.channels.imu.nominal_hz;
      } else if (def.category === 'OBD' && metadata.channels.obd_rpm_pedal_speed?.nominal_hz) {
        nominalHz = metadata.channels.obd_rpm_pedal_speed.nominal_hz;
      }
    }

    result[sigKey] = {
      signalKey: sigKey,
      label: def.label,
      unit: def.unit,
      category: def.category,
      foundInCsv: validCount > 0,
      sampleCount: validCount,
      effectiveHz: Math.round(effectiveHz * 10) / 10,
      nominalHz,
      min: validCount > 0 && isFinite(min) ? Math.round(min * 100) / 100 : undefined,
      max: validCount > 0 && isFinite(max) ? Math.round(max * 100) / 100 : undefined,
      avg: validCount > 0 ? Math.round((sum / validCount) * 100) / 100 : undefined,
      gapCount: gaps.length,
      maxGapSec: Math.round(maxGapSec * 10) / 10,
      gaps,
    };
  }

  return result;
}

/**
 * Combina eventos explícitos de session.json con huecos detectados automáticamente.
 */
function resolveEvents(
  metadata: SessionMetadataRaw | undefined,
  signalsStats: Record<StandardSignalKey, SignalStats>
): SessionEvent[] {
  const events: SessionEvent[] = [];

  // 1. Eventos explícitos del JSON si existen (e.g. sesión sintética)
  if (metadata?.events && Array.isArray(metadata.events)) {
    for (let i = 0; i < metadata.events.length; i++) {
      const e = metadata.events[i];
      const start = Number(e.start_sec);
      const end = Number(e.end_sec);
      const dur = end - start;
      const eventType =
        e.type === 'gps_lost' || e.type === 'obd_disconnected' || e.type === 'session_pause'
          ? e.type
          : 'custom';

      events.push({
        id: `json-event-${i}`,
        type: eventType,
        title:
          eventType === 'gps_lost'
            ? 'Pérdida de señal GPS'
            : eventType === 'obd_disconnected'
            ? 'Desconexión adaptador OBD-II'
            : e.description || e.type,
        startSec: start,
        endSec: end,
        durationSec: Math.round(dur * 10) / 10,
        source: 'app_json',
      });
    }
  }

  // 2. Si no hay eventos explícitos, agregar huecos notables detectados (> 3 segundos)
  if (events.length === 0) {
    const gpsGaps = signalsStats.latitude?.gaps || [];
    for (let i = 0; i < gpsGaps.length; i++) {
      const g = gpsGaps[i];
      if (g.durationSec >= 3.0) {
        events.push({
          id: `detected-gps-gap-${i}`,
          type: 'gps_lost',
          title: 'Corte de cobertura GPS detectado',
          startSec: g.startSec,
          endSec: g.endSec,
          durationSec: Math.round(g.durationSec * 10) / 10,
          source: 'detected_gap',
        });
      }
    }

    const obdGaps = signalsStats.engine_rpm?.gaps || [];
    for (let i = 0; i < obdGaps.length; i++) {
      const g = obdGaps[i];
      if (g.durationSec >= 2.0) {
        events.push({
          id: `detected-obd-gap-${i}`,
          type: 'obd_disconnected',
          title: 'Interrupción datos OBD-II detectada',
          startSec: g.startSec,
          endSec: g.endSec,
          durationSec: Math.round(g.durationSec * 10) / 10,
          source: 'detected_gap',
        });
      }
    }
  }

  events.sort((a, b) => a.startSec - b.startSec);
  return events;
}

function calculateDistanceMeters(points: TelemetryPoint[]): number {
  let total = 0;
  let lastLat: number | null = null;
  let lastLon: number | null = null;

  for (const p of points) {
    if (p.latitude != null && p.longitude != null) {
      if (lastLat != null && lastLon != null) {
        total += haversineDistanceMeters(lastLat, lastLon, p.latitude, p.longitude);
      }
      lastLat = p.latitude;
      lastLon = p.longitude;
    }
  }
  return Math.round(total * 10) / 10;
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateMaxSpeed(points: TelemetryPoint[]): number {
  let max = 0;
  for (const p of points) {
    const spd = p.gps_speed_kmh ?? p.obd_speed_kmh;
    if (spd != null && spd > max) {
      max = spd;
    }
  }
  return Math.round(max * 10) / 10;
}
