import { StandardSignalKey, TelemetryPoint } from '../model/telemetry';
import { ColumnMappingConfig, detectColumnMapping } from './columnMapper';

export interface ParseCsvOptions {
  mappingConfig?: ColumnMappingConfig;
  customSignalToHeader?: Partial<Record<StandardSignalKey, string>>;
}

export interface ParseCsvResult {
  points: TelemetryPoint[];
  mappingConfig: ColumnMappingConfig;
  headers: string[];
  totalRows: number;
  timeRange: { minSec: number; maxSec: number };
}

/**
 * Parsea un archivo CSV de telemetría respetando el principio: celda vacía = null (NUNCA 0).
 */
export function parseTelemetryCsv(csvText: string, options?: ParseCsvOptions): ParseCsvResult {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) {
    throw new Error('El archivo CSV de telemetría está vacío.');
  }

  // Encontrar la línea de cabecera
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('No se encontró cabecera válida en el archivo CSV.');
  }

  const rawHeaders = lines[headerIndex].split(',').map((h) => h.trim());
  const mappingConfig = options?.mappingConfig ?? detectColumnMapping(rawHeaders);

  // Si hay override manual de signalToHeader, aplicarlo
  if (options?.customSignalToHeader) {
    for (const [sig, hdr] of Object.entries(options.customSignalToHeader)) {
      if (hdr) {
        mappingConfig.signalToHeader[sig as StandardSignalKey] = hdr;
        mappingConfig.headerToSignal[hdr] = sig as StandardSignalKey;
      }
    }
  }

  // Mapeo inverso de índice de columna a señal estándar
  const colIndexToSignal: Record<number, StandardSignalKey> = {};
  const colIndexToConversion: Record<number, (v: number) => number> = {};
  let timeVideoColIndex = -1;
  let sourceColIndex = -1;
  let isoTimeColIndex = -1;

  for (let col = 0; col < rawHeaders.length; col++) {
    const headerName = rawHeaders[col];
    const norm = headerName.trim().toLowerCase();
    if (norm === 'iso_time') {
      isoTimeColIndex = col;
    }
    const signalKey = mappingConfig.headerToSignal[headerName];
    if (signalKey) {
      colIndexToSignal[col] = signalKey;
      if (signalKey === 'time_offset_video_sec') {
        timeVideoColIndex = col;
      }
      const conv = mappingConfig.unitConversions[signalKey];
      if (conv) {
        colIndexToConversion[col] = conv;
      }
    }
    if (headerName.trim().toLowerCase() === 'source') {
      sourceColIndex = col;
    }
  }

  if (timeVideoColIndex === -1) {
    // Si no hay time_offset_video_sec, buscar si existe time_offset_session_sec
    for (let col = 0; col < rawHeaders.length; col++) {
      if (mappingConfig.headerToSignal[rawHeaders[col]] === 'time_offset_session_sec') {
        timeVideoColIndex = col;
        break;
      }
    }
  }

  const points: TelemetryPoint[] = [];
  let minSec = Infinity;
  let maxSec = -Infinity;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = line.split(',');
    let timeVideo: number | null = null;

    if (timeVideoColIndex !== -1 && timeVideoColIndex < cells.length) {
      const valStr = cells[timeVideoColIndex].trim();
      if (valStr.length > 0) {
        const parsed = Number(valStr);
        if (!isNaN(parsed)) {
          timeVideo = parsed;
        }
      }
    }

    if (timeVideo === null) {
      // Si la fila carece de marca de tiempo, no se puede sincronizar
      continue;
    }

    const point: TelemetryPoint = {
      time_offset_video_sec: timeVideo,
    };

    if (sourceColIndex !== -1 && sourceColIndex < cells.length) {
      const src = cells[sourceColIndex].trim();
      if (src.length > 0) point.source = src;
    }

    if (isoTimeColIndex !== -1 && isoTimeColIndex < cells.length) {
      const iso = cells[isoTimeColIndex].trim();
      if (iso.length > 0) point.iso_time = iso;
    }

    for (let col = 0; col < cells.length; col++) {
      const signalKey = colIndexToSignal[col];
      if (!signalKey || signalKey === 'time_offset_video_sec') continue;

      const cellVal = cells[col].trim();
      if (cellVal.length === 0) {
        point[signalKey] = null;
        if (signalKey === 'gear') point.gear = null;
      } else if (signalKey === 'gear') {
        const upper = cellVal.toUpperCase();
        if (upper === 'R') {
          point['gear'] = -1;
          point.gear = 'R';
        } else if (upper === 'N') {
          point['gear'] = 0;
          point.gear = 'N';
        } else if (upper === 'P') {
          point['gear'] = 0;
          point.gear = 'P';
        } else if (upper === 'D') {
          point['gear'] = 1;
          point.gear = 'D';
        } else {
          const num = Number(cellVal);
          if (!isNaN(num)) {
            point['gear'] = num;
            point.gear = String(Math.round(num));
          } else {
            point['gear'] = null;
            point.gear = null;
          }
        }
      } else {
        const num = Number(cellVal);
        if (!isNaN(num)) {
          const conversion = colIndexToConversion[col];
          point[signalKey] = conversion ? conversion(num) : num;
        } else {
          point[signalKey] = null;
        }
      }
    }

    points.push(point);
    if (timeVideo < minSec) minSec = timeVideo;
    if (timeVideo > maxSec) maxSec = timeVideo;
  }

  // Ordenar determinísticamente por tiempo de vídeo
  points.sort((a, b) => a.time_offset_video_sec - b.time_offset_video_sec);

  return {
    points,
    mappingConfig,
    headers: rawHeaders,
    totalRows: points.length,
    timeRange: {
      minSec: isFinite(minSec) ? minSec : 0,
      maxSec: isFinite(maxSec) ? maxSec : 0,
    },
  };
}
